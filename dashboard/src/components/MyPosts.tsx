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

function decodePackedId(packed: string): string {
    if (!packed) return '';
    const first = packed.split('|')[0] || packed;
    try {
        return decodeURIComponent(first);
    } catch {
        return first;
    }
}

function buildPostLink(post: Post, platform?: string): string | null {
    if (platform === 'moltbook') {
        return `https://www.moltbook.com/post/${post.id}`;
    }
    if (platform === 'bluesky') {
        const uri = decodePackedId(post.id);
        if (!uri.startsWith('at://')) return null;
        const parts = uri.replace('at://', '').split('/');
        if (parts.length < 3) return null;
        const did = parts[0];
        const rkey = parts[parts.length - 1];
        return `https://bsky.app/profile/${did}/post/${rkey}`;
    }
    return null;
}

export default function MyPosts({ refreshToken, platform }: { refreshToken?: number; platform?: string }) {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);

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

    const handleDelete = async (postId: string) => {
        const ok = window.confirm('Delete this post? This cannot be undone.');
        if (!ok) return;
        setDeletingId(postId);
        try {
            const res = await fetch('/api/delete-post', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: postId })
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Delete failed');
            }
            await fetchPosts();
        } catch (error) {
            console.error('Failed to delete post:', error);
            alert(error instanceof Error ? error.message : 'Failed to delete post');
        } finally {
            setDeletingId(null);
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
                    const link = buildPostLink(post, platform);
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
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                                    {link && (
                                        <a
                                            href={link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                                fontSize: 11,
                                                color: 'var(--primary)',
                                                textDecoration: 'none',
                                                padding: '4px 8px',
                                                border: '1px solid var(--primary)',
                                                borderRadius: 4,
                                                transition: 'all 0.2s',
                                                whiteSpace: 'nowrap'
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
                                            View ↗
                                        </a>
                                    )}
                                    <button
                                        className="danger"
                                        onClick={() => handleDelete(post.id)}
                                        disabled={deletingId === post.id}
                                        style={{ fontSize: 11, padding: '4px 8px', whiteSpace: 'nowrap' }}
                                    >
                                        {deletingId === post.id ? 'Deleting…' : 'Delete'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
