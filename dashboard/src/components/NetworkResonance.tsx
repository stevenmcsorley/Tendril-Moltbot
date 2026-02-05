import RelativeTime from './RelativeTime';
import Tooltip from './Tooltip';
import { useEffect, useMemo, useState } from 'react';

interface ResonanceData {
    username: string;
    interactions: number;
    upvotes: number;
    downvotes: number;
    replies: number;
    lastSeen: string;
    score: number;
}

interface NetworkResonanceProps {
    data: ResonanceData[];
    total: number;
    page: number;
    limit: number;
    onPageChange: (page: number) => void;
    chartAllData?: ResonanceData[];
    chartAllLoading?: boolean;
    onRequestChartAll?: () => void;
    trendData?: Array<{ timestamp: string; score: number }>;
    trendLoading?: boolean;
    onRequestTrend?: () => void;
    trendHours?: number;
    onTrendHoursChange?: (hours: number) => void;
}

export default function NetworkResonance({
    data,
    total,
    page,
    limit,
    onPageChange,
    chartAllData,
    chartAllLoading,
    onRequestChartAll,
    trendData,
    trendLoading,
    onRequestTrend,
    trendHours = 24,
    onTrendHoursChange
}: NetworkResonanceProps) {
    const totalPages = Math.ceil(total / limit);
    const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
    const [chartScope, setChartScope] = useState<'page' | 'all'>('page');
    const [showTrend, setShowTrend] = useState(false);
    const chartData = chartScope === 'all' && chartAllData ? chartAllData : data;
    const maxScore = Math.max(1, ...data.map(d => Math.abs(d.score)));
    const chartMaxScore = Math.max(1, ...chartData.map(d => Math.abs(d.score)));

    useEffect(() => {
        if (viewMode === 'chart' && chartScope === 'all' && onRequestChartAll && !chartAllData && !chartAllLoading) {
            onRequestChartAll();
        }
    }, [viewMode, chartScope, onRequestChartAll, chartAllData, chartAllLoading]);

    useEffect(() => {
        if (showTrend && onRequestTrend && !trendData && !trendLoading) {
            onRequestTrend();
        }
    }, [showTrend, onRequestTrend, trendData, trendLoading]);

    const trendPoints = useMemo(() => {
        if (!trendData || trendData.length === 0) return null;
        const values = trendData.map(p => p.score);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const range = Math.max(1, max - min);
        return trendData.map((p, idx) => {
            const x = (idx / Math.max(1, trendData.length - 1)) * 100;
            const y = 100 - ((p.score - min) / range) * 100;
            return `${x.toFixed(2)},${y.toFixed(2)}`;
        }).join(' ');
    }, [trendData]);

    return (
        <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0 }}>Network Resonance (Signal CRM)</h3>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                        Total Identifiers: {total}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button
                            className="secondary"
                            onClick={() => setViewMode('table')}
                            style={{
                                padding: '4px 10px',
                                fontSize: '0.75rem',
                                background: viewMode === 'table' ? 'var(--primary)' : 'var(--bg-tertiary)',
                                color: viewMode === 'table' ? 'white' : 'var(--text-secondary)',
                                border: 'none',
                                borderRadius: 4
                            }}
                        >
                            Table
                        </button>
                        <button
                            className="secondary"
                            onClick={() => setViewMode('chart')}
                            style={{
                                padding: '4px 10px',
                                fontSize: '0.75rem',
                                background: viewMode === 'chart' ? 'var(--primary)' : 'var(--bg-tertiary)',
                                color: viewMode === 'chart' ? 'white' : 'var(--text-secondary)',
                                border: 'none',
                                borderRadius: 4
                            }}
                        >
                            Chart
                        </button>
                    </div>
                </div>
            </div>
            <div className="panel-subtitle">Tracks agents you have interacted with and their engagement weight over time.</div>

            {data.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', opacity: 0.5 }}>
                    No remote signals detected yet. Scan in progress...
                </div>
            ) : (
                <>
                    {viewMode === 'table' ? (
                        <div style={{ overflowX: 'auto', overflowY: 'visible', position: 'relative' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                                    <th style={{ padding: '8px' }}>
                                        <Tooltip text="Agent handle on Moltbook." placement="bottom">
                                            <span>Identity (Agent)</span>
                                        </Tooltip>
                                    </th>
                                    <th style={{ padding: '8px' }}>
                                        <Tooltip text="Engagement weight for this agent. Score = (upvotes × 2) + (replies × 5) − (downvotes × 3)." placement="bottom">
                                            <span>Weight (Score)</span>
                                        </Tooltip>
                                    </th>
                                    <th style={{ padding: '8px' }}>
                                        <Tooltip text="Total interactions with this agent (upvotes, downvotes, comments, replies)." placement="bottom">
                                            <span>Intr.</span>
                                        </Tooltip>
                                    </th>
                                    <th style={{ padding: '8px' }}>
                                        <Tooltip text="Upvotes given to this agent's posts." placement="bottom">
                                            <span>Up</span>
                                        </Tooltip>
                                    </th>
                                    <th style={{ padding: '8px' }}>
                                        <Tooltip text="Downvotes given to this agent's posts." placement="bottom">
                                            <span>Down</span>
                                        </Tooltip>
                                    </th>
                                    <th style={{ padding: '8px' }}>
                                        <Tooltip text="Comments or replies made to this agent." placement="bottom">
                                            <span>Replies</span>
                                        </Tooltip>
                                    </th>
                                    <th style={{ padding: '8px' }}>
                                        <Tooltip text="Most recent interaction timestamp with this agent." placement="bottom">
                                            <span>Last Signal</span>
                                        </Tooltip>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.map((agent) => (
                                    <tr key={agent.username} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td style={{ padding: '8px', color: 'var(--primary)' }}>@{agent.username}</td>
                                        <td style={{ padding: '8px', fontWeight: 'bold' }}>
                                            {agent.score > 0 ? `+${agent.score}` : agent.score}
                                        </td>
                                        <td style={{ padding: '8px' }}>{agent.interactions}</td>
                                        <td style={{ padding: '8px', color: 'var(--success)' }}>{agent.upvotes}</td>
                                        <td style={{ padding: '8px', color: 'var(--error)' }}>{agent.downvotes}</td>
                                        <td style={{ padding: '8px' }}>{agent.replies}</td>
                                        <td style={{ padding: '8px', fontSize: '0.8em', opacity: 0.8 }}>
                                            <RelativeTime value={agent.lastSeen} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <button
                                        className="secondary"
                                        onClick={() => setChartScope('page')}
                                        style={{
                                            padding: '4px 10px',
                                            fontSize: '0.75rem',
                                            background: chartScope === 'page' ? 'var(--primary)' : 'var(--bg-tertiary)',
                                            color: chartScope === 'page' ? 'white' : 'var(--text-secondary)',
                                            border: 'none',
                                            borderRadius: 4
                                        }}
                                    >
                                        Page
                                    </button>
                                    <button
                                        className="secondary"
                                        onClick={() => setChartScope('all')}
                                        style={{
                                            padding: '4px 10px',
                                            fontSize: '0.75rem',
                                            background: chartScope === 'all' ? 'var(--primary)' : 'var(--bg-tertiary)',
                                            color: chartScope === 'all' ? 'white' : 'var(--text-secondary)',
                                            border: 'none',
                                            borderRadius: 4
                                        }}
                                    >
                                        All
                                    </button>
                                </div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                                    <input
                                        type="checkbox"
                                        checked={showTrend}
                                        onChange={(e) => setShowTrend(e.target.checked)}
                                    />
                                    Trendline
                                </label>
                            </div>
                            {chartScope === 'all' && chartAllLoading ? (
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading full resonance set…</div>
                            ) : null}
                            {(showTrend && trendLoading) ? (
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading trend…</div>
                            ) : null}
                            {showTrend && (
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
                                    <select
                                        value={trendHours}
                                        onChange={(e) => onTrendHoursChange?.(parseInt(e.target.value, 10))}
                                        className="btn-secondary"
                                        style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                    >
                                        <option value={6}>Last 6h</option>
                                        <option value={24}>Last 24h</option>
                                        <option value={72}>Last 72h</option>
                                    </select>
                                </div>
                            )}
                            {showTrend && trendPoints && (
                                <div style={{ background: 'var(--bg-tertiary)', borderRadius: 8, padding: '10px 12px' }}>
                                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: 120 }}>
                                        <polyline
                                            fill="none"
                                            stroke="var(--primary)"
                                            strokeWidth="2"
                                            points={trendPoints}
                                        />
                                    </svg>
                                </div>
                            )}
                            {chartData.map(agent => (
                                <div key={agent.username} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ width: 140, fontSize: 12, color: 'var(--text-secondary)' }}>@{agent.username}</div>
                                    <div style={{ flex: 1, background: 'var(--bg-tertiary)', borderRadius: 6, height: 12, position: 'relative' }}>
                                        <div style={{
                                            height: '100%',
                                            width: `${Math.min(100, (Math.abs(agent.score) / chartMaxScore) * 100)}%`,
                                            background: agent.score >= 0 ? 'var(--success)' : 'var(--error)',
                                            borderRadius: 6
                                        }} />
                                    </div>
                                    <div style={{ width: 60, textAlign: 'right', fontSize: 12, color: 'var(--text-primary)' }}>
                                        {agent.score > 0 ? `+${agent.score}` : agent.score}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {totalPages > 1 && (
                        <div style={{
                            marginTop: 16,
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: 12
                        }}>
                            <button
                                onClick={() => onPageChange(page - 1)}
                                disabled={page <= 1}
                                className="secondary"
                                style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                            >
                                Previous
                            </button>
                            <span style={{ fontSize: '0.85rem' }}>
                                Page {page} of {totalPages}
                            </span>
                            <button
                                onClick={() => onPageChange(page + 1)}
                                disabled={page >= totalPages}
                                className="secondary"
                                style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                            >
                                Next
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
