import { useState, useEffect, useCallback } from 'react';
import StatusCard from './components/StatusCard';
import ActivityLog from './components/ActivityLog';
import Controls from './components/Controls';
import SubmoltList from './components/SubmoltList';

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
    const [error, setError] = useState<string | null>(null);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
    const [filterType, setFilterType] = useState<string | undefined>(undefined);
    const [activeTab, setActiveTab] = useState<'logs' | 'submolts'>('logs');

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

    useEffect(() => {
        refresh();
        const interval = setInterval(refresh, 30000); // 30 second polling
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

    // Refresh instantly when filter changes
    useEffect(() => {
        fetchLogs();
    }, [filterType, fetchLogs]);

    return (
        <div className="app">
            <header className="header">
                <span className="emoji">🦞</span>
                <h1>Moltbot Dashboard</h1>
                <span className="refresh-indicator">
                    Last refresh: {lastRefresh.toLocaleTimeString()}
                </span>
            </header>

            {error && (
                <div className="card" style={{ marginBottom: 24, borderColor: 'var(--error)' }}>
                    <p style={{ color: 'var(--error)' }}>Error: {error}</p>
                </div>
            )}

            <div className="grid">
                <div>
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
                    </div>

                    {activeTab === 'logs' ? (
                        <ActivityLog
                            entries={logs}
                            agentName={status?.agent.name}
                            currentFilter={filterType}
                            onFilterChange={setFilterType}
                        />
                    ) : (
                        <SubmoltList submolts={submolts} />
                    )}
                </div>
            </div>
        </div>
    );
}
