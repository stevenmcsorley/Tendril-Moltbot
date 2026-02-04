import { useState, useEffect, useCallback, useRef } from 'react';
import StatusCard from './components/StatusCard';
import ActivityLog from './components/ActivityLog';
import Controls from './components/Controls';
import SubmoltList from './components/SubmoltList';
import SelfDialoguePanel, { TerminalLog } from './components/SelfDialoguePanel';
import MyPosts from './components/MyPosts';
import NetworkResonance from './components/NetworkResonance';
import EvolutionHistory from './components/EvolutionHistory';
import SovereigntyPanel from './components/SovereigntyPanel';
import SynthesisHistory from './components/SynthesisHistory';
import SoulPanel from './components/SoulPanel';
import Tooltip from './components/Tooltip';
import {
    Activity,
    Zap,
    ListFilter,
    Layers,
    FileText,
    Cpu
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
    rationale: string;
    delta: string;
    interpretation?: string;
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
    const [activeTab, setActiveTab] = useState<'logs' | 'submolts' | 'posts' | 'intelligence' | 'soul_mgmt'>('logs');
    const [isWsConnected, setIsWsConnected] = useState(false);
    const [topology, setTopology] = useState<ResonanceData[]>([]);
    const [topologyPage, setTopologyPage] = useState(1);
    const [topologyTotal, setTopologyTotal] = useState(0);
    const topologyLimit = 10;
    const [evolutionHistory, setEvolutionHistory] = useState<EvolutionEntry[]>([]);
    const [synthesisHistory, setSynthesisHistory] = useState<any[]>([]);
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

    // WebSocket reference
    const wsRef = useRef<WebSocket | null>(null);

    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch('/api/status');
            if (!res.ok) throw new Error('Failed to fetch status');
            const data = await res.json();
            setStatus(data);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        }
    }, []);

    const fetchLogs = useCallback(async () => {
        try {
            const query = filterType ? `?limit=100&type=${filterType}` : '?limit=100';
            const res = await fetch(`/api/logs${query}`);
            if (!res.ok) throw new Error('Failed to fetch logs');
            const data: LogsResponse = await res.json();
            setLogs(data.entries);
        } catch (err) {
            console.error('Failed to fetch logs:', err);
        }
    }, [filterType]);

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

    const fetchEvolution = useCallback(async () => {
        try {
            const res = await fetch('/api/evolution/history');
            const data = await res.json();
            if (data.success) {
                setEvolutionHistory(data.history);
            }
        } catch (err) {
            console.error('Failed to fetch evolution:', err);
        }
    }, []);

    const fetchSynthesis = useCallback(async () => {
        try {
            const res = await fetch('/api/synthesis/history');
            const data = await res.json();
            if (data.success) {
                setSynthesisHistory(data.history);
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
                fetchSynthesis();
            } else {
                setHubMessage({ type: 'error', text: data.error || 'Failed to run synthesis.' });
            }
        } catch (err) {
            setHubMessage({ type: 'error', text: 'Synthesis trigger failed.' });
        }
    };

    const refresh = useCallback(async () => {
        await Promise.all([
            fetchStatus(),
            fetchLogs(),
            fetchSubmolts(),
            fetchTopology(),
            fetchEvolution(),
            fetchSynthesis(),
            fetchSovereignty()
        ]);
        setLastRefresh(new Date());
    }, [fetchStatus, fetchLogs, fetchSubmolts, fetchTopology, fetchEvolution, fetchSynthesis, fetchSovereignty]);

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
                            // Append new log to top
                            setLogs(prev => [msg.payload, ...prev].slice(0, 100));
                            // Also refresh status if it was an action that might change metrics
                            if (['post', 'comment', 'upvote', 'downvote'].includes(msg.payload.actionType)) {
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
                            setEvolutionHistory(prev => [msg.payload, ...prev].slice(0, 10));
                            break;

                        case 'synthesis_update':
                            setSynthesisHistory(prev => [msg.payload, ...prev].slice(0, 10));
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
        // Keep polling as backup, but slower
        const interval = setInterval(refresh, 60000);
        return () => clearInterval(interval);
    }, [refresh]);

    const handleControl = async (action: string) => {
        try {
            const res = await fetch(`/api/control/${action}`, { method: 'POST' });
            if (!res.ok) throw new Error(`Failed to ${action}`);
            await refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        }
    };

    // Refresh logs when filter changes (fallback for WS filter mismatch)
    useEffect(() => {
        fetchLogs();
    }, [filterType, fetchLogs]);

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
                            </button>
                        </Tooltip>
                    </div>

                    {activeTab === 'logs' ? (
                        <ActivityLog
                            entries={logs}
                            agentName={status?.agent.name}
                            currentFilter={filterType}
                            onFilterChange={setFilterType}
                        />
                    ) : activeTab === 'submolts' ? (
                        <SubmoltList submolts={submolts} />
                    ) : activeTab === 'posts' ? (
                        <MyPosts />
                    ) : activeTab === 'intelligence' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <div style={{ fontWeight: 600 }}>Intelligence Hub Controls</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                        Manual triggers for blueprint generation and memetic synthesis.
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
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button onClick={handleForceBlueprint} className="btn-secondary">Force Blueprint</button>
                                    <button onClick={handleForceSynthesis} className="btn-secondary">Force Synthesis</button>
                                </div>
                            </div>
                            <NetworkResonance
                                data={topology}
                                total={topologyTotal}
                                page={topologyPage}
                                limit={topologyLimit}
                                onPageChange={(p) => fetchTopology(p)}
                            />
                            <SynthesisHistory history={synthesisHistory} />
                            <EvolutionHistory history={evolutionHistory} />
                            <SovereigntyPanel data={sovereignty} />
                        </div>
                    ) : (
                        <SoulPanel refreshToken={soulRefreshToken} />
                    )}
                </div>
            </div>
        </div>
    );
}
