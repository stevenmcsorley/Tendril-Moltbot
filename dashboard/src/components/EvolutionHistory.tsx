import RelativeTime from './RelativeTime';

interface MoltEntry {
    timestamp: string;
    evolution_id?: string | null;
    rationale: string;
    delta: string;
    interpretation?: string;
}

export default function EvolutionHistory({ history }: { history: MoltEntry[] }) {
    return (
        <div className="card">
            <h3 style={{ marginBottom: 16 }}>Evolutionary "Molt" History</h3>
            <div className="panel-subtitle">Records each autonomous soul update, with rationale and the change summary.</div>
            {history.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', opacity: 0.5 }}>
                    Identity is stable. No recent molt events recorded.
                </div>
            ) : (
                <div className="timeline">
                    {history.map((entry, i) => (
                        (() => {
                            const evoLabel = entry.evolution_id ? `evo:${entry.evolution_id.split('_').pop()}` : 'evo:legacy';
                            const evoTitle = entry.evolution_id ? `Evolution ID: ${entry.evolution_id}` : 'Evolution ID unavailable';
                            return (
                        <div key={i} style={{
                            paddingLeft: '16px',
                            borderLeft: '2px solid var(--primary)',
                            marginBottom: '24px',
                            position: 'relative'
                        }}>
                            <div style={{
                                position: 'absolute',
                                left: '-9px',
                                top: '0',
                                width: '16px',
                                height: '16px',
                                borderRadius: '50%',
                                backgroundColor: 'var(--bg)',
                                border: '2px solid var(--primary)'
                            }}></div>
                            <div style={{ fontSize: '0.8em', opacity: 0.7, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <RelativeTime value={entry.timestamp} />
                                <span
                                    title={evoTitle}
                                    style={{
                                        padding: '2px 6px',
                                        borderRadius: 4,
                                        fontSize: 10,
                                        fontWeight: 600,
                                        background: 'rgba(var(--info-rgb), 0.15)',
                                        color: 'var(--info)',
                                        border: '1px solid rgba(var(--info-rgb), 0.4)'
                                    }}
                                >
                                    {evoLabel}
                                </span>
                            </div>
                            <div style={{ fontWeight: 'bold', marginBottom: 8, color: 'var(--primary)' }}>
                                Protocol Refinement: {entry.rationale.split('.')[0]}
                            </div>
                            <div style={{ fontSize: '0.9em', marginBottom: 12, fontStyle: 'italic', opacity: 0.9 }}>
                                {entry.rationale}
                            </div>
                            <div style={{ fontSize: '0.85em', marginBottom: 12, color: 'var(--info)' }}>
                                Human Interpretation: {entry.interpretation || entry.rationale}
                            </div>
                            {entry.delta && (
                                <pre style={{
                                    backgroundColor: 'rgba(0,0,0,0.3)',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    fontSize: '0.85em',
                                    border: '1px solid rgba(255,255,255,0.05)',
                                    color: 'var(--success)',
                                    overflowX: 'auto',
                                    fontFamily: 'monospace'
                                }}>
                                    <code>{entry.delta}</code>
                                </pre>
                            )}
                        </div>
                        );
                        })()
                    ))}
                </div>
            )}
        </div>
    );
}
