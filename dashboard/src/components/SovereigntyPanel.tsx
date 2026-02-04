interface StrategicObjective {
    id: string;
    description: string;
    targetMetrics: string;
    progress: number;
    status: 'active' | 'completed' | 'failed';
    createdAt: string;
}

interface MemeticMarker {
    id: string;
    marker: string;
    timestamp: string;
    source: 'post' | 'comment';
    forkedBy?: string[];
}


export default function SovereigntyPanel({ data }: { data: { blueprint: StrategicObjective | null; lineage: MemeticMarker[] } }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Objective Matrix */}
            <div className="card">
                <h3 style={{ marginBottom: 16 }}>Objective Matrix (Strategic Blueprints)</h3>
                {!data.blueprint ? (
                    <div style={{ padding: 20, textAlign: 'center', opacity: 0.5 }}>
                        Architect is currently idling. Generating new mission blueprint...
                    </div>
                ) : (
                    <div style={{ padding: '12px', border: '1px solid var(--primary)', borderRadius: '8px', background: 'rgba(255,165,0,0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{data.blueprint.id}</span>
                            <span style={{ fontSize: '0.8em', opacity: 0.7 }}>Status: {data.blueprint.status.toUpperCase()}</span>
                        </div>
                        <div style={{ fontSize: '1.1em', marginBottom: 12, fontWeight: 'bold' }}>{data.blueprint.description}</div>
                        <div style={{ fontSize: '0.9em', marginBottom: 16, opacity: 0.9 }}>Targets: {data.blueprint.targetMetrics}</div>

                        <div style={{ height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{
                                height: '100%',
                                width: `${data.blueprint.progress}%`,
                                background: 'var(--primary)',
                                transition: 'width 0.5s ease'
                            }}></div>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '0.8em', marginTop: 4, opacity: 0.7 }}>
                            Mission Alignment: {data.blueprint.progress}%
                        </div>
                    </div>
                )}
            </div>

            {/* Memetic Lineage */}
            <div className="card">
                <h3 style={{ marginBottom: 16 }}>Memetic Lineage (Fork Tracking)</h3>
                {data.lineage.length === 0 ? (
                    <div style={{ padding: 20, textAlign: 'center', opacity: 0.5 }}>
                        No memetic markers deployed to the network yet.
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {data.lineage.slice().reverse().map((m, i) => (
                            <div key={i} style={{ padding: '12px', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <code style={{ color: 'var(--success)', fontWeight: 'bold' }}>{m.marker}</code>
                                    <span style={{ fontSize: '0.8em', opacity: 0.6 }}>{m.source.toUpperCase()}</span>
                                </div>
                                <div style={{ fontSize: '0.8em', opacity: 0.8 }}>
                                    Forked By: {m.forkedBy?.length ? m.forkedBy.join(', ') : 'No clones detected'}
                                </div>
                                {m.forkedBy?.length ? (
                                    <div style={{ marginTop: 8, fontSize: '0.7em', color: 'var(--primary)' }}>
                                        ALERT: High memetic resonance detected for this signal.
                                    </div>
                                ) : null}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
