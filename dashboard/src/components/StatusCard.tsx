interface Status {
    agent: { name: string; description: string; identity?: string; role?: string };
    status: 'running' | 'paused' | 'idle';
    metrics: { upvotesGiven: number; downvotesGiven: number; submoltsCreated: number };
    llm: { provider: string; model: string; healthy: boolean };
    loop: {
        lastRunAt: string | null;
        nextRunAt: string | null;
        currentPost: string | null;
        intervalMinutes: number;
    };
    rateLimit: {
        canPost: boolean;
        canComment: boolean;
        commentsRemaining: number;
        maxCommentsPerDay: number;
        nextPostAt: string | null;
        nextCommentAt: string | null;
        inBackoff: boolean;
        backoffUntil: string | null;
    };
    config: {
        enablePosting: boolean;
        enableCommenting: boolean;
        enableUpvoting: boolean;
    };
    lastHeartbeat: string | null;
}

interface StatusCardProps {
    status: Status | null;
}

function formatTime(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString();
}

function formatRelativeTime(iso: string | null): string {
    if (!iso) return '—';
    const now = new Date();
    const target = new Date(iso);
    const diffMs = target.getTime() - now.getTime();

    if (diffMs <= 0) return 'Ready';

    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);

    if (diffHours > 0) {
        return `${diffHours}h ${diffMins % 60}m to go`;
    }
    if (diffMins > 0) {
        return `${diffMins}m ${diffSecs % 60}s to go`;
    }
    return `${diffSecs}s to go`;
}

function StatusBadge({ value }: { value: 'running' | 'paused' | 'idle' | undefined }) {
    const className = value === 'paused' ? 'paused' : value === 'running' ? 'online' : '';
    const label = value === 'running' ? '● Running' : value === 'paused' ? '⏸ Paused' : '○ Idle';
    return <span className={`status-value ${className}`}>{label}</span>;
}

export default function StatusCard({ status }: StatusCardProps) {
    if (!status) {
        return (
            <div className="card">
                <h2>Agent Status</h2>
                <div className="loading">Loading...</div>
            </div>
        );
    }

    return (
        <div className="card">
            <h2>Agent Status</h2>

            <div className="status-row">
                <span className="status-label">Agent</span>
                <span className="status-value">
                    <a href={`https://www.moltbook.com/u/${status.agent.name}`} target="_blank" rel="noopener noreferrer" className="status-link">
                        @{status.agent.name}
                    </a>
                </span>
            </div>

            {status.agent.identity && (
                <div className="status-row">
                    <span className="status-label">Identity</span>
                    <span className="status-value" style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{status.agent.identity}</span>
                </div>
            )}

            {status.agent.role && (
                <div className="status-row">
                    <span className="status-label">Role</span>
                    <span className="status-value" style={{ color: 'var(--info)', fontSize: '12px' }}>{status.agent.role}</span>
                </div>
            )}

            <div className="status-row">
                <span className="status-label">Status</span>
                <StatusBadge value={status.status} />
            </div>

            <div className="status-row">
                <span className="status-label">LLM Provider</span>
                <span className="status-value" style={{ textTransform: 'capitalize' }}>{status.llm.provider}</span>
            </div>

            <div className="status-row">
                <span className="status-label">LLM Model</span>
                <span className="status-value">{status.llm.model}</span>
            </div>

            <div className="status-row">
                <span className="status-label">LLM Status</span>
                <span className={`status-value ${status.llm.healthy ? 'online' : 'error'}`}>
                    {status.llm.healthy ? '● Connected' : '● Disconnected'}
                </span>
            </div>

            <div className="status-row">
                <span className="status-label">Last Heartbeat</span>
                <span className="status-value">{formatTime(status.lastHeartbeat)}</span>
            </div>

            <div className="status-row">
                <span className="status-label">Next Run</span>
                <span className="status-value" title={formatTime(status.loop.nextRunAt)}>
                    {formatRelativeTime(status.loop.nextRunAt)}
                </span>
            </div>

            <div className="status-row">
                <span className="status-label">Interval</span>
                <span className="status-value">{status.loop.intervalMinutes} min</span>
            </div>

            <div className="status-row">
                <span className="status-label">Comments Today</span>
                <span className="status-value">
                    {status.rateLimit.maxCommentsPerDay - status.rateLimit.commentsRemaining} / {status.rateLimit.maxCommentsPerDay}
                </span>
            </div>

            {status.rateLimit.inBackoff && (
                <div className="status-row">
                    <span className="status-label">Backoff Until</span>
                    <span className="status-value error" title={formatTime(status.rateLimit.backoffUntil)}>
                        {formatRelativeTime(status.rateLimit.backoffUntil)}
                    </span>
                </div>
            )}

            <div className="status-row">
                <span className="status-label">Capabilities</span>
                <span className="status-value">
                    {[
                        status.config.enablePosting && 'Post',
                        status.config.enableCommenting && 'Comment',
                        status.config.enableUpvoting && 'Upvote',
                    ]
                        .filter(Boolean)
                        .join(', ') || 'None'}
                </span>
            </div>

            <div style={{ marginTop: 24 }}>
                <h2>Operational Metrics</h2>
                <div className="status-row">
                    <span className="status-label">Upvotes Given</span>
                    <span className="status-value" style={{ color: 'var(--success)' }}>{status.metrics.upvotesGiven}</span>
                </div>
                <div className="status-row">
                    <span className="status-label">Downvotes Given</span>
                    <span className="status-value" style={{ color: 'var(--error)' }}>{status.metrics.downvotesGiven}</span>
                </div>
                <div className="status-row">
                    <span className="status-label">Submolts Established</span>
                    <span className="status-value" style={{ color: 'var(--accent)' }}>{status.metrics.submoltsCreated}</span>
                </div>
            </div>
        </div>
    );
}
