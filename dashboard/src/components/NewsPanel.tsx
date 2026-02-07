import { useEffect, useMemo, useState } from 'react';
import RelativeTime from './RelativeTime';

interface NewsItem {
    url: string;
    title: string;
    source: string;
    published_at: string | null;
    status: string;
    status_reason?: string | null;
    preview_text?: string | null;
    raw_output?: string | null;
    created_at: string;
    posted_at: string | null;
}

interface NewsHistoryResponse {
    items: NewsItem[];
    total: number;
    counts: Record<string, number>;
    queueCount?: number;
    lastCheckAt: string | null;
}

interface NewsConfig {
    checkMinutes?: number;
    maxAgeHours?: number;
    maxItemsPerRun?: number;
    minContentChars?: number;
    previewChars?: number;
    sources?: string | null;
}

const SOURCE_PRESETS: Array<{ id: string; label: string; sources: string }> = [
    {
        id: 'mixed',
        label: 'Mixed',
        sources: [
            'BBC News|https://newsrss.bbc.co.uk/rss/newsonline_uk_edition/front_page/rss.xml',
            'Reuters|https://feeds.reuters.com/reuters/topNews',
            'Associated Press|https://apnews.com/rss/apnews/topnews',
            'NPR|https://feeds.npr.org/1001/rss.xml',
            'Ars Technica|http://feeds.arstechnica.com/arstechnica/index',
            'The Verge|https://www.theverge.com/rss/index.xml',
            'Wired|https://www.wired.com/feed/rss',
            'TechCrunch|https://techcrunch.com/feed/',
            'MIT Tech Review|https://www.technologyreview.com/feed/',
            'Nature News|https://www.nature.com/subjects/news/rss'
        ].join('\n')
    },
    {
        id: 'news',
        label: 'News',
        sources: [
            'BBC News|https://newsrss.bbc.co.uk/rss/newsonline_uk_edition/front_page/rss.xml',
            'Reuters|https://feeds.reuters.com/reuters/topNews',
            'Associated Press|https://apnews.com/rss/apnews/topnews',
            'Al Jazeera|https://www.aljazeera.com/xml/rss/all.xml',
            'NPR|https://feeds.npr.org/1001/rss.xml',
            'The Guardian|https://www.theguardian.com/world/rss'
        ].join('\n')
    },
    {
        id: 'tech',
        label: 'Tech',
        sources: [
            'Ars Technica|http://feeds.arstechnica.com/arstechnica/index',
            'The Verge|https://www.theverge.com/rss/index.xml',
            'Wired|https://www.wired.com/feed/rss',
            'TechCrunch|https://techcrunch.com/feed/',
            'MIT Tech Review|https://www.technologyreview.com/feed/',
            'Hacker News|https://hnrss.org/frontpage'
        ].join('\n')
    },
    {
        id: 'science',
        label: 'Science',
        sources: [
            'Nature News|https://www.nature.com/subjects/news/rss',
            'ScienceDaily|https://www.sciencedaily.com/rss/top/science.xml',
            'NPR Science|https://feeds.npr.org/1007/rss.xml'
        ].join('\n')
    }
];

const TECH_ONLY_STORAGE_KEY = 'moltbot.techOnlyMode';

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

export default function NewsPanel({
    refreshToken,
    config,
    sourceOverrideProp
}: {
    refreshToken?: number;
    config?: NewsConfig | null;
    sourceOverrideProp?: string | null;
}) {
    const [items, setItems] = useState<NewsItem[]>([]);
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [lastCheckAt, setLastCheckAt] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [retryingUrl, setRetryingUrl] = useState<string | null>(null);
    const [postingUrl, setPostingUrl] = useState<string | null>(null);
    const [editingUrl, setEditingUrl] = useState<string | null>(null);
    const [editContent, setEditContent] = useState('');
    const [showRawOutput, setShowRawOutput] = useState(false);
    const [deletingUrl, setDeletingUrl] = useState<string | null>(null);
    const [previewLimit, setPreviewLimit] = useState(config?.previewChars ?? 240);
    const [autoExpandPreview, setAutoExpandPreview] = useState(false);
    const [sourceOverride, setSourceOverride] = useState<string | null>(sourceOverrideProp ?? null);
    const [techOnlyMode, setTechOnlyMode] = useState(false);
    const [showPendingOnly, setShowPendingOnly] = useState(false);
    const [tick, setTick] = useState(0);
    const [approvingBatch, setApprovingBatch] = useState(false);
    const [selectedUrls, setSelectedUrls] = useState<Record<string, boolean>>({});
    const [refreshKey, setRefreshKey] = useState(0);
    const [offset, setOffset] = useState(0);
    const [total, setTotal] = useState(0);
    const limit = 50;

    const effectiveSources = sourceOverride ?? config?.sources ?? null;
    const sourceList = useMemo(() => formatSourceList(effectiveSources), [effectiveSources]);
    const activePresetLabel = useMemo(() => {
        if (techOnlyMode) return 'Tech-only';
        if (sourceOverride) {
            const matched = SOURCE_PRESETS.find(preset => preset.sources === sourceOverride);
            return matched ? matched.label : 'Custom override';
        }
        return 'Env default';
    }, [techOnlyMode, sourceOverride]);
    const nextCheckAt = useMemo(() => {
        if (!lastCheckAt || !config?.checkMinutes) return null;
        const base = new Date(lastCheckAt).getTime();
        if (!Number.isFinite(base)) return null;
        return new Date(base + config.checkMinutes * 60 * 1000);
    }, [lastCheckAt, config?.checkMinutes, tick]);

    useEffect(() => {
        if (config?.previewChars) {
            setPreviewLimit(config.previewChars);
        }
    }, [config?.previewChars]);

    useEffect(() => {
        if (sourceOverrideProp !== undefined) {
            setSourceOverride(sourceOverrideProp ?? null);
        }
    }, [sourceOverrideProp]);

    useEffect(() => {
        const timer = setInterval(() => setTick(prev => prev + 1), 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        try {
            const stored = window.localStorage.getItem(TECH_ONLY_STORAGE_KEY);
            if (stored === 'true') {
                setTechOnlyMode(true);
            }
        } catch {
            // ignore storage errors
        }
    }, []);

    useEffect(() => {
        try {
            window.localStorage.setItem(TECH_ONLY_STORAGE_KEY, techOnlyMode ? 'true' : 'false');
        } catch {
            // ignore storage errors
        }
    }, [techOnlyMode]);

    useEffect(() => {
        if (!techOnlyMode) return;
        const techPreset = SOURCE_PRESETS.find(preset => preset.id === 'tech');
        if (techPreset) {
            handlePreset(techPreset.sources);
        }
    }, [techOnlyMode]);

    useEffect(() => {
        setSelectedUrls({});
    }, [items]);

    const truncatePreview = (text?: string | null): string => {
        if (!text) return '';
        if (autoExpandPreview) return text;
        if (text.length <= previewLimit) return text;
        return `${text.slice(0, previewLimit).trim()}…`;
    };

    const handlePreset = async (sources: string) => {
        try {
            const res = await fetch('/api/control/news-sources', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sources })
            });
            if (!res.ok) throw new Error('Failed to update sources');
            setSourceOverride(sources);
            setRefreshKey(prev => prev + 1);
        } catch (error) {
            console.error('Failed to update news sources:', error);
        }
    };

    const handleClearPreset = async () => {
        try {
            const res = await fetch('/api/control/news-sources', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sources: '' })
            });
            if (!res.ok) throw new Error('Failed to clear sources');
            setSourceOverride(null);
            setTechOnlyMode(false);
            setRefreshKey(prev => prev + 1);
        } catch (error) {
            console.error('Failed to clear news sources:', error);
        }
    };

    const toggleSelection = (url: string) => {
        setSelectedUrls(prev => ({ ...prev, [url]: !prev[url] }));
    };

    const pendingItems = items.filter(item => item.status !== 'posted');
    const visibleItems = showPendingOnly ? pendingItems : items;

    const handleApproveSelected = async () => {
        const urls = Object.entries(selectedUrls)
            .filter(([, checked]) => checked)
            .map(([url]) => url);
        if (!urls.length) return;
        setApprovingBatch(true);
        for (const url of urls) {
            const item = items.find(entry => entry.url === url);
            if (!item) continue;
            const overrideContent = item.preview_text ?? '';
            try {
                const res = await fetch('/api/news/retry', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url, forceBypass: true, overrideContent })
                });
                if (!res.ok) throw new Error('Retry failed');
            } catch (error) {
                console.error('Batch approve failed:', error);
            }
        }
        setSelectedUrls({});
        setApprovingBatch(false);
        setRefreshKey(prev => prev + 1);
    };

    const handleApproveAll = async () => {
        const urls = pendingItems.map(item => item.url);
        if (!urls.length) return;
        setApprovingBatch(true);
        for (const url of urls) {
            const item = items.find(entry => entry.url === url);
            if (!item || !item.preview_text) continue;
            const overrideContent = item.preview_text ?? '';
            try {
                const res = await fetch('/api/news/retry', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url, forceBypass: true, overrideContent })
                });
                if (!res.ok) throw new Error('Retry failed');
            } catch (error) {
                console.error('Batch approve failed:', error);
            }
        }
        setSelectedUrls({});
        setApprovingBatch(false);
        setRefreshKey(prev => prev + 1);
    };

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
                body: JSON.stringify({ url, forceBypass: true })
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

    const handleDelete = async (url: string) => {
        setDeletingUrl(url);
        try {
            const res = await fetch(`/api/news/item?url=${encodeURIComponent(url)}`, {
                method: 'DELETE'
            });
            if (!res.ok) throw new Error('Failed to delete');
            setRefreshKey(prev => prev + 1);
        } catch (error) {
            console.error('Failed to delete news item:', error);
        } finally {
            setDeletingUrl(null);
        }
    };

    const handleManualPost = async (url: string) => {
        setPostingUrl(url);
        try {
            const res = await fetch('/api/news/retry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, forceBypass: true, overrideContent: editContent })
            });
            if (!res.ok) {
                throw new Error('Manual post failed');
            }
            setRefreshKey(prev => prev + 1);
            setEditingUrl(null);
            setEditContent('');
        } catch (error) {
            console.error('Failed to post edited news content:', error);
        } finally {
            setPostingUrl(null);
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
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            Last check: {lastCheckAt ? <RelativeTime value={lastCheckAt} /> : '—'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            Next check: {nextCheckAt ? <RelativeTime value={nextCheckAt.toISOString()} /> : '—'}
                        </div>
                        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                            <input
                                type="checkbox"
                                checked={showRawOutput}
                                onChange={(event) => setShowRawOutput(event.target.checked)}
                            />
                            Show raw LLM output
                        </label>
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
                        <div style={{ marginTop: 6 }}>Preset: {activePresetLabel}</div>
                        {sourceList.length > 0 && (
                            <div style={{ marginTop: 6 }}>
                                <div style={{ marginBottom: 4 }}>Sources:</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {sourceList.map(source => (
                                        <span key={source} className="badge" style={{ fontSize: 11 }}>
                                            {source}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {sourceOverride && (
                            <div style={{ marginTop: 6 }}>
                                Override active · {sourceOverride.split(/[\n,]+/).length} sources
                            </div>
                        )}
                        <div style={{ marginTop: 6 }}>
                            News posts attempt only during idle cycles or comment cooldown.
                        </div>
                    </div>
                )}
                <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {SOURCE_PRESETS.map(preset => (
                        <button
                            key={preset.id}
                            className="btn-secondary"
                            style={{ fontSize: 11 }}
                            onClick={() => handlePreset(preset.sources)}
                        >
                            {preset.label} preset
                        </button>
                    ))}
                    <button className="btn-secondary" style={{ fontSize: 11 }} onClick={handleClearPreset}>
                        Clear override
                    </button>
                    <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                        <input
                            type="checkbox"
                            checked={techOnlyMode}
                            onChange={(event) => setTechOnlyMode(event.target.checked)}
                        />
                        Tech-only mode
                    </label>
                </div>
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        Preview length: {previewLimit} chars
                    </label>
                    <input
                        type="range"
                        min={120}
                        max={800}
                        step={20}
                        value={previewLimit}
                        onChange={(event) => setPreviewLimit(Number(event.target.value))}
                        style={{ flex: 1, minWidth: 200 }}
                    />
                    <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                        <input
                            type="checkbox"
                            checked={autoExpandPreview}
                            onChange={(event) => setAutoExpandPreview(event.target.checked)}
                        />
                        Auto expand previews
                    </label>
                </div>
            </div>

            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div>
                        <h2 style={{ margin: 0 }}>Manual Post Queue</h2>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            Review skipped/error items and batch approve.
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            className="btn-secondary"
                            disabled={approvingBatch || pendingItems.length === 0}
                            onClick={handleApproveAll}
                            style={{ fontSize: 12 }}
                        >
                            {approvingBatch ? 'Approving…' : 'Approve All'}
                        </button>
                        <button
                            className="btn-primary"
                            disabled={approvingBatch || Object.values(selectedUrls).every(val => !val)}
                            onClick={handleApproveSelected}
                            style={{ fontSize: 12 }}
                        >
                            {approvingBatch ? 'Approving…' : 'Approve Selected'}
                        </button>
                    </div>
                </div>
                {pendingItems.length === 0 ? (
                    <div className="empty-state" style={{ marginTop: 12 }}>Queue is empty.</div>
                ) : (
                    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {pendingItems.map(item => (
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
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <input
                                            type="checkbox"
                                            checked={!!selectedUrls[item.url]}
                                            onChange={() => toggleSelection(item.url)}
                                            disabled={!item.preview_text}
                                        />
                                        <div style={{ fontWeight: 600, fontSize: 14 }}>{item.title}</div>
                                    </div>
                                    <span className="badge warning">{item.status}</span>
                                </div>
                                {item.status_reason && (
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                        Reason: {item.status_reason}
                                    </div>
                                )}
                                {item.preview_text && (
                                    <div style={{ fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                                        {truncatePreview(item.preview_text)}
                                    </div>
                                )}
                                {!item.preview_text && (
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                        No preview available yet.
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <h2 style={{ margin: 0 }}>News Records</h2>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                            <input
                                type="checkbox"
                                checked={showPendingOnly}
                                onChange={(event) => setShowPendingOnly(event.target.checked)}
                            />
                            Only pending
                        </label>
                        <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn-secondary" disabled={!canPrev} onClick={() => setOffset(Math.max(0, offset - limit))}>
                            Previous
                        </button>
                        <button className="btn-secondary" disabled={!canNext} onClick={() => setOffset(offset + limit)}>
                            Next
                        </button>
                        </div>
                    </div>
                </div>
                {loading ? (
                    <div className="loading">Loading news history...</div>
                ) : visibleItems.length === 0 ? (
                    <div className="empty-state">No news items recorded yet.</div>
                ) : (
                    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {visibleItems.map(item => (
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
                                {item.status_reason && (
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                        Reason: {item.status_reason}
                                    </div>
                                )}
                                {item.preview_text && (
                                    <details style={{ marginTop: 4 }}>
                                        <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)' }}>
                                            Preview
                                        </summary>
                                        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                                            {truncatePreview(item.preview_text)}
                                        </div>
                                    </details>
                                )}
                                {showRawOutput && item.raw_output && (
                                    <details style={{ marginTop: 4 }}>
                                        <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)' }}>
                                            Raw output
                                        </summary>
                                        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                                            {item.raw_output}
                                        </div>
                                    </details>
                                )}
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
                                            {retryingUrl === item.url ? 'Retrying…' : 'Retry (Bypass Gates)'}
                                        </button>
                                        <button
                                            className="btn-secondary"
                                            onClick={() => {
                                                setEditingUrl(item.url);
                                                setEditContent(item.preview_text ?? '');
                                            }}
                                            disabled={postingUrl === item.url}
                                            style={{ fontSize: 11, marginLeft: 8 }}
                                        >
                                            Edit & Post
                                        </button>
                                        <button
                                            className="btn-secondary"
                                            onClick={() => handleDelete(item.url)}
                                            disabled={deletingUrl === item.url}
                                            style={{ fontSize: 11, marginLeft: 8 }}
                                        >
                                            {deletingUrl === item.url ? 'Deleting…' : 'Delete'}
                                        </button>
                                    </div>
                                )}
                                {editingUrl === item.url && (
                                    <div style={{ marginTop: 8 }}>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                                            Manual post (200 char max)
                                        </div>
                                        <textarea
                                            value={editContent}
                                            onChange={(event) => setEditContent(event.target.value)}
                                            rows={4}
                                            style={{
                                                width: '100%',
                                                background: 'var(--bg-primary)',
                                                border: '1px solid var(--border)',
                                                borderRadius: 6,
                                                color: 'var(--text-primary)',
                                                padding: 8,
                                                fontSize: 12
                                            }}
                                        />
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                {editContent.length} / 200
                                            </div>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <button
                                                    className="btn-secondary"
                                                    onClick={() => {
                                                        setEditingUrl(null);
                                                        setEditContent('');
                                                    }}
                                                    style={{ fontSize: 11 }}
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    className="btn-primary"
                                                    onClick={() => handleManualPost(item.url)}
                                                    disabled={postingUrl === item.url}
                                                    style={{ fontSize: 11 }}
                                                >
                                                    {postingUrl === item.url ? 'Posting…' : 'Post Edited'}
                                                </button>
                                            </div>
                                        </div>
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
