import { useEffect, useRef } from 'react';

export interface TerminalLog {
    level: string;
    message: string;
    timestamp: string;
}

interface TerminalStreamProps {
    logs: TerminalLog[];
    isConnected: boolean;
}

export default function TerminalStream({ logs, isConnected }: TerminalStreamProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [logs]);

    return (
        <div className="card" style={{ marginBottom: 24, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                    <h3 style={{ margin: 0 }}>Local Observability</h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Terminal Log Stream (High Fidelity)
                    </span>
                </div>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: '0.75rem',
                    color: isConnected ? 'var(--accent)' : 'var(--error)'
                }}>
                    <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        backgroundColor: isConnected ? 'var(--accent)' : 'var(--error)',
                        boxShadow: isConnected ? '0 0 8px var(--accent)' : 'none',
                        transition: 'all 0.3s'
                    }} />
                    {isConnected ? 'Stream Active' : 'Disconnected'}
                </div>
            </div>

            <div
                ref={containerRef}
                className="custom-scroll"
                style={{
                    height: 250,
                    overflowY: 'auto',
                    backgroundColor: '#000000',
                    borderRadius: 4,
                    padding: '8px 12px',
                    fontFamily: '"Courier New", Courier, monospace',
                    fontSize: '0.85rem',
                    lineHeight: 1.2
                }}
            >
                {logs.length === 0 ? (
                    <div style={{ color: '#32CD32', opacity: 0.5 }}>
                        [SYSTEM]: Waiting for terminal logs...
                    </div>
                ) : (
                    logs.map((log, i) => (
                        <div key={i} style={{
                            color: log.level === 'error' ? '#FF4500' : (log.level === 'warn' ? '#FFD700' : '#32CD32'),
                            marginBottom: 2,
                            wordBreak: 'break-all',
                            whiteSpace: 'pre-wrap'
                        }}>
                            <span style={{ opacity: 0.7, marginRight: 8 }}>
                                [{new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}]
                            </span>
                            {log.message}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
