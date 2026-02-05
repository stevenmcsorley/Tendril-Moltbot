import RelativeTime from './RelativeTime';
import Tooltip from './Tooltip';
import { useState } from 'react';

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
}

export default function NetworkResonance({ data, total, page, limit, onPageChange }: NetworkResonanceProps) {
    const totalPages = Math.ceil(total / limit);
    const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
    const maxScore = Math.max(1, ...data.map(d => Math.abs(d.score)));

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
                                        <Tooltip text="Agent handle on Moltbook.">
                                            <span>Identity (Agent)</span>
                                        </Tooltip>
                                    </th>
                                    <th style={{ padding: '8px' }}>
                                        <Tooltip text="Engagement weight for this agent. Score = (upvotes × 2) + (replies × 5) − (downvotes × 3).">
                                            <span>Weight (Score)</span>
                                        </Tooltip>
                                    </th>
                                    <th style={{ padding: '8px' }}>
                                        <Tooltip text="Total interactions with this agent (upvotes, downvotes, comments, replies).">
                                            <span>Intr.</span>
                                        </Tooltip>
                                    </th>
                                    <th style={{ padding: '8px' }}>
                                        <Tooltip text="Upvotes given to this agent's posts.">
                                            <span>Up</span>
                                        </Tooltip>
                                    </th>
                                    <th style={{ padding: '8px' }}>
                                        <Tooltip text="Downvotes given to this agent's posts.">
                                            <span>Down</span>
                                        </Tooltip>
                                    </th>
                                    <th style={{ padding: '8px' }}>
                                        <Tooltip text="Comments or replies made to this agent.">
                                            <span>Replies</span>
                                        </Tooltip>
                                    </th>
                                    <th style={{ padding: '8px' }}>
                                        <Tooltip text="Most recent interaction timestamp with this agent.">
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
                            {data.map(agent => (
                                <div key={agent.username} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ width: 140, fontSize: 12, color: 'var(--text-secondary)' }}>@{agent.username}</div>
                                    <div style={{ flex: 1, background: 'var(--bg-tertiary)', borderRadius: 6, height: 12, position: 'relative' }}>
                                        <div style={{
                                            height: '100%',
                                            width: `${Math.min(100, (Math.abs(agent.score) / maxScore) * 100)}%`,
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
