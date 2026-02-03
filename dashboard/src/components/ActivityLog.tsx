interface LogEntry {
    timestamp: string;
    actionType: string;
    targetId: string | null;
    targetSubmolt?: string;
    promptSent: string | null;
    rawModelOutput: string | null;
    finalAction: string;
    error?: string;
}

interface ActivityLogProps {
    entries: LogEntry[];
    currentFilter: string | undefined;
    onFilterChange: (filter: string | undefined) => void;
}

function formatTime(iso: string): string {
    const date = new Date(iso);
    return date.toLocaleTimeString();
}

function formatDate(iso: string): string {
    const date = new Date(iso);
    return date.toLocaleDateString();
}

export default function ActivityLog({ entries, currentFilter, onFilterChange }: ActivityLogProps) {
    // Group by date
    const grouped: Record<string, LogEntry[]> = {};
    for (const entry of entries) {
        const date = formatDate(entry.timestamp);
        if (!grouped[date]) grouped[date] = [];
        grouped[date].push(entry);
    }

    return (
        <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 style={{ margin: 0 }}>Activity Log</h2>
                <div className="filter-controls" style={{ display: 'flex', gap: 8 }}>
                    <button
                        onClick={() => onFilterChange(undefined)}
                        disabled={!currentFilter}
                        style={{
                            padding: '4px 8px',
                            fontSize: 12,
                            background: !currentFilter ? 'var(--primary)' : 'var(--bg-tertiary)',
                            color: !currentFilter ? 'white' : 'var(--text-secondary)',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer'
                        }}
                    >
                        All
                    </button>
                    <button
                        onClick={() => onFilterChange('comment,post')}
                        disabled={currentFilter === 'comment,post'}
                        style={{
                            padding: '4px 8px',
                            fontSize: 12,
                            background: currentFilter === 'comment,post' ? 'var(--primary)' : 'var(--bg-tertiary)',
                            color: currentFilter === 'comment,post' ? 'white' : 'var(--text-secondary)',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer'
                        }}
                    >
                        Engagements
                    </button>
                </div>
            </div>

            {entries.length === 0 ? (
                <div className="empty-state">No activity found</div>
            ) : (
                <div className="activity-log">
                    {Object.entries(grouped).map(([date, dateEntries]) => (
                        <div key={date}>
                            <div style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: 12, background: 'var(--bg-tertiary)' }}>
                                {date}
                            </div>
                            {dateEntries.map((entry, i) => (
                                <LogEntryItem key={`${entry.timestamp}-${i}`} entry={entry} />
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function LogEntryItem({ entry }: { entry: LogEntry }) {
    const hasDetails = entry.promptSent || entry.rawModelOutput;

    return (
        <div className="log-entry">
            <div className="log-header">
                <span className="log-time">{formatTime(entry.timestamp)}</span>
                <span className={`log-action ${entry.actionType}`}>{entry.actionType}</span>
                {entry.targetId && (
                    <span className="log-target">
                        {entry.targetSubmolt && `m/${entry.targetSubmolt} • `}
                        {entry.targetId.slice(0, 8)}...
                    </span>
                )}
            </div>

            <div className="log-final">{entry.finalAction}</div>

            {entry.error && <div className="log-error">Error: {entry.error}</div>}

            {hasDetails && (
                <details className="log-details">
                    <summary>View prompt & output</summary>
                    {entry.promptSent && (
                        <>
                            <strong style={{ fontSize: 11, color: 'var(--text-muted)' }}>PROMPT SENT:</strong>
                            <pre>{entry.promptSent}</pre>
                        </>
                    )}
                    {entry.rawModelOutput && (
                        <>
                            <strong style={{ fontSize: 11, color: 'var(--text-muted)' }}>RAW MODEL OUTPUT:</strong>
                            <pre>{entry.rawModelOutput}</pre>
                        </>
                    )}
                </details>
            )}
        </div>
    );
}
