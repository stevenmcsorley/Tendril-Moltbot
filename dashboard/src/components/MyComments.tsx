import { useState, useEffect } from 'react';

interface CommentEntry {
    id: string;
    postId?: string;
    likeCount?: number;
    replyCount?: number;
    timestamp: string;
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

function buildCommentLink(comment: CommentEntry, platform?: string): string | null {
    if (platform === 'moltbook' && comment.postId) {
        return `https://www.moltbook.com/post/${comment.postId}`;
    }
    if (platform === 'bluesky') {
        const uri = decodePackedId(comment.id);
        if (!uri.startsWith('at://')) return null;
        const parts = uri.replace('at://', '').split('/');
        if (parts.length < 3) return null;
        const did = parts[0];
        const rkey = parts[parts.length - 1];
        return `https://bsky.app/profile/${did}/post/${rkey}`;
    }
    return null;
}

export default function MyComments({ refreshToken, platform }: { refreshToken?: number; platform?: string }) {
    const [comments, setComments] = useState<CommentEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchComments();
    }, [refreshToken]);

    const fetchComments = async () => {
        try {
            const res = await fetch('/api/my-comments');
            const data = await res.json();
            setComments(data.comments || []);
        } catch (error) {
            console.error('Failed to fetch comments:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="card">
                <h2>My Comments</h2>
                <div className="loading">Loading comments...</div>
            </div>
        );
    }

    if (comments.length === 0) {
        return (
            <div className="card">
                <h2>My Comments</h2>
                <div className="empty-state">No comments recorded yet</div>
            </div>
        );
    }

    return (
        <div className="card">
            <h2>My Comments</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {comments.map(comment => {
                    const link = buildCommentLink(comment, platform);
                    return (
                        <div key={comment.id} style={{
                            padding: 16,
                            background: 'var(--bg-tertiary)',
                            borderRadius: 6,
                            border: '1px solid var(--border)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                                <div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                                        {new Date(comment.timestamp).toLocaleString()}
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
                                        ID: <span style={{ color: 'var(--text-primary)' }}>{decodePackedId(comment.id)}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
                                        <span>
                                            Likes: <span style={{ color: 'var(--success)', fontWeight: 600 }}>{comment.likeCount ?? 0}</span>
                                        </span>
                                        <span>
                                            Replies: <span style={{ color: 'var(--info)', fontWeight: 600 }}>{comment.replyCount ?? 0}</span>
                                        </span>
                                    </div>
                                </div>
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
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
