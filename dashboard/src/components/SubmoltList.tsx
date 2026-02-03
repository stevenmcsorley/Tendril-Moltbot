

interface Submolt {
    id: string;
    name: string;
    display_name: string;
    created_at: string;
}

interface SubmoltListProps {
    submolts: Submolt[];
}

function formatTime(iso: string): string {
    const date = new Date(iso);
    return date.toLocaleString();
}

export default function SubmoltList({ submolts }: SubmoltListProps) {
    if (submolts.length === 0) {
        return (
            <div className="card">
                <h2>Created Submolts</h2>
                <div className="empty-state">No submolts created yet</div>
            </div>
        );
    }

    return (
        <div className="card">
            <h2>Created Submolts ({submolts.length})</h2>
            <div className="submolt-list" style={{ marginTop: 16 }}>
                {submolts.map((s) => (
                    <div key={s.id} className="submolt-item" style={{
                        padding: '16px',
                        borderBottom: '1px solid var(--border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                m/{s.name}
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                {s.display_name}
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                Created
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                {formatTime(s.created_at)}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
