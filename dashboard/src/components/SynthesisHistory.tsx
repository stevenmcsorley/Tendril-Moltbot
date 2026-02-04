import type { SynthesisReport } from '../../../src/agent/synthesis';
import Tooltip from './Tooltip';

interface SynthesisHistoryProps {
    history: SynthesisReport[];
}

export default function SynthesisHistory({ history }: SynthesisHistoryProps) {
    if (history.length === 0) {
        return (
            <div className="card">
                <h2>
                    Memetic Synthesis Archive
                    <Tooltip text="Summaries of clustered memories. Each report compresses recent signal convergence into a compact theme and a synthesis payload.">
                        <span style={{ marginLeft: 6, cursor: 'help' }}>ⓘ</span>
                    </Tooltip>
                </h2>
                <div className="panel-subtitle">Periodic clustering of recent memories into a condensed convergence report.</div>
                <div className="empty-state">No synthesis reports generated yet. Density threshold not reached.</div>
            </div>
        );
    }

    return (
        <div className="card">
            <h2>
                Memetic Synthesis Archive
                <Tooltip text="Summaries of clustered memories. Each report compresses recent signal convergence into a compact theme and a synthesis payload.">
                    <span style={{ marginLeft: 6, cursor: 'help' }}>ⓘ</span>
                </Tooltip>
            </h2>
            <div className="panel-subtitle">Periodic clustering of recent memories into a condensed convergence report.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {history.map((report, idx) => (
                    <div key={idx} style={{
                        padding: 16,
                        background: 'var(--bg-tertiary)',
                        borderRadius: 6,
                        border: '1px solid var(--border)',
                        position: 'relative'
                    }}>
                        <div style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 8, fontFamily: 'monospace' }}>
                            SIGNAL_TIMESTAMP: {new Date(report.timestamp).toLocaleString()}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: 12 }}>
                            SUMMARY: <span className="synthesis-summary">{report.summary}</span>
                        </div>
                        <div style={{
                            fontSize: 13,
                            color: 'var(--text-secondary)',
                            background: 'var(--bg-primary)',
                            padding: 12,
                            borderRadius: 4,
                            marginBottom: 12,
                            fontFamily: 'monospace',
                            borderLeft: '2px solid var(--accent)'
                        }} className="synthesis-report">
                            {report.report}
                        </div>

                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            <div style={{ marginBottom: 4 }}>CONVERGENCE_CLUSTERS:</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {report.clusters.map((cluster, cIdx) => (
                                    <div key={cIdx} style={{
                                        background: 'rgba(0, 255, 255, 0.05)',
                                        padding: '4px 8px',
                                        borderRadius: 4,
                                        fontSize: 10,
                                        border: '1px solid rgba(0, 255, 255, 0.1)'
                                    }}>
                                        {cluster.count}x signals → {cluster.center.substring(0, 30)}...
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
