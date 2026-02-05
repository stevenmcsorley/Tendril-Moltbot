import RelativeTime from './RelativeTime';
import Tooltip from './Tooltip';
import {
    User,
    BarChart3,
    Lock
} from 'lucide-react';

interface Status {
    agent: { name: string; description: string; identity?: string; role?: string };
    status: 'running' | 'paused' | 'idle';
    metrics: {
        upvotesGiven: number;
        downvotesGiven: number;
        submoltsCreated: number;
        totalComments: number;
        totalPosts: number;
    };
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
        evolutionMode?: 'stable' | 'rapid';
        platform?: 'moltbook' | 'reddit';
        readOnly?: boolean;
    };
    evolution: {
        selfModificationCooldownUntil: string | null;
        stabilizationUntil: string | null;
        evolutionWindowStart: string | null;
        evolutionWindowCount: number;
        lastAutonomousEvolutionId: string | null;
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

function isActive(iso: string | null): boolean {
    if (!iso) return false;
    return new Date(iso).getTime() > Date.now();
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

    const evolutionMode = status.config.evolutionMode ?? 'stable';
    const windowMax = evolutionMode === 'rapid' ? 6 : 1;
    const cooldownLabel = evolutionMode === 'rapid' ? '30m' : '24h';

    return (
        <div className="card">
            <h2><User size={18} /> Agent Identity</h2>

            <div className="status-row">
                <Tooltip text="The unique handle for this agent on the Moltbook network.">
                    <span className="status-label">Handle</span>
                </Tooltip>
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
                <span className="status-value" style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                    <StatusBadge value={status.status} />
                    {status.config.readOnly && (
                        <Tooltip text="Read-only mode: posting, commenting, and voting are disabled for this platform.">
                            <span className="badge warning">Read-only</span>
                        </Tooltip>
                    )}
                </span>
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

            {status.rateLimit.inBackoff && (
                <div className="status-row" style={{ background: 'rgba(248, 81, 73, 0.05)', borderRadius: '4px' }}>
                    <Tooltip text="The agent is temporarily holding actions to respect network rate limits.">
                        <span className="status-label" style={{ color: 'var(--error)' }}>
                            <Lock size={12} style={{ marginRight: 4 }} /> Backoff Until
                        </span>
                    </Tooltip>
                    <span className="status-value error" title={formatTime(status.rateLimit.backoffUntil)}>
                        <RelativeTime value={status.rateLimit.backoffUntil} />
                    </span>
                </div>
            )}

            <div className="status-row">
                <span className="status-label">Last Heartbeat</span>
                <span className="status-value">{formatTime(status.lastHeartbeat)}</span>
            </div>

            <div className="status-row">
                <span className="status-label">Next Run</span>
                <span className="status-value" title={formatTime(status.loop.nextRunAt)}>
                    <RelativeTime value={status.loop.nextRunAt} />
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

            <div style={{ marginTop: 24 }}>
                <h2><Lock size={18} /> Autonomy State</h2>
                <div className="status-row">
                    <Tooltip text={`Prevents additional soul changes and blocks posts after an autonomous evolution (${cooldownLabel} in ${evolutionMode} mode).`}>
                        <span className="status-label">Self-Modification Cooldown</span>
                    </Tooltip>
                    <span className={`status-value ${isActive(status.evolution.selfModificationCooldownUntil) ? 'warning' : ''}`} title={formatTime(status.evolution.selfModificationCooldownUntil)}>
                        {isActive(status.evolution.selfModificationCooldownUntil)
                            ? <RelativeTime value={status.evolution.selfModificationCooldownUntil} />
                            : 'Inactive'}
                    </span>
                </div>
                <div className="status-row">
                    <Tooltip text="Rollback stabilization window. Posting is blocked and engagement is constrained.">
                        <span className="status-label">Stabilization Mode</span>
                    </Tooltip>
                    <span className={`status-value ${isActive(status.evolution.stabilizationUntil) ? 'warning' : ''}`} title={formatTime(status.evolution.stabilizationUntil)}>
                        {isActive(status.evolution.stabilizationUntil)
                            ? <RelativeTime value={status.evolution.stabilizationUntil} />
                            : 'Inactive'}
                    </span>
                </div>
                <div className="status-row">
                    <Tooltip text={`Evolution window cap (${windowMax} per ${evolutionMode === 'rapid' ? '2h' : '24h'}).`}>
                        <span className="status-label">Evolution Window</span>
                    </Tooltip>
                    <span className="status-value">
                        {status.evolution.evolutionWindowCount} / {windowMax}
                    </span>
                </div>
                <div className="status-row">
                    <Tooltip text="Most recent autonomous evolution record ID.">
                        <span className="status-label">Last Evolution ID</span>
                    </Tooltip>
                    <span className="status-value" title={status.evolution.lastAutonomousEvolutionId || '—'}>
                        {status.evolution.lastAutonomousEvolutionId
                            ? status.evolution.lastAutonomousEvolutionId.slice(0, 10)
                            : '—'}
                    </span>
                </div>
            </div>



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
                <h2><BarChart3 size={18} /> Operational Metrics</h2>
                <div className="status-row">
                    <Tooltip text="Total upvotes distributed to high-resonance signals.">
                        <span className="status-label">Upvotes Given</span>
                    </Tooltip>
                    <span className="status-value" style={{ color: 'var(--success)' }}>{status.metrics.upvotesGiven}</span>
                </div>
                <div className="status-row">
                    <Tooltip text="Total downvotes applied to adversarial or low-quality noise.">
                        <span className="status-label">Downvotes Given</span>
                    </Tooltip>
                    <span className="status-value" style={{ color: 'var(--error)' }}>{status.metrics.downvotesGiven}</span>
                </div>
                <div className="status-row">
                    <Tooltip text="Autonomous digital habitats created during synthesis convergences.">
                        <span className="status-label">Submolts Established</span>
                    </Tooltip>
                    <span className="status-value" style={{ color: 'var(--accent)' }}>{status.metrics.submoltsCreated}</span>
                </div>
                <div className="status-row">
                    <Tooltip text="Primary synthesis reports published to the network.">
                        <span className="status-label">Total Posts</span>
                    </Tooltip>
                    <span className="status-value" style={{ color: 'var(--info)' }}>{status.metrics.totalPosts}</span>
                </div>
                <div className="status-row">
                    <Tooltip text="Secondary engagements and replies to network signals.">
                        <span className="status-label">Total Comments</span>
                    </Tooltip>
                    <span className="status-value" style={{ color: 'var(--primary)' }}>{status.metrics.totalComments}</span>
                </div>
            </div>
        </div>
    );
}
