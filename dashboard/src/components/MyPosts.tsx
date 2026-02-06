import { useState, useEffect } from 'react';

interface Post {
    id: string;
    title: string;
    content: string;
    submolt: string;
    votes: number;
    likeCount?: number;
    replyCount?: number;
    createdAt: string;
}

export default function MyPosts({ refreshToken }: { refreshToken?: number }) {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPosts();
    }, [refreshToken]);

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
            <h2>My Posts</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {posts.map(post => {
                    return (
                        <div key={post.id} style={{
                            padding: 16,
                            background: 'var(--bg-tertiary)',
                            borderRadius: 6,
                            border: '1px solid var(--border)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                                        {post.title}
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                                        m/{post.submolt} • {new Date(post.createdAt).toLocaleString()}
                                    </div>
                                    <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
                                        <span>
                                            Likes: <span style={{ color: 'var(--success)', fontWeight: 600 }}>{post.likeCount ?? post.votes}</span>
                                        </span>
                                        <span>
                                            Replies: <span style={{ color: 'var(--info)', fontWeight: 600 }}>{post.replyCount ?? 0}</span>
                                        </span>
                                    </div>
                                </div>
                                <a
                                    href={`https://www.moltbook.com/post/${post.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        fontSize: 11,
                                        color: 'var(--primary)',
                                        textDecoration: 'none',
                                        padding: '4px 8px',
                                        border: '1px solid var(--primary)',
                                        borderRadius: 4,
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseOver={(e) => {
                                        e.currentTarget.style.background = 'var(--primary)';
                                        e.currentTarget.style.color = 'white';
                                    }}
                                    onMouseOut={(e) => {
                                        e.currentTarget.style.background = 'transparent';
                                        e.currentTarget.style.color = 'var(--primary)';
                                    }}
                                >
                                    View on Moltbook ↗
                                </a>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
