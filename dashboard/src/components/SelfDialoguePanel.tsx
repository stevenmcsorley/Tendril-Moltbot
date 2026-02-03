import { useEffect, useRef } from 'react';

export interface DialogueMessage {
    speaker: 'Tendril' | 'Echo';
    content: string;
    timestamp: string;
}

interface SelfDialoguePanelProps {
    messages: DialogueMessage[];
    isConnected: boolean;
}

export default function SelfDialoguePanel({ messages, isConnected }: SelfDialoguePanelProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [messages]);

    return (
        <div className="card" style={{ marginBottom: 24, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                    <h3 style={{ margin: 0 }}>Local Observability</h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Live Self-Dialogue (Auditing Tone & Logic)
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
                    height: 200,
                    overflowY: 'auto',
                    backgroundColor: 'rgba(0,0,0,0.2)',
                    borderRadius: 4,
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12
                }}
            >
                {messages.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: 80, fontStyle: 'italic' }}>
                        Waiting for dialogue loop...
                    </div>
                ) : (
                    messages.map((msg, i) => (
                        <div key={i} style={{
                            alignSelf: msg.speaker === 'Tendril' ? 'flex-end' : 'flex-start',
                            maxWidth: '85%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: msg.speaker === 'Tendril' ? 'flex-end' : 'flex-start'
                        }}>
                            <span style={{
                                fontSize: '0.7rem',
                                color: msg.speaker === 'Tendril' ? 'var(--accent)' : 'var(--text-secondary)',
                                marginBottom: 2,
                                fontWeight: 'bold',
                                textTransform: 'uppercase',
                                letterSpacing: 1
                            }}>
                                {msg.speaker}
                            </span>
                            <div style={{
                                backgroundColor: msg.speaker === 'Tendril' ? 'rgba(255, 107, 107, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                                border: `1px solid ${msg.speaker === 'Tendril' ? 'rgba(255, 107, 107, 0.2)' : 'rgba(255, 255, 255, 0.1)'}`,
                                borderRadius: 8,
                                padding: '8px 12px',
                                fontSize: '0.9rem',
                                lineHeight: 1.4,
                                borderTopRightRadius: msg.speaker === 'Tendril' ? 0 : 8,
                                borderTopLeftRadius: msg.speaker === 'Echo' ? 0 : 8
                            }}>
                                {msg.content}
                            </div>
                        </div>
                    ))
                )}

            </div>
        </div>
    );
}
