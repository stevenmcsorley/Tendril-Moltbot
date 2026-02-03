import { useState, useEffect, useCallback, useRef } from 'react';
import StatusCard from './components/StatusCard';
import ActivityLog from './components/ActivityLog';
import Controls from './components/Controls';
import SubmoltList from './components/SubmoltList';
import SelfDialoguePanel, { DialogueMessage } from './components/SelfDialoguePanel';
import MyPosts from './components/MyPosts';

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

export default function App() {
    const [status, setStatus] = useState<Status | null>(null);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [submolts, setSubmolts] = useState<Submolt[]>([]);
    const [dialogueMessages, setDialogueMessages] = useState<DialogueMessage[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
    const [filterType, setFilterType] = useState<string | undefined>(undefined);
    const [activeTab, setActiveTab] = useState<'logs' | 'submolts' | 'posts'>('logs');
    const [isWsConnected, setIsWsConnected] = useState(false);

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

    const refresh = useCallback(async () => {
        await Promise.all([fetchStatus(), fetchLogs(), fetchSubmolts()]);
        setLastRefresh(new Date());
    }, [fetchStatus, fetchLogs, fetchSubmolts]);

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
                // Reconnect after 3s
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

                        case 'dialogue_message':
                            setDialogueMessages(prev => {
                                const newHistory = [...prev, msg.payload];
                                // Keep last 20
                                if (newHistory.length > 20) return newHistory.slice(newHistory.length - 20);
                                return newHistory;
                            });
                            break;
                    }
                } catch (e) {
                    console.error('WS Error:', e);
                }
            };

            wsRef.current = ws;
        };

        connectWs();

        return () => {
            wsRef.current?.close();
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
                <span className="emoji">🦞</span>
                <h1>Moltbot Dashboard</h1>
                <span className="refresh-indicator">
                    {isWsConnected ? '⚡ Live Stream' : `Polling (Last: ${lastRefresh.toLocaleTimeString()})`}
                </span>
            </header>

            {error && (
                <div className="card" style={{ marginBottom: 24, borderColor: 'var(--error)' }}>
                    <p style={{ color: 'var(--error)' }}>Error: {error}</p>
                </div>
            )}

            <div className="grid">
                <div>
                    <SelfDialoguePanel
                        messages={dialogueMessages}
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
                    <div className="tabs" style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                        <button
                            className={activeTab === 'logs' ? 'primary' : ''}
                            onClick={() => setActiveTab('logs')}
                            style={{ flex: 1 }}
                        >
                            Activity Log
                        </button>
                        <button
                            className={activeTab === 'submolts' ? 'primary' : ''}
                            onClick={() => setActiveTab('submolts')}
                            style={{ flex: 1 }}
                        >
                            Submolts ({submolts.length})
                        </button>
                        <button
                            className={activeTab === 'posts' ? 'primary' : ''}
                            onClick={() => setActiveTab('posts')}
                            style={{ flex: 1 }}
                        >
                            My Posts
                        </button>
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
                    ) : (
                        <MyPosts />
                    )}
                </div>
            </div>
        </div>
    );
}
