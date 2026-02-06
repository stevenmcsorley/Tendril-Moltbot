import React from 'react';

interface LogEntry {
    id?: number;
    timestamp: string;
    actionType: string;
    targetId: string | null;
    targetSubmolt?: string;
    promptSent: string | null;
    rawModelOutput: string | null;
    finalAction: string;
    error?: string;
    evolutionId?: string | null;
    signalType?: string | null;
}

interface ActivityLogProps {
    entries: LogEntry[];
    agentName?: string;
    currentFilter: string | undefined;
    onFilterChange: (filter: string | undefined) => void;
    searchQuery: string;
    onSearchChange: (value: string) => void;
}

function filterBySignals(entries: LogEntry[], filter: string | undefined): LogEntry[] {
    if (!filter) return entries;
    if (filter.startsWith('signals')) {
        const raw = filter.replace(/^signals:?/i, '');
        const tags = raw
            ? raw.split(/[|,]/).map(tag => tag.trim()).filter(Boolean)
            : [];
        const signalTags = tags.length ? tags : ['ALLIANCE', 'DEFENSE', 'LINEAGE'];
        return entries.filter(entry => {
            const signalType = entry.signalType?.toUpperCase();
            if (signalType && signalTags.includes(signalType)) {
                return true;
            }
            const finalAction = (entry.finalAction || '').trim().toUpperCase();
            const promptSent = (entry.promptSent || '').trim().toUpperCase();
            return signalTags.some(tag =>
                finalAction.startsWith(`${tag}:`) || promptSent.startsWith(`[${tag}_`)
            );
        });
    }
    if (filter === 'replies') {
        return entries.filter(entry => {
            const action = (entry.actionType || '').toLowerCase();
            const finalAction = (entry.finalAction || '').toLowerCase();
            const promptSent = (entry.promptSent || '').toLowerCase();
            return (
                finalAction.includes('context=reply')
                || finalAction.includes('social engagement')
                || finalAction.includes('reply_like')
                || promptSent.startsWith('social_reply')
                || promptSent.startsWith('social_reply_upvote')
                || (action === 'comment' && finalAction.includes('replied to social engagement'))
                || (action === 'upvote' && finalAction.includes('upvoted reply'))
                || (action === 'decision' && finalAction.includes('context=reply'))
            );
        });
    }
    return entries.filter(entry => filter.split(',').includes(entry.actionType));
}

function filterBySearch(entries: LogEntry[], query: string): LogEntry[] {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return entries;
    return entries.filter(entry => {
        const fields = [
            entry.actionType,
            entry.targetId,
            entry.targetSubmolt,
            entry.promptSent,
            entry.rawModelOutput,
            entry.finalAction,
            entry.error,
            entry.evolutionId,
            entry.signalType
        ];
        return fields.some(field => field && field.toLowerCase().includes(trimmed));
    });
}

function formatTime(iso: string): string {
    const date = new Date(iso);
    return date.toLocaleTimeString();
}

function formatDate(iso: string): string {
    const date = new Date(iso);
    return date.toLocaleDateString();
}

function entryKey(entry: LogEntry): string {
    if (entry.id !== undefined && entry.id !== null) {
        return `log-${entry.id}`;
    }
    return `${entry.timestamp}-${entry.actionType}-${entry.targetId ?? 'none'}`;
}

export default function ActivityLog({ entries, agentName, currentFilter, onFilterChange, searchQuery, onSearchChange }: ActivityLogProps) {
    const [openEntries, setOpenEntries] = React.useState<Set<string>>(() => new Set());
    const visibleEntries = filterBySearch(filterBySignals(entries, currentFilter), searchQuery);

    React.useEffect(() => {
        const keys = new Set(visibleEntries.map(entryKey));
        setOpenEntries(prev => {
            const next = new Set<string>();
            for (const key of prev) {
                if (keys.has(key)) next.add(key);
            }
            return next;
        });
    }, [visibleEntries]);

    // Group by date
    const grouped: Record<string, LogEntry[]> = {};
    for (const entry of visibleEntries) {
        const date = formatDate(entry.timestamp);
        if (!grouped[date]) grouped[date] = [];
        grouped[date].push(entry);
    }

    return (
        <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 style={{ margin: 0 }}>Activity Log</h2>
                <div className="filter-controls" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(event) => onSearchChange(event.target.value)}
                        placeholder="Search logs"
                        style={{
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-primary)',
                            borderRadius: 6,
                            padding: '6px 10px',
                            fontSize: 12,
                            minWidth: 180
                        }}
                    />
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
                        onClick={() => onFilterChange('comment,post,upvote,downvote,follow,unfollow')}
                        disabled={currentFilter === 'comment,post,upvote,downvote,follow,unfollow'}
                        style={{
                            padding: '4px 8px',
                            fontSize: 12,
                            background: currentFilter === 'comment,post,upvote,downvote,follow,unfollow' ? 'var(--primary)' : 'var(--bg-tertiary)',
                            color: currentFilter === 'comment,post,upvote,downvote,follow,unfollow' ? 'white' : 'var(--text-secondary)',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer'
                        }}
                    >
                        Engagements
                    </button>
                    <button
                        onClick={() => onFilterChange('decision')}
                        disabled={currentFilter === 'decision'}
                        style={{
                            padding: '4px 8px',
                            fontSize: 12,
                            background: currentFilter === 'decision' ? 'var(--primary)' : 'var(--bg-tertiary)',
                            color: currentFilter === 'decision' ? 'white' : 'var(--text-secondary)',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer'
                        }}
                    >
                        Decisions
                    </button>
                    <button
                        onClick={() => onFilterChange('replies')}
                        disabled={currentFilter === 'replies'}
                        style={{
                            padding: '4px 8px',
                            fontSize: 12,
                            background: currentFilter === 'replies' ? 'var(--primary)' : 'var(--bg-tertiary)',
                            color: currentFilter === 'replies' ? 'white' : 'var(--text-secondary)',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer'
                        }}
                    >
                        Replies
                    </button>
                    <button
                        onClick={() => onFilterChange('signals')}
                        disabled={currentFilter === 'signals'}
                        style={{
                            padding: '4px 8px',
                            fontSize: 12,
                            background: currentFilter === 'signals' ? 'var(--primary)' : 'var(--bg-tertiary)',
                            color: currentFilter === 'signals' ? 'white' : 'var(--text-secondary)',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer'
                        }}
                    >
                        Signals
                    </button>
                </div>
            </div>

            {visibleEntries.length === 0 ? (
                <div className="empty-state">No activity found</div>
            ) : (
                <div className="activity-log custom-scroll">
                    {Object.entries(grouped).map(([date, dateEntries]) => (
                        <div key={date}>
                            <div style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: 12, background: 'var(--bg-tertiary)' }}>
                                {date}
                            </div>
                            {dateEntries.map((entry, i) => (
                                <LogEntryItem
                                    key={entryKey(entry)}
                                    entry={entry}
                                    agentName={agentName}
                                    isOpen={openEntries.has(entryKey(entry))}
                                    onToggle={(open) => {
                                        setOpenEntries(prev => {
                                            const next = new Set(prev);
                                            const key = entryKey(entry);
                                            if (open) {
                                                next.add(key);
                                            } else {
                                                next.delete(key);
                                            }
                                            return next;
                                        });
                                    }}
                                />
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function LogEntryItem({
    entry,
    agentName,
    isOpen,
    onToggle
}: {
    entry: LogEntry;
    agentName?: string;
    isOpen: boolean;
    onToggle: (open: boolean) => void;
}) {
    const hasDetails = entry.promptSent || entry.rawModelOutput;
    const evolutionLabel = entry.evolutionId ? `evo:${entry.evolutionId.split('_').pop()}` : 'evo:seed';
    const evolutionTitle = entry.evolutionId
        ? `Evolution ID: ${entry.evolutionId}`
        : 'No evolutions yet (default soul)';
    const tagSource = `${entry.finalAction || ''} ${entry.promptSent || ''}`;
    const normalizedSignal = entry.signalType ? entry.signalType.toUpperCase() : null;
    const inferredSignal = normalizedSignal
        ? null
        : tagSource.trim().toUpperCase().startsWith('ALLIANCE:')
            ? 'ALLIANCE'
            : tagSource.trim().toUpperCase().startsWith('DEFENSE:')
                ? 'DEFENSE'
                : tagSource.trim().toUpperCase().startsWith('LINEAGE:')
                    ? 'LINEAGE'
                    : null;
    const tags = (normalizedSignal || inferredSignal) ? [normalizedSignal || inferredSignal] : [];
    const signalDetail = (entry.finalAction || entry.promptSent || '').trim();
    const signalTooltip = tags.length && signalDetail
        ? `Signal: ${signalDetail}`
        : undefined;
    const signalSummary = tags.length && entry.finalAction
        ? entry.finalAction.replace(new RegExp(`^${tags[0]}:\\s*`, 'i'), '').trim()
        : null;

    return (
        <div className="log-entry" style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
            <div className="log-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className="log-time" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatTime(entry.timestamp)}</span>
                    <span className={`log-action ${entry.actionType}`} style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        background: `rgba(var(--${entry.actionType}-rgb), 0.1)`,
                        color: `var(--${entry.actionType})`
                    }}>{entry.actionType}</span>
                    <span
                        title={evolutionTitle}
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
                        {evolutionLabel}
                    </span>
                    {tags.map(tag => (
                        <span
                            key={tag}
                            title={signalTooltip}
                            style={{
                                padding: '2px 6px',
                                borderRadius: 4,
                                fontSize: 10,
                                fontWeight: 700,
                                background: tag === 'DEFENSE'
                                    ? 'rgba(var(--error-rgb), 0.15)'
                                    : tag === 'ALLIANCE'
                                        ? 'rgba(var(--info-rgb), 0.15)'
                                        : 'rgba(var(--success-rgb), 0.15)',
                                color: tag === 'DEFENSE'
                                    ? 'var(--error)'
                                    : tag === 'ALLIANCE'
                                        ? 'var(--info)'
                                        : 'var(--success)',
                                border: tag === 'DEFENSE'
                                    ? '1px solid rgba(var(--error-rgb), 0.4)'
                                    : tag === 'ALLIANCE'
                                        ? '1px solid rgba(var(--info-rgb), 0.4)'
                                        : '1px solid rgba(var(--success-rgb), 0.4)'
                            }}
                        >
                            {tag}
                        </span>
                    ))}
                </div>
                {entry.targetId && (
                    <span className="log-target" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {entry.targetSubmolt && `m/${entry.targetSubmolt} • `}
                        {entry.targetId.slice(0, 8)}
                    </span>
                )}
            </div>
            {tags.length > 0 && signalSummary && (
                <div style={{ marginBottom: 10, fontSize: 11, color: 'var(--text-muted)' }}>
                    Signal: {signalSummary}
                </div>
            )}

            <div className="log-final-block" style={{
                background: 'rgba(63, 185, 80, 0.05)',
                borderLeft: '4px solid #3fb950',
                padding: '12px',
                borderRadius: '0 4px 4px 0',
                marginBottom: 12
            }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#3fb950', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.05em' }}>
                    Final Action
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>
                    {entry.finalAction}
                </div>
            </div>

            {entry.error && (
                <div className="log-error" style={{ color: 'var(--error)', fontSize: 12, marginBottom: 12 }}>
                    <strong>Error:</strong> {entry.error}
                </div>
            )}

            {hasDetails && (
                <details
                    className="log-details"
                    open={isOpen}
                    onToggle={(e) => onToggle((e.currentTarget as HTMLDetailsElement).open)}
                >
                    <summary style={{ fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
                        View internal reasoning & prompt
                    </summary>
                    <div className="engagement-details" style={{ marginTop: 16 }}>
                        <div className="prompt-section" style={{ marginBottom: 12 }}>
                            <div className="prompt-label">EVOLUTION ITERATION</div>
                            <pre className="prompt-pre">{entry.evolutionId ?? 'seed'}</pre>
                        </div>
                        {entry.promptSent && (
                            <div className="prompt-section">
                                {entry.promptSent.includes('### ') ? (
                                    entry.promptSent.split('### ').filter(Boolean).map((section, idx) => {
                                        const [title, ...content] = section.split('\n');
                                        return (
                                            <div key={idx} className="prompt-content-block" style={{ marginBottom: 12 }}>
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
                            <div className="output-section" style={{ marginTop: 16 }}>
                                <div className="prompt-label">RAW MODEL OUTPUT - {agentName || 'Agent'} - Inner Monologue</div>
                                <pre className="output-pre">{entry.rawModelOutput}</pre>
                            </div>
                        )}
                        <div className="final-execution-section" style={{ marginTop: 16 }}>
                            <div className="prompt-label" style={{ color: 'var(--success)' }}>FINAL ACTION EXECUTED</div>
                            <pre className="execution-pre" style={{ borderLeft: '2px solid var(--success)' }}>{entry.finalAction}</pre>
                        </div>
                    </div>
                </details>
            )}
        </div>
    );
}
