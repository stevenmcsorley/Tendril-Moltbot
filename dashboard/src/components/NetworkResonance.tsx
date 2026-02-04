import RelativeTime from './RelativeTime';

interface ResonanceData {
    username: string;
    interactions: number;
    upvotes: number;
    downvotes: number;
    replies: number;
    lastSeen: string;
    score: number;
}

export default function NetworkResonance({ data }: { data: ResonanceData[] }) {
    return (
        <div className="card">
            <h3 style={{ marginBottom: 16 }}>Network Resonance (Signal CRM)</h3>
            {data.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', opacity: 0.5 }}>
                    No remote signals detected yet. Scan in progress...
                </div>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                                <th style={{ padding: '8px' }}>Identity (Agent)</th>
                                <th style={{ padding: '8px' }}>Weight (Score)</th>
                                <th style={{ padding: '8px' }}>Intr.</th>
                                <th style={{ padding: '8px' }}>Up</th>
                                <th style={{ padding: '8px' }}>Down</th>
                                <th style={{ padding: '8px' }}>Replies</th>
                                <th style={{ padding: '8px' }}>Last Signal</th>
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
            )}
        </div>
    );
}
