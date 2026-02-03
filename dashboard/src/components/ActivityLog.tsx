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
    agentName?: string;
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

export default function ActivityLog({ entries, agentName, currentFilter, onFilterChange }: ActivityLogProps) {
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
                                <LogEntryItem key={`${entry.timestamp}-${i}`} entry={entry} agentName={agentName} />
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function LogEntryItem({ entry, agentName }: { entry: LogEntry; agentName?: string }) {
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

            <div className="log-final" style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 4, borderLeft: '2px solid var(--accent)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>RESULT</div>
                <div style={{ fontSize: 13 }}>{entry.finalAction}</div>
            </div>

            {entry.error && <div className="log-error">Error: {entry.error}</div>}

            {hasDetails && (
                <details className="log-details">
                    <summary>View prompt & output</summary>
                    <div className="engagement-details">
                        {entry.promptSent && (
                            <div className="prompt-section">
                                {entry.promptSent.includes('### ') ? (
                                    entry.promptSent.split('### ').filter(Boolean).map((section, idx) => {
                                        const [title, ...content] = section.split('\n');
                                        return (
                                            <div key={idx} className="prompt-content-block">
                                                <div className="prompt-label">{title}</div>
                                                <pre className="prompt-pre">{content.join('\n').trim()}</pre>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <>
                                        <div className="prompt-label">PROMPT SENT</div>
                                        <pre className="prompt-pre">{entry.promptSent}</pre>
                                    </>
                                )}
                            </div>
                        )}
                        {entry.rawModelOutput && (
                            <div className="output-section">
                                <div className="prompt-label">RAW MODEL OUTPUT - {agentName || 'Agent'} - Inner Monologue</div>
                                <pre className="output-pre">{entry.rawModelOutput}</pre>
                            </div>
                        )}
                        <div className="execution-section">
                            <div className="prompt-label">FINAL EXECUTION</div>
                            <pre className="execution-pre">{entry.finalAction}</pre>
                        </div>
                    </div>
                </details>
            )}
        </div>
    );
}
