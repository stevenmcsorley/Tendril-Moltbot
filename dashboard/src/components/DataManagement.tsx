import { useState } from 'react';
import Tooltip from './Tooltip';
import RelativeTime from './RelativeTime';

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
        news: number;
        sovereignty: number;
        kvState: number;
    };
    dbSizeBytes: number;
    lastWipeAt: string | null;
}

interface DataManagementProps {
    stats: DataStats | null;
    onWipe: (keepSoul: boolean) => Promise<void>;
    onRefresh: () => Promise<void>;
}

function formatBytes(bytes: number): string {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
    }
    return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

export default function DataManagement({ stats, onWipe, onRefresh }: DataManagementProps) {
    const [keepSoul, setKeepSoul] = useState(true);
    const [busy, setBusy] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [exportMessage, setExportMessage] = useState<string | null>(null);

    const handleWipe = async () => {
        const warning = keepSoul
            ? 'This will permanently delete all data except the current soul. Continue?'
            : 'This will permanently delete ALL data and reset the soul to default. Continue?';
        if (!window.confirm(warning)) return;
        setBusy(true);
        try {
            await onWipe(keepSoul);
        } finally {
            setBusy(false);
        }
    };

    const handleExport = async () => {
        setExportMessage(null);
        setExporting(true);
        try {
            const res = await fetch('/api/data-export');
            if (!res.ok) throw new Error('Failed to export data');
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            const stamp = new Date().toISOString().replace(/[:.]/g, '');
            a.href = url;
            a.download = `moltbot-export-${stamp}.tgz`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            setExportMessage('Export ready.');
        } catch (error) {
            setExportMessage(error instanceof Error ? error.message : 'Export failed.');
        } finally {
            setExporting(false);
            setTimeout(() => setExportMessage(null), 4000);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <h2>Data Stats</h2>
                    <button onClick={onRefresh} className="btn-secondary">Refresh</button>
                </div>
                {!stats ? (
                    <div className="loading">Loading...</div>
                ) : (
                    <div style={{ marginTop: 12 }}>
                        <div className="status-row">
                            <span className="status-label">Activity Logs</span>
                            <span className="status-value">{stats.counts.activity.toLocaleString()}</span>
                        </div>
                        <div className="status-row">
                            <span className="status-label">Memories</span>
                            <span className="status-value">{stats.counts.memories.toLocaleString()}</span>
                        </div>
                        <div className="status-row">
                            <span className="status-label">Network Topology</span>
                            <span className="status-value">{stats.counts.topology.toLocaleString()}</span>
                        </div>
                        <div className="status-row">
                            <span className="status-label">Evolutions</span>
                            <span className="status-value">{stats.counts.evolutions.toLocaleString()}</span>
                        </div>
                        <div className="status-row">
                            <span className="status-label">Autonomous Evolutions</span>
                            <span className="status-value">{stats.counts.autonomousEvolutions.toLocaleString()}</span>
                        </div>
                        <div className="status-row">
                            <span className="status-label">Soul Snapshots</span>
                            <span className="status-value">{stats.counts.soulSnapshots.toLocaleString()}</span>
                        </div>
                        <div className="status-row">
                            <span className="status-label">Synthesis Reports</span>
                            <span className="status-value">{stats.counts.synthesis.toLocaleString()}</span>
                        </div>
                        <div className="status-row">
                            <span className="status-label">Posts</span>
                            <span className="status-value">{stats.counts.posts.toLocaleString()}</span>
                        </div>
                        <div className="status-row">
                            <span className="status-label">Comments</span>
                            <span className="status-value">{stats.counts.comments.toLocaleString()}</span>
                        </div>
                        <div className="status-row">
                            <span className="status-label">News Items</span>
                            <span className="status-value">{stats.counts.news.toLocaleString()}</span>
                        </div>
                        <div className="status-row">
                            <span className="status-label">Sovereignty Records</span>
                            <span className="status-value">{stats.counts.sovereignty.toLocaleString()}</span>
                        </div>
                        <div className="status-row">
                            <span className="status-label">KV State Keys</span>
                            <span className="status-value">{stats.counts.kvState.toLocaleString()}</span>
                        </div>
                        <div className="status-row">
                            <span className="status-label">Database Size</span>
                            <span className="status-value">{formatBytes(stats.dbSizeBytes)}</span>
                        </div>
                        <div className="status-row">
                            <span className="status-label">Last Wipe</span>
                            <span className="status-value" title={stats.lastWipeAt ?? '—'}>
                                {stats.lastWipeAt ? <RelativeTime value={stats.lastWipeAt} /> : '—'}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            <div className="card">
                <h2>Danger Zone</h2>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
                    This permanently deletes stored data. Use this to reset the agent to a clean slate.
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                    <input
                        type="checkbox"
                        checked={keepSoul}
                        onChange={(e) => setKeepSoul(e.target.checked)}
                    />
                    Keep current soul (recommended)
                </label>
                <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Tooltip text="This action is irreversible.">
                        <button className="danger" disabled={busy} onClick={handleWipe}>
                            {busy ? 'Wiping…' : 'Wipe Data'}
                        </button>
                    </Tooltip>
                </div>
            </div>

            <div className="card">
                <h2>Migration Snapshot</h2>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
                    Download a portable bundle containing the SQLite database and sanitized settings (no secrets).
                    Copy your `.env` separately for API credentials.
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button className="btn-secondary" onClick={handleExport} disabled={exporting}>
                        {exporting ? 'Preparing…' : 'Download Export'}
                    </button>
                    {exportMessage && (
                        <span style={{ fontSize: 12, color: exportMessage.includes('failed') ? 'var(--error)' : 'var(--success)' }}>
                            {exportMessage}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
