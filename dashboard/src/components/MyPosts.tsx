import { useState, useEffect } from 'react';

interface Post {
    id: string;
    title: string;
    content: string;
    submolt: string;
    votes: number;
    createdAt: string;
}

interface BoostResult {
    postId: string;
    attempted: number;
    succeeded: number;
    failed: number;
    errors: string[];
}

export default function MyPosts() {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [boosting, setBoosting] = useState<string | null>(null);
    const [boostResults, setBoostResults] = useState<Record<string, BoostResult>>({});

    useEffect(() => {
        fetchPosts();
    }, []);

    const fetchPosts = async () => {
        try {
            const res = await fetch('/api/my-posts');
            const data = await res.json();
            setPosts(data.posts || []);
        } catch (error) {
            console.error('Failed to fetch posts:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleBoost = async (postId: string) => {
        setBoosting(postId);
        try {
            const res = await fetch(`/api/boost/${postId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ concurrency: 50 })
            });
            const result: BoostResult = await res.json();
            setBoostResults(prev => ({ ...prev, [postId]: result }));

            // Refresh posts to see updated vote counts
            setTimeout(fetchPosts, 1000);
        } catch (error) {
            console.error('Failed to boost post:', error);
        } finally {
            setBoosting(null);
        }
    };

    if (loading) {
        return (
            <div className="card">
                <h2>My Posts</h2>
                <div className="loading">Loading posts...</div>
            </div>
        );
    }

    if (posts.length === 0) {
        return (
            <div className="card">
                <h2>My Posts</h2>
                <div className="empty-state">No posts created yet</div>
            </div>
        );
    }

    return (
        <div className="card">
            <h2>My Posts (Research Tools)</h2>
            <div style={{ fontSize: 12, color: 'var(--warning)', marginBottom: 16, padding: 8, background: 'rgba(210, 153, 34, 0.1)', borderRadius: 4 }}>
                ⚠️ Research Mode: Boost function tests race condition vulnerability
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {posts.map(post => {
                    const result = boostResults[post.id];
                    const isBoostingThis = boosting === post.id;

                    return (
                        <div key={post.id} style={{
                            padding: 16,
                            background: 'var(--bg-tertiary)',
                            borderRadius: 6,
                            border: '1px solid var(--border)'
                        }}>
                            <div style={{ marginBottom: 8 }}>
                                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                                    {post.title}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                    m/{post.submolt} • {new Date(post.createdAt).toLocaleString()}
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
                                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                    Votes: <span style={{ color: 'var(--success)', fontWeight: 600 }}>{post.votes}</span>
                                </div>

                                <button
                                    onClick={() => handleBoost(post.id)}
                                    disabled={isBoostingThis}
                                    className="primary"
                                    style={{
                                        fontSize: 12,
                                        padding: '6px 12px',
                                        background: isBoostingThis ? 'var(--bg-tertiary)' : 'var(--warning)'
                                    }}
                                >
                                    {isBoostingThis ? '⏳ Boosting...' : '🚀 Boost (50x)'}
                                </button>

                                {result && (
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                        ✓ {result.succeeded}/{result.attempted} succeeded
                                        {result.failed > 0 && ` • ${result.failed} failed`}
                                    </div>
                                )}
                            </div>

                            {result && result.errors.length > 0 && (
                                <details style={{ marginTop: 8, fontSize: 11 }}>
                                    <summary style={{ cursor: 'pointer', color: 'var(--error)' }}>
                                        Errors ({result.errors.length})
                                    </summary>
                                    <div style={{ marginTop: 4, padding: 8, background: 'var(--bg-primary)', borderRadius: 4 }}>
                                        {result.errors.slice(0, 3).map((err, i) => (
                                            <div key={i} style={{ color: 'var(--error)' }}>• {err}</div>
                                        ))}
                                        {result.errors.length > 3 && (
                                            <div style={{ color: 'var(--text-muted)' }}>
                                                ... and {result.errors.length - 3} more
                                            </div>
                                        )}
                                    </div>
                                </details>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
