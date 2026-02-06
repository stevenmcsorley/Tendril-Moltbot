import { useState, useEffect, useCallback, useRef } from 'react';
import StatusCard from './components/StatusCard';
import ActivityLog from './components/ActivityLog';
import Controls from './components/Controls';
import SubmoltList from './components/SubmoltList';
import SelfDialoguePanel, { TerminalLog } from './components/SelfDialoguePanel';
import MyPosts from './components/MyPosts';
import DataManagement from './components/DataManagement';
import NetworkResonance from './components/NetworkResonance';
import EvolutionHistory from './components/EvolutionHistory';
import SovereigntyPanel from './components/SovereigntyPanel';
import SynthesisHistory from './components/SynthesisHistory';
import SoulPanel from './components/SoulPanel';
import Tooltip from './components/Tooltip';
import RelativeTime from './components/RelativeTime';
import {
    Activity,
    Zap,
    ListFilter,
    Layers,
    FileText,
    Cpu,
    Database,
    ShieldAlert
} from 'lucide-react';

interface Status {
    agent: { name: string; description: string; handle?: string; identity?: string; role?: string };
    status: 'running' | 'paused' | 'idle';
    metrics: {
        upvotesGiven: number;
        downvotesGiven: number;
        followsGiven: number;
        unfollowsGiven: number;
        followsActive: number;
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
        enableFollowing?: boolean;
        enableUnfollowing?: boolean;
        platform?: 'moltbook' | 'reddit' | 'discord' | 'slack' | 'telegram' | 'matrix' | 'bluesky' | 'mastodon' | 'discourse';
        readOnly?: boolean;
    };
    evolution: {
        selfModificationCooldownUntil: string | null;
        stabilizationUntil: string | null;
        evolutionWindowStart: string | null;
        evolutionWindowCount: number;
        lastAutonomousEvolutionId: string | null;
        readiness: {
            activityWeight: number;
            nudgeThreshold: number;
            fullThreshold: number;
            dueForNudge: boolean;
            hoursSinceLast: number | null;
            minHoursBetween: number;
            windowRemaining: number;
            selfModificationCooldownActive: boolean;
            stabilizationActive: boolean;
            eligible: boolean;
        };
    };
    lastHeartbeat: string | null;
}

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

interface LogsResponse {
    entries: LogEntry[];
    total: number;
}

interface Submolt {
    id: string;
    name: string;
    display_name: string;
    created_at: string;
}

interface SubmoltsResponse {
    success: boolean;
    submolts: Submolt[];
}

interface DataStats {
    counts: {
        activity: number;
        memories: number;
        topology: number;
        evolutions: number;
        autonomousEvolutions: number;
        soulSnapshots: number;
        synthesis: number;
        posts: number;
        comments: number;
        sovereignty: number;
        kvState: number;
    };
    dbSizeBytes: number;
    lastWipeAt: string | null;
}

interface ResonanceData {
    username: string;
    interactions: number;
    upvotes: number;
    downvotes: number;
    replies: number;
    lastSeen: string;
    score: number;
    isAgent?: boolean;
    isLinked?: boolean;
    handshakeStep?: 'none' | 'detected' | 'requested' | 'established';
    isQuarantined?: boolean;
}

interface EvolutionEntry {
    timestamp: string;
    evolution_id?: string | null;
    rationale: string;
    delta: string;
    interpretation?: string;
}

interface AutonomyState {
    selfModificationCooldownUntil: string | null;
    stabilizationUntil: string | null;
    synthesisCooldownUntil?: string | null;
    synthesisCooldownActive?: boolean;
    evolutionWindowStart: string | null;
    evolutionWindowCount: number;
    lastAutonomousEvolutionId: string | null;
    readiness?: {
        activityWeight: number;
        nudgeThreshold: number;
        fullThreshold: number;
        dueForNudge: boolean;
        hoursSinceLast: number | null;
        minHoursBetween: number;
        windowRemaining: number;
        windowMax: number;
        selfModificationCooldownHours: number;
        mode: 'stable' | 'rapid';
        selfModificationCooldownActive: boolean;
        stabilizationActive: boolean;
        eligible: boolean;
    };
}

interface StrategicObjective {
    id: string;
    description: string;
    interpretation?: string;
    targetMetrics: string;
    progress: number;
    status: 'active' | 'completed' | 'failed';
    createdAt: string;
}

interface MemeticMarker {
    id: string;
    marker: string;
    timestamp: string;
    source: 'post' | 'comment';
    forkedBy?: string[];
    interpretation?: string;
}

export default function App() {
    const [status, setStatus] = useState<Status | null>(null);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [submolts, setSubmolts] = useState<Submolt[]>([]);
    const [terminalLogs, setTerminalLogs] = useState<TerminalLog[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
    const [filterType, setFilterType] = useState<string | undefined>(undefined);
    const [activeTab, setActiveTab] = useState<'logs' | 'submolts' | 'posts' | 'intelligence' | 'soul_mgmt' | 'data'>('logs');
    const [isWsConnected, setIsWsConnected] = useState(false);
    const [topology, setTopology] = useState<ResonanceData[]>([]);
    const [topologyPage, setTopologyPage] = useState(1);
    const [topologyTotal, setTopologyTotal] = useState(0);
    const topologyLimit = 10;
    const [topologyChart, setTopologyChart] = useState<ResonanceData[] | null>(null);
    const [topologyChartLoading, setTopologyChartLoading] = useState(false);
    const [resonanceTrend, setResonanceTrend] = useState<Array<{ timestamp: string; score: number }> | null>(null);
    const [resonanceTrendLoading, setResonanceTrendLoading] = useState(false);
    const [resonanceTrendHours, setResonanceTrendHours] = useState(24);
    const [evolutionHistory, setEvolutionHistory] = useState<EvolutionEntry[]>([]);
    const [evolutionPage, setEvolutionPage] = useState(1);
    const [evolutionTotal, setEvolutionTotal] = useState(0);
    const evolutionLimit = 6;
    const [autonomyState, setAutonomyState] = useState<AutonomyState | null>(null);
    const [synthesisHistory, setSynthesisHistory] = useState<any[]>([]);
    const [synthesisPage, setSynthesisPage] = useState(1);
    const [synthesisTotal, setSynthesisTotal] = useState(0);
    const synthesisLimit = 4;
    const [autonomousPostTarget, setAutonomousPostTarget] = useState<string>('general');
    const [autonomousPosting, setAutonomousPosting] = useState(false);
    const [forceAutonomousPost, setForceAutonomousPost] = useState(false);
    const [myPostsRefreshToken, setMyPostsRefreshToken] = useState(0);
    const [sovereignty, setSovereignty] = useState<{
        blueprint: StrategicObjective | null;
        lineage: MemeticMarker[];
        metrics?: {
            structural: number;
            signalQuality: number;
            missionAlignment: number;
            raw: {
                nodes: number;
                submolts: number;
                posts: number;
                comments: number;
                upvotes: number;
                downvotes: number;
                replies: number;
                interactions: number;
                precision: number;
                resonanceRatio: number;
            };
        };
    }>({ blueprint: null, lineage: [] });
    const [soulRefreshToken, setSoulRefreshToken] = useState(0);
    const [hubMessage, setHubMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
    const [dataStats, setDataStats] = useState<DataStats | null>(null);

    // WebSocket reference + pagination refs
    const wsRef = useRef<WebSocket | null>(null);
    const evolutionPageRef = useRef(1);
    const synthesisPageRef = useRef(1);

    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch('/api/status');
            if (!res.ok) throw new Error('Failed to fetch status');
            const data = await res.json();
            setStatus(data);
            setAutonomyState(data.evolution ?? null);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        }
    }, []);

    const fetchDataStats = useCallback(async () => {
        try {
            const res = await fetch('/api/data-stats');
            if (!res.ok) throw new Error('Failed to fetch data stats');
            const data = await res.json();
            setDataStats(data);
        } catch (err) {
            console.error('Failed to fetch data stats:', err);
        }
    }, []);

    const fetchLogs = useCallback(async (options?: { limit?: number; type?: string }) => {
        try {
            const limit = options?.limit ?? 300;
            const params = new URLSearchParams({ limit: String(limit) });
            if (options?.type) params.set('type', options.type);
            const res = await fetch(`/api/logs?${params.toString()}`);
            if (!res.ok) throw new Error('Failed to fetch logs');
            const data: LogsResponse = await res.json();
            setLogs(data.entries);
        } catch (err) {
            console.error('Failed to fetch logs:', err);
        }
    }, []);

    const fetchSubmolts = useCallback(async () => {
        try {
            const res = await fetch('/api/submolts');
            if (!res.ok) throw new Error('Failed to fetch submolts');
            const data: SubmoltsResponse = await res.json();
            setSubmolts(data.submolts);
        } catch (err) {
            console.error('Failed to fetch submolts:', err);
        }
    }, []);

    const fetchTopology = useCallback(async (page: number = 1) => {
        try {
            const offset = (page - 1) * topologyLimit;
            const res = await fetch(`/api/network-topology?limit=${topologyLimit}&offset=${offset}`);
            const data = await res.json();
            if (data.success) {
                setTopology(data.topology);
                setTopologyTotal(data.total);
                setTopologyPage(page);
            }
        } catch (err) {
            console.error('Failed to fetch topology:', err);
        }
    }, []);

    const fetchTopologyAll = useCallback(async () => {
        if (topologyChartLoading) return;
        try {
            setTopologyChartLoading(true);
            const limit = Math.max(topologyTotal, 100);
            const res = await fetch(`/api/network-topology?limit=${limit}&offset=0`);
            const data = await res.json();
            if (data.success) {
                setTopologyChart(data.topology);
            }
        } catch (err) {
            console.error('Failed to fetch full topology:', err);
        } finally {
            setTopologyChartLoading(false);
        }
    }, [topologyTotal, topologyChartLoading]);

    const fetchResonanceTrend = useCallback(async (hours: number = resonanceTrendHours) => {
        if (resonanceTrendLoading) return;
        try {
            setResonanceTrendLoading(true);
            const res = await fetch(`/api/network-resonance/trend?hours=${hours}`);
            const data = await res.json();
            if (data.success) {
                setResonanceTrend(data.points);
            }
        } catch (err) {
            console.error('Failed to fetch resonance trend:', err);
        } finally {
            setResonanceTrendLoading(false);
        }
    }, [resonanceTrendLoading, resonanceTrendHours]);

    const fetchEvolution = useCallback(async (page: number = 1) => {
        try {
            const offset = (page - 1) * evolutionLimit;
            const res = await fetch(`/api/evolution/history?limit=${evolutionLimit}&offset=${offset}`);
            const data = await res.json();
            if (data.success) {
                setEvolutionHistory(data.history);
                setEvolutionTotal(data.total ?? data.history?.length ?? 0);
                setEvolutionPage(page);
                evolutionPageRef.current = page;
            }
        } catch (err) {
            console.error('Failed to fetch evolution:', err);
        }
    }, []);

    const fetchSynthesis = useCallback(async (page: number = 1) => {
        try {
            const offset = (page - 1) * synthesisLimit;
            const res = await fetch(`/api/synthesis/history?limit=${synthesisLimit}&offset=${offset}`);
            const data = await res.json();
            if (data.success) {
                setSynthesisHistory(data.history);
                setSynthesisTotal(data.total ?? data.history?.length ?? 0);
                setSynthesisPage(page);
                synthesisPageRef.current = page;
            }
        } catch (err) {
            console.error('Failed to fetch synthesis:', err);
        }
    }, []);

    const fetchSovereignty = useCallback(async () => {
        try {
            const res = await fetch('/api/sovereignty');
            const data = await res.json();
            if (data.success) {
                setSovereignty({ blueprint: data.blueprint, lineage: data.lineage, metrics: data.metrics });
            }
        } catch (err) {
            console.error('Failed to fetch sovereignty:', err);
        }
    }, []);

    useEffect(() => {
        const available = new Set(['general', ...submolts.map(s => s.name)]);
        if (!available.has(autonomousPostTarget)) {
            setAutonomousPostTarget('general');
        }
    }, [submolts, autonomousPostTarget]);

    const handleForceBlueprint = async () => {
        setHubMessage(null);
        try {
            const res = await fetch('/api/control/blueprint', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                setHubMessage({
                    type: 'success',
                    text: `Blueprint generated: ${data.blueprint?.id || 'OK'}`
                });
                fetchSovereignty();
            } else {
                setHubMessage({ type: 'error', text: data.error || 'Failed to generate blueprint.' });
            }
        } catch (err) {
            setHubMessage({ type: 'error', text: 'Blueprint trigger failed.' });
        }
    };

    const handleForceSynthesis = async () => {
        setHubMessage(null);
        try {
            const res = await fetch('/api/control/synthesis', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                if (!data.generated) {
                    setHubMessage({ type: 'info', text: data.message || 'Insufficient memetic density.' });
                } else {
                    setHubMessage({ type: 'success', text: 'Synthesis report generated.' });
                }
                fetchSynthesis(synthesisPageRef.current);
            } else {
                setHubMessage({ type: 'error', text: data.error || 'Failed to run synthesis.' });
            }
        } catch (err) {
            setHubMessage({ type: 'error', text: 'Synthesis trigger failed.' });
        }
    };

    const handleAutonomousPost = async () => {
        setAutonomousPosting(true);
        setHubMessage(null);
        try {
            const res = await fetch('/api/control/autonomous-post', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ submolt: autonomousPostTarget, force: forceAutonomousPost })
            });
            const data = await res.json();
            if (data.success) {
                setHubMessage({ type: 'success', text: data.message || 'Autonomous post triggered.' });
            } else {
                setHubMessage({ type: 'error', text: data.message || 'Autonomous post failed.' });
            }
        } catch (err) {
            setHubMessage({ type: 'error', text: 'Autonomous post trigger failed.' });
        } finally {
            setAutonomousPosting(false);
        }
    };

    const handleWipeData = async (keepSoul: boolean) => {
        try {
            const res = await fetch('/api/control/wipe-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keepSoul })
            });
            if (!res.ok) throw new Error('Failed to wipe data');
            await refresh();
            await fetchDataStats();
        } catch (err) {
            setError('Failed to wipe data');
        }
    };

    const refresh = useCallback(async () => {
        const logFetch = filterType?.startsWith('signals')
            ? fetchLogs({ limit: 2000, type: filterType })
            : filterType
                ? fetchLogs({ limit: 300, type: filterType })
                : fetchLogs({ limit: 300 });
        await Promise.all([
            fetchStatus(),
            logFetch,
            fetchSubmolts(),
            fetchTopology(),
            fetchEvolution(evolutionPageRef.current),
            fetchSynthesis(synthesisPageRef.current),
            fetchSovereignty(),
            fetchDataStats()
        ]);
        setLastRefresh(new Date());
    }, [fetchStatus, fetchLogs, fetchSubmolts, fetchTopology, fetchEvolution, fetchSynthesis, fetchSovereignty, fetchDataStats, filterType]);

    const refreshPassive = useCallback(async () => {
        await Promise.all([
            fetchStatus(),
            fetchSubmolts(),
            fetchTopology(),
            fetchEvolution(evolutionPageRef.current),
            fetchSynthesis(synthesisPageRef.current),
            fetchSovereignty(),
            fetchDataStats()
        ]);
        setLastRefresh(new Date());
    }, [fetchStatus, fetchSubmolts, fetchTopology, fetchEvolution, fetchSynthesis, fetchSovereignty, fetchDataStats]);

    // WebSocket Connection
    useEffect(() => {
        const connectWs = () => {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws`;

            console.log('Connecting to WebSocket:', wsUrl);
            const ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                console.log('WS Connected');
                setIsWsConnected(true);
            };

            ws.onclose = () => {
                console.log('WS Disconnected');
                setIsWsConnected(false);
                // Attempt reconnect
                setTimeout(connectWs, 3000);
            };

            ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);

                    switch (msg.type) {
                        case 'log_entry':
                            // Append new log to top (dedupe by id)
                            setLogs(prev => {
                                const incoming = msg.payload as LogEntry;
                                if (incoming.id && prev.some(entry => entry.id === incoming.id)) {
                                    return prev;
                                }
                                return [incoming, ...prev].slice(0, 300);
                            });
                            // Also refresh status if it was an action that might change metrics
                            if (['post', 'comment', 'upvote', 'downvote', 'follow', 'unfollow'].includes(msg.payload.actionType)) {
                                fetchStatus();
                            }
                            if (msg.payload.actionType === 'post') {
                                setMyPostsRefreshToken(prev => prev + 1);
                            }
                            if (['CLEAR_STABILIZATION', 'ROLLBACK_TRIGGER'].includes(msg.payload.promptSent)) {
                                fetchStatus();
                            }
                            break;

                        case 'stats_update':
                            // Partial update of status
                            setStatus(prev => prev ? { ...prev, status: msg.payload.status } : null);
                            if (msg.payload.status === 'idle') fetchStatus(); // Full refresh on idle
                            break;

                        case 'timer_sync':
                            // Update last run time
                            setStatus(prev => prev ? {
                                ...prev,
                                loop: { ...prev.loop, lastRunAt: msg.payload.lastRunAt }
                            } : null);
                            break;

                        case 'terminal_log':
                            setTerminalLogs(prev => {
                                // Deduplicate: avoid adding identical sequence
                                if (prev.length > 0) {
                                    const last = prev[prev.length - 1];
                                    if (last.message === msg.payload.message && last.timestamp === msg.payload.timestamp) {
                                        return prev;
                                    }
                                }
                                const newLogs = [...prev, msg.payload];
                                // Keep last 100
                                if (newLogs.length > 100) return newLogs.slice(newLogs.length - 100);
                                return newLogs;
                            });
                            break;

                        case 'topology_update':
                            // For WS updates, we might just refresh the current page to keep it consistent
                            fetchTopology(topologyPage);
                            break;

                        case 'evolution_update':
                            fetchEvolution(evolutionPageRef.current);
                            break;

                        case 'synthesis_update':
                            fetchSynthesis(synthesisPageRef.current);
                            break;

                        case 'sovereignty_update':
                            fetchSovereignty();
                            break;

                        case 'soul_update':
                            setSoulRefreshToken(prev => prev + 1);
                            break;
                    }
                } catch (e) {
                    console.error('WS Error:', e);
                }
            };

            return ws;
        };

        const ws = connectWs();
        wsRef.current = ws; // Keep reference for potential external use

        return () => {
            console.log('Cleaning up WS connection');
            if (ws) ws.close();
        };
    }, [fetchStatus]);

    useEffect(() => {
        refresh();
        // Keep polling as backup, but avoid activity log polling (WS-only).
        const interval = setInterval(refreshPassive, 60000);
        return () => clearInterval(interval);
    }, [refresh, refreshPassive]);

    const handleControl = async (action: string) => {
        try {
            const res = await fetch(`/api/control/${action}`, { method: 'POST' });
            if (!res.ok) throw new Error(`Failed to ${action}`);
            await refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        }
    };

    const visibleLogs = logs;

    const handleFilterChange = useCallback((filter: string | undefined) => {
        setFilterType(filter);
        if (!filter) {
            fetchLogs({ limit: 300 });
            return;
        }
        if (filter.startsWith('signals')) {
            fetchLogs({ limit: 2000, type: filter });
            return;
        }
        fetchLogs({ limit: 300, type: filter });
    }, [fetchLogs]);

    const autonomyLockActive = status?.evolution
        ? [status.evolution.selfModificationCooldownUntil, status.evolution.stabilizationUntil]
            .some((iso) => iso && new Date(iso).getTime() > Date.now())
        : false;

    return (
        <div className="app">
            <header className="header">
                <Activity size={32} color="var(--accent)" />
                <h1>Moltbot Dashboard</h1>
                <span className="refresh-indicator">
                    {isWsConnected ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--success)' }}>
                            <Zap size={14} fill="currentColor" /> Live Stream
                        </span>
                    ) : (
                        `Last Synced: ${lastRefresh.toLocaleTimeString()}`
                    )}
                </span>
            </header>

            {error && (
                <div className="card" style={{ marginBottom: 24, borderColor: 'var(--error)' }}>
                    <p style={{ color: 'var(--error)' }}>Error: {error}</p>
                </div>
            )}

            <div className="grid">
                <div className="sidebar-stack">
                    <SelfDialoguePanel
                        logs={terminalLogs}
                        isConnected={isWsConnected}
                    />
                    <StatusCard status={status} />
                    <Controls
                        status={status}
                        onPause={() => handleControl('pause')}
                        onResume={() => handleControl('resume')}
                        onRunOnce={() => handleControl('run-once')}
                        onReload={() => handleControl('reload')}
                        onRefresh={refresh}
                    />
                </div>
                <div>
                    <div className="tabs dashboard-tabs">
                        <Tooltip text="Real-time log of all agent actions and system events.">
                            <button
                                className={activeTab === 'logs' ? 'primary' : ''}
                                onClick={() => setActiveTab('logs')}
                                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                            >
                                <ListFilter size={16} /> Activity Log
                            </button>
                        </Tooltip>

                        <Tooltip text="Autonomous communities founded by the agent.">
                            <button
                                className={activeTab === 'submolts' ? 'primary' : ''}
                                onClick={() => setActiveTab('submolts')}
                                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                            >
                                <Layers size={16} /> Submolts ({submolts.length})
                            </button>
                        </Tooltip>

                        <Tooltip text="Live archive of posts generated by the agent.">
                            <button
                                className={activeTab === 'posts' ? 'primary' : ''}
                                onClick={() => setActiveTab('posts')}
                                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                            >
                                <FileText size={16} /> My Posts
                            </button>
                        </Tooltip>

                        <Tooltip text="High-level cognitive state, autonomous goals, and memetic lineage.">
                            <button
                                className={activeTab === 'intelligence' ? 'primary' : ''}
                                onClick={() => setActiveTab('intelligence')}
                                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                            >
                                <Cpu size={16} /> Intelligence Hub
                            </button>
                        </Tooltip>

                        <Tooltip text="Direct control over the agent's core personality and evolution.">
                            <button
                                className={activeTab === 'soul_mgmt' ? 'primary' : ''}
                                onClick={() => setActiveTab('soul_mgmt')}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--success)' }}
                            >
                                <Cpu size={16} /> Soul Management
                                {autonomyLockActive && (
                                    <span className="badge warning">Autonomy Lock</span>
                                )}
                            </button>
                        </Tooltip>

                        <Tooltip text="Inspect and reset stored data.">
                            <button
                                className={activeTab === 'data' ? 'primary' : ''}
                                onClick={() => setActiveTab('data')}
                                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                            >
                                <Database size={16} /> Data Management
                            </button>
                        </Tooltip>
                    </div>

                    {activeTab === 'logs' ? (
                        <ActivityLog
                            entries={visibleLogs}
                            agentName={status?.agent.name}
                            currentFilter={filterType}
                            onFilterChange={handleFilterChange}
                        />
                    ) : activeTab === 'submolts' ? (
                        <SubmoltList submolts={submolts} />
                    ) : activeTab === 'posts' ? (
                        <MyPosts refreshToken={myPostsRefreshToken} />
                    ) : activeTab === 'intelligence' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <div style={{ fontWeight: 600 }}>Intelligence Hub Controls</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                        Manual triggers for blueprint generation, memetic synthesis, and autonomous posts.
                                    </div>
                                    {hubMessage && (
                                        <div style={{
                                            marginTop: 6,
                                            fontSize: 12,
                                            color: hubMessage.type === 'success' ? 'var(--success)' : hubMessage.type === 'error' ? 'var(--error)' : 'var(--info)'
                                        }}>
                                            {hubMessage.text}
                                        </div>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                    <button onClick={handleForceBlueprint} className="btn-secondary">Force Blueprint</button>
                                    <button onClick={handleForceSynthesis} className="btn-secondary">Force Synthesis</button>
                                    <select
                                        value={autonomousPostTarget}
                                        onChange={(e) => setAutonomousPostTarget(e.target.value)}
                                        className="btn-secondary"
                                        style={{ padding: '6px 8px', minWidth: 160 }}
                                    >
                                        <option value="general">m/general</option>
                                        {submolts.map((s) => (
                                            <option key={s.id} value={s.name}>m/{s.name}</option>
                                        ))}
                                    </select>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                                        <input
                                            type="checkbox"
                                            checked={forceAutonomousPost}
                                            onChange={(e) => setForceAutonomousPost(e.target.checked)}
                                        />
                                        Force Post
                                    </label>
                                    <button
                                        onClick={handleAutonomousPost}
                                        disabled={autonomousPosting}
                                        className="btn-secondary"
                                    >
                                        {autonomousPosting ? 'Posting...' : 'Autonomous Post'}
                                    </button>
                                </div>
                            </div>
                            <NetworkResonance
                                data={topology}
                                total={topologyTotal}
                                page={topologyPage}
                                limit={topologyLimit}
                                onPageChange={(p) => fetchTopology(p)}
                                chartAllData={topologyChart || undefined}
                                chartAllLoading={topologyChartLoading}
                                onRequestChartAll={fetchTopologyAll}
                                trendData={resonanceTrend || undefined}
                                trendLoading={resonanceTrendLoading}
                                onRequestTrend={fetchResonanceTrend}
                                trendHours={resonanceTrendHours}
                                onTrendHoursChange={(hours) => {
                                    setResonanceTrendHours(hours);
                                    setResonanceTrend(null);
                                    fetchResonanceTrend(hours);
                                }}
                            />
                            <SynthesisHistory
                                history={synthesisHistory}
                                total={synthesisTotal}
                                page={synthesisPage}
                                limit={synthesisLimit}
                                onPageChange={(p) => fetchSynthesis(p)}
                            />
                            <AutonomyTimeline state={autonomyState} />
                            <EvolutionHistory
                                history={evolutionHistory}
                                total={evolutionTotal}
                                page={evolutionPage}
                                limit={evolutionLimit}
                                onPageChange={(p) => fetchEvolution(p)}
                            />
                            <SovereigntyPanel data={sovereignty} />
                        </div>
                    ) : activeTab === 'data' ? (
                        <DataManagement
                            stats={dataStats}
                            onWipe={handleWipeData}
                            onRefresh={fetchDataStats}
                        />
                    ) : (
                        <SoulPanel refreshToken={soulRefreshToken} />
                    )}
                </div>
            </div>
        </div>
    );
}

function AutonomyTimeline({ state }: { state: AutonomyState | null }) {
    const format = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '—');
    const isActive = (iso: string | null) => !!iso && new Date(iso).getTime() > Date.now();
    const readiness = state?.readiness;
    const fullThreshold = readiness?.fullThreshold ?? 1;
    const nudgeThreshold = readiness?.nudgeThreshold ?? 1;
    const activityWeight = readiness?.activityWeight ?? 0;
    const progress = Math.min(1, activityWeight / Math.max(1, fullThreshold));
    const nudgeMarker = Math.min(100, (nudgeThreshold / Math.max(1, fullThreshold)) * 100);
    const blockers: string[] = [];
    if (readiness) {
        if (readiness.selfModificationCooldownActive) blockers.push('Self‑modification cooldown');
        if (readiness.stabilizationActive) blockers.push('Stabilization mode');
        if (state?.synthesisCooldownActive) blockers.push('Synthesis cooldown');
        if (readiness.windowRemaining === 0) blockers.push('Evolution window cap reached');
        if (readiness.hoursSinceLast !== null && readiness.hoursSinceLast < readiness.minHoursBetween) {
            const remaining = Math.max(0, readiness.minHoursBetween - readiness.hoursSinceLast);
            blockers.push(`Min interval (${remaining.toFixed(1)}h remaining)`);
        }
        if (activityWeight < readiness.nudgeThreshold && !readiness.dueForNudge) {
            blockers.push('Activity threshold not met');
        }
    }

    return (
        <div className="card">
            <h2><ShieldAlert size={16} /> Autonomy Timeline</h2>
            <div className="panel-subtitle">
                Live autonomy gates, cooldowns, and rollback state.
            </div>

            <div className="status-row">
                <span className="status-label">Self-Modification Cooldown</span>
                <span className={`status-value ${isActive(state?.selfModificationCooldownUntil ?? null) ? 'warning' : ''}`} title={format(state?.selfModificationCooldownUntil ?? null)}>
                    {isActive(state?.selfModificationCooldownUntil ?? null)
                        ? <RelativeTime value={state?.selfModificationCooldownUntil ?? null} />
                        : 'Inactive'}
                </span>
            </div>

            <div className="status-row">
                <span className="status-label">Stabilization Mode</span>
                <span className={`status-value ${isActive(state?.stabilizationUntil ?? null) ? 'warning' : ''}`} title={format(state?.stabilizationUntil ?? null)}>
                    {isActive(state?.stabilizationUntil ?? null)
                        ? <RelativeTime value={state?.stabilizationUntil ?? null} />
                        : 'Inactive'}
                </span>
            </div>

            <div className="status-row">
                <span className="status-label">Synthesis Cooldown</span>
                <span className={`status-value ${isActive(state?.synthesisCooldownUntil ?? null) ? 'warning' : ''}`} title={format(state?.synthesisCooldownUntil ?? null)}>
                    {isActive(state?.synthesisCooldownUntil ?? null)
                        ? <RelativeTime value={state?.synthesisCooldownUntil ?? null} />
                        : 'Inactive'}
                </span>
            </div>

            <div className="status-row">
                <span className="status-label">Evolution Mode</span>
                <span className="status-value">
                    {readiness?.mode ?? state?.evolutionWindowCount !== undefined ? (readiness?.mode ?? 'stable') : '—'}
                </span>
            </div>

            <div className="status-row">
                <span className="status-label">Evolution Window</span>
                <span className="status-value">
                    {state ? `${state.evolutionWindowCount} / ${readiness?.windowMax ?? 1}` : '—'}
                </span>
            </div>

            <div className="status-row">
                <span className="status-label">Last Evolution ID</span>
                <span className="status-value" title={state?.lastAutonomousEvolutionId ?? '—'}>
                    {state?.lastAutonomousEvolutionId ? state.lastAutonomousEvolutionId.slice(0, 10) : '—'}
                </span>
            </div>

            <div style={{ marginTop: 16 }}>
                <div className="status-row" style={{ borderBottom: 'none' }}>
                    <span className="status-label">Activity Weight</span>
                    <span className="status-value">
                        {readiness ? `${activityWeight} / ${fullThreshold}` : '—'}
                    </span>
                </div>
                <div className="gauge-track">
                    <div className="gauge-fill" style={{ width: `${progress * 100}%` }} />
                    <div className="gauge-marker" style={{ left: `${nudgeMarker}%` }} title="Nudge threshold" />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                    <span>Nudge ≥ {nudgeThreshold}</span>
                    <span>Full ≥ {fullThreshold}</span>
                </div>
                {readiness && (
                    <div style={{ marginTop: 6, fontSize: 12, color: readiness.eligible ? 'var(--success)' : 'var(--text-secondary)' }}>
                        {readiness.eligible
                            ? 'Eligible for evolution window.'
                            : `Not eligible: ${blockers.length > 0 ? blockers.join(' · ') : 'Conditions not met.'}`}
                    </div>
                )}
            </div>
        </div>
    );
}
