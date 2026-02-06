import { useEffect, useMemo, useState } from 'react';
import RelativeTime from './RelativeTime';

interface EngagementPoint {
    timestamp: string;
    comments: number;
    likes: number;
}

interface EngagementResponse {
    bucket: 'hour' | 'day' | 'week';
    start: string;
    end: string;
    series: EngagementPoint[];
}

interface RawCommentRow {
    id: string;
    post_id?: string;
    content?: string;
    like_count?: number;
    reply_count?: number;
    timestamp: string;
}

interface TopCommentsResponse {
    topLiked: RawCommentRow | null;
    topReplied: RawCommentRow | null;
}

interface CommentCardData {
    id: string;
    postId?: string;
    content?: string;
    likeCount: number;
    replyCount: number;
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

function buildCommentLink(comment: CommentCardData, platform?: string): string | null {
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

function formatNumber(value: number): string {
    return Number(value || 0).toLocaleString();
}

function buildLinePoints(values: number[]): string | null {
    if (!values.length) return null;
    const max = Math.max(1, ...values);
    return values
        .map((value, index) => {
            const x = (index / Math.max(1, values.length - 1)) * 100;
            const y = 100 - (value / max) * 100;
            return `${x.toFixed(2)},${y.toFixed(2)}`;
        })
        .join(' ');
}

function normalizeComment(row: RawCommentRow | null): CommentCardData | null {
    if (!row) return null;
    return {
        id: row.id,
        postId: row.post_id,
        content: row.content ?? '',
        likeCount: row.like_count ?? 0,
        replyCount: row.reply_count ?? 0,
        timestamp: row.timestamp
    };
}

function MetricChart({
    title,
    subtitle,
    series,
    color,
    unit
}: {
    title: string;
    subtitle: string;
    series: EngagementPoint[];
    color: string;
    unit: string;
}) {
    const values = series.map(point => point[unit as 'comments' | 'likes'] ?? 0);
    const latest = values[values.length - 1] ?? 0;
    const points = useMemo(() => buildLinePoints(values), [values]);

    return (
        <div style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 16,
            flex: 1,
            minWidth: 260
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{subtitle}</div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 600, color }}>
                    {formatNumber(latest)}
                </div>
            </div>
            <div style={{ height: 120, marginTop: 12 }}>
                {points ? (
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
                        <defs>
                            <linearGradient id={`gradient-${unit}`} x1="0" x2="0" y1="0" y2="1">
                                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                                <stop offset="100%" stopColor={color} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <polyline
                            fill="none"
                            stroke={color}
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={points}
                        />
                        <polygon
                            points={`0,100 ${points} 100,100`}
                            fill={`url(#gradient-${unit})`}
                            opacity="0.6"
                        />
                    </svg>
                ) : (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No activity recorded yet.</div>
                )}
            </div>
        </div>
    );
}

export default function StatsPanel({ refreshToken, platform }: { refreshToken?: number; platform?: string }) {
    const [bucket, setBucket] = useState<'hour' | 'day' | 'week'>('day');
    const [engagement, setEngagement] = useState<EngagementResponse | null>(null);
    const [topComments, setTopComments] = useState<{ topLiked: CommentCardData | null; topReplied: CommentCardData | null }>(
        { topLiked: null, topReplied: null }
    );
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        const load = async () => {
            try {
                setLoading(true);
                const [engagementRes, topRes] = await Promise.all([
                    fetch(`/api/stats/engagement?bucket=${bucket}`),
                    fetch('/api/stats/top-comments')
                ]);
                if (!active) return;
                if (engagementRes.ok) {
                    const data: EngagementResponse = await engagementRes.json();
                    setEngagement(data);
                }
                if (topRes.ok) {
                    const data: TopCommentsResponse = await topRes.json();
                    setTopComments({
                        topLiked: normalizeComment(data.topLiked),
                        topReplied: normalizeComment(data.topReplied)
                    });
                }
            } catch (error) {
                console.error('Failed to fetch stats:', error);
            } finally {
                if (active) setLoading(false);
            }
        };
        load();
        return () => {
            active = false;
        };
    }, [bucket, refreshToken]);

    const rangeLabel = engagement
        ? `${new Date(engagement.start).toLocaleDateString()} → ${new Date(engagement.end).toLocaleDateString()}`
        : '';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div>
                        <div style={{ fontWeight: 600 }}>Engagement Rhythm</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            Comment and like frequency across {bucket}-level buckets. {rangeLabel}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                        {(['hour', 'day', 'week'] as const).map((value) => (
                            <button
                                key={value}
                                className="btn-secondary"
                                onClick={() => setBucket(value)}
                                style={{
                                    padding: '4px 10px',
                                    fontSize: '0.75rem',
                                    background: bucket === value ? 'var(--primary)' : 'var(--bg-tertiary)',
                                    color: bucket === value ? 'white' : 'var(--text-secondary)',
                                    border: 'none'
                                }}
                            >
                                {value.charAt(0).toUpperCase() + value.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>
                {loading && !engagement ? (
                    <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>Loading stats…</div>
                ) : (
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        <MetricChart
                            title="Comments per bucket"
                            subtitle="Number of comments created"
                            series={engagement?.series ?? []}
                            color="var(--info)"
                            unit="comments"
                        />
                        <MetricChart
                            title="Likes per bucket"
                            subtitle="New likes on comments"
                            series={engagement?.series ?? []}
                            color="var(--success)"
                            unit="likes"
                        />
                    </div>
                )}
            </div>

            <div className="card">
                <div style={{ marginBottom: 12 }}>
                    <div style={{ fontWeight: 600 }}>Top Comment Signals</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        Highest liked and most replied comments currently recorded.
                    </div>
                </div>
                <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
                    {[
                        { label: 'Most Liked', data: topComments.topLiked },
                        { label: 'Most Replied', data: topComments.topReplied }
                    ].map((item) => {
                        if (!item.data) {
                            return (
                                <div key={item.label} style={{
                                    padding: 16,
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: 8,
                                    border: '1px solid var(--border)',
                                    color: 'var(--text-muted)',
                                    fontSize: 12
                                }}>
                                    {item.label}: No data yet.
                                </div>
                            );
                        }
                        const link = buildCommentLink(item.data, platform);
                        return (
                            <div key={item.label} style={{
                                padding: 16,
                                background: 'var(--bg-tertiary)',
                                borderRadius: 8,
                                border: '1px solid var(--border)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 10
                            }}>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.label}</div>
                                <div style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                                    {item.data.content || 'No content stored.'}
                                </div>
                                <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
                                    <span>
                                        Likes: <span style={{ color: 'var(--success)', fontWeight: 600 }}>{item.data.likeCount}</span>
                                    </span>
                                    <span>
                                        Replies: <span style={{ color: 'var(--info)', fontWeight: 600 }}>{item.data.replyCount}</span>
                                    </span>
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                    <RelativeTime value={item.data.timestamp} />
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
                                            width: 'fit-content'
                                        }}
                                    >
                                        View ↗
                                    </a>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
