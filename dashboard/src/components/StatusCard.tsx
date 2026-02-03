interface Status {
    agent: { name: string; description: string };
    status: 'running' | 'paused' | 'idle';
    ollama: { model: string; healthy: boolean; baseUrl: string };
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
                        {status.agent.name}
                    </a>
                </span>
            </div>

            <div className="status-row">
                <span className="status-label">Status</span>
                <StatusBadge value={status.status} />
            </div>

            <div className="status-row">
                <span className="status-label">Ollama Model</span>
                <span className="status-value">{status.ollama.model}</span>
            </div>

            <div className="status-row">
                <span className="status-label">Ollama</span>
                <span className={`status-value ${status.ollama.healthy ? 'online' : 'error'}`}>
                    {status.ollama.healthy ? '● Connected' : '● Disconnected'}
                </span>
            </div>

            <div className="status-row">
                <span className="status-label">Last Heartbeat</span>
                <span className="status-value">{formatTime(status.lastHeartbeat)}</span>
            </div>

            <div className="status-row">
                <span className="status-label">Next Run</span>
                <span className="status-value">{formatTime(status.loop.nextRunAt)}</span>
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
                    <span className="status-value error">{formatTime(status.rateLimit.backoffUntil)}</span>
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
        </div>
    );
}
