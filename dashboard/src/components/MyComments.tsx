import { useState, useEffect } from 'react';

interface CommentEntry {
    id: string;
    postId?: string;
    content?: string;
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
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [sort, setSort] = useState<'recent' | 'likes' | 'replies'>('recent');
    const [loading, setLoading] = useState(true);
    const limit = 100;

    useEffect(() => {
        fetchComments();
    }, [refreshToken, page, sort]);

    const fetchComments = async () => {
        try {
            const offset = (page - 1) * limit;
            const res = await fetch(`/api/my-comments?limit=${limit}&offset=${offset}&sort=${sort}`);
            const data = await res.json();
            setComments(data.comments || []);
            setTotal(data.total || 0);
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

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return (
        <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <h2 style={{ margin: 0 }}>My Comments</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <select
                        value={sort}
                        onChange={(e) => {
                            setSort(e.target.value as 'recent' | 'likes' | 'replies');
                            setPage(1);
                        }}
                        className="btn-secondary"
                        style={{ padding: '6px 8px', minWidth: 140 }}
                    >
                        <option value="recent">Sort: Recent</option>
                        <option value="likes">Sort: Likes</option>
                        <option value="replies">Sort: Replies</option>
                    </select>
                    <button
                        className="btn-secondary"
                        onClick={() => setPage(prev => Math.max(1, prev - 1))}
                        disabled={page <= 1}
                    >
                        Previous
                    </button>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        Page {page} of {totalPages}
                    </div>
                    <button
                        className="btn-secondary"
                        onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={page >= totalPages}
                    >
                        Next
                    </button>
                </div>
            </div>
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
                                    {comment.content && (
                                        <div style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 10, whiteSpace: 'pre-wrap' }}>
                                            {comment.content}
                                        </div>
                                    )}
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
