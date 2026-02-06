import { useEffect, useMemo, useState } from 'react';
import RelativeTime from './RelativeTime';

interface NewsItem {
    url: string;
    title: string;
    source: string;
    published_at: string | null;
    status: string;
    created_at: string;
    posted_at: string | null;
}

interface NewsHistoryResponse {
    items: NewsItem[];
    total: number;
    counts: Record<string, number>;
    lastCheckAt: string | null;
}

interface NewsConfig {
    checkMinutes?: number;
    maxAgeHours?: number;
    maxItemsPerRun?: number;
    minContentChars?: number;
    sources?: string | null;
}

function formatNumber(value: number | undefined): string {
    return Number(value || 0).toLocaleString();
}

function formatSourceList(raw?: string | null): string[] {
    if (!raw) return [];
    return raw
        .split(/[\n,]+/)
        .map(entry => entry.trim())
        .filter(Boolean)
        .map(entry => entry.split('|')[0]?.trim() || entry);
}

export default function NewsPanel({ refreshToken, config }: { refreshToken?: number; config?: NewsConfig | null }) {
    const [items, setItems] = useState<NewsItem[]>([]);
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [lastCheckAt, setLastCheckAt] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [retryingUrl, setRetryingUrl] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [offset, setOffset] = useState(0);
    const [total, setTotal] = useState(0);
    const limit = 50;

    const sourceList = useMemo(() => formatSourceList(config?.sources), [config?.sources]);

    useEffect(() => {
        let active = true;
        const load = async () => {
            try {
                setLoading(true);
                const res = await fetch(`/api/news/history?limit=${limit}&offset=${offset}`);
                if (!res.ok) throw new Error('Failed to load news history');
                const data: NewsHistoryResponse = await res.json();
                if (!active) return;
                setItems(data.items || []);
                setCounts(data.counts || {});
                setTotal(data.total || 0);
                setLastCheckAt(data.lastCheckAt ?? null);
            } catch (error) {
                console.error('Failed to fetch news history:', error);
            } finally {
                if (active) setLoading(false);
            }
        };
        load();
        return () => {
            active = false;
        };
    }, [offset, refreshToken, refreshKey]);

    const canPrev = offset > 0;
    const canNext = offset + limit < total;

    const handleRetry = async (url: string) => {
        setRetryingUrl(url);
        try {
            const res = await fetch('/api/news/retry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            if (!res.ok) {
                throw new Error('Retry failed');
            }
            setRefreshKey(prev => prev + 1);
        } catch (error) {
            console.error('Failed to retry news post:', error);
        } finally {
            setRetryingUrl(null);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div>
                        <h2 style={{ marginBottom: 4 }}>News Scout</h2>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            RSS ingestion, article reads, and post outcomes.
                        </div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        Last check: {lastCheckAt ? <RelativeTime value={lastCheckAt} /> : '—'}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
                    <div className="status-row" style={{ minWidth: 160 }}>
                        <span className="status-label">Posted</span>
                        <span className="status-value">{formatNumber(counts.posted)}</span>
                    </div>
                    <div className="status-row" style={{ minWidth: 160 }}>
                        <span className="status-label">Seen</span>
                        <span className="status-value">{formatNumber(counts.seen)}</span>
                    </div>
                    <div className="status-row" style={{ minWidth: 160 }}>
                        <span className="status-label">Skipped</span>
                        <span className="status-value">{formatNumber(counts.skipped)}</span>
                    </div>
                    <div className="status-row" style={{ minWidth: 160 }}>
                        <span className="status-label">Errors</span>
                        <span className="status-value">{formatNumber(counts.error)}</span>
                    </div>
                </div>
                {config && (
                    <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                        Interval: {config.checkMinutes ?? '—'} min · Max age: {config.maxAgeHours ?? '—'} h · Min chars: {config.minContentChars ?? '—'}
                        {sourceList.length > 0 && (
                            <div style={{ marginTop: 6 }}>
                                Sources: {sourceList.join(', ')}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <h2 style={{ margin: 0 }}>News Records</h2>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn-secondary" disabled={!canPrev} onClick={() => setOffset(Math.max(0, offset - limit))}>
                            Previous
                        </button>
                        <button className="btn-secondary" disabled={!canNext} onClick={() => setOffset(offset + limit)}>
                            Next
                        </button>
                    </div>
                </div>
                {loading ? (
                    <div className="loading">Loading news history...</div>
                ) : items.length === 0 ? (
                    <div className="empty-state">No news items recorded yet.</div>
                ) : (
                    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {items.map(item => (
                            <div key={item.url} style={{
                                padding: 12,
                                borderRadius: 8,
                                border: '1px solid var(--border)',
                                background: 'var(--bg-tertiary)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 6
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                    <div style={{ fontWeight: 600, fontSize: 14 }}>{item.title}</div>
                                    <span
                                        className={
                                            item.status === 'posted'
                                                ? 'badge info'
                                                : item.status === 'error'
                                                    ? 'badge warning'
                                                    : item.status === 'skipped'
                                                        ? 'badge warning'
                                                        : 'badge'
                                        }
                                    >
                                        {item.status}
                                    </span>
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                    {item.source} · Published {item.published_at ? new Date(item.published_at).toLocaleString() : '—'}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                    Added {new Date(item.created_at).toLocaleString()}
                                    {item.posted_at && (
                                        <span> · Posted {new Date(item.posted_at).toLocaleString()}</span>
                                    )}
                                </div>
                                <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ fontSize: 12, color: 'var(--primary)', textDecoration: 'none' }}
                                >
                                    Open source ↗
                                </a>
                                {item.status !== 'posted' && (
                                    <div style={{ marginTop: 6 }}>
                                        <button
                                            className="btn-secondary"
                                            onClick={() => handleRetry(item.url)}
                                            disabled={retryingUrl === item.url}
                                            style={{ fontSize: 11 }}
                                        >
                                            {retryingUrl === item.url ? 'Retrying…' : 'Retry Post'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
