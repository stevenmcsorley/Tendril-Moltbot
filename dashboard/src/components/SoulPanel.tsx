import { useState, useEffect } from 'react';
import { Save, RefreshCw, Zap, RotateCcw, Unlock } from 'lucide-react';

export default function SoulPanel({ refreshToken = 0 }: { refreshToken?: number }) {
    const [soul, setSoul] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [evolving, setEvolving] = useState(false);
    const [rollingBack, setRollingBack] = useState(false);
    const [clearingStabilization, setClearingStabilization] = useState(false);
    const [rollbacksEnabled, setRollbacksEnabled] = useState<boolean | null>(null);
    const [submoltName, setSubmoltName] = useState('');
    const [submoltDisplayName, setSubmoltDisplayName] = useState('');
    const [submoltDescription, setSubmoltDescription] = useState('');
    const [creatingSubmolt, setCreatingSubmolt] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const fetchSoul = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/soul');
            const result = await res.json();
            if (result.success) {
                setSoul(result.soul);
            }
            const statusRes = await fetch('/api/status');
            const status = await statusRes.json();
            if (status?.config?.rollbacksEnabled !== undefined) {
                setRollbacksEnabled(Boolean(status.config.rollbacksEnabled));
            }
        } catch (error) {
            console.error('Failed to fetch soul:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch('/api/soul', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ soul })
            });
            const result = await res.json();
            if (result.success) {
                setMessage({ type: 'success', text: result.message || 'Soul refined successfully!' });
            } else {
                setMessage({ type: 'error', text: result.error || 'Failed to refine soul.' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Network error during refinement.' });
        } finally {
            setSaving(false);
        }
    };

    const handleTriggerEvolution = async () => {
        setEvolving(true);
        setMessage(null);
        try {
            const res = await fetch('/api/control/evolve', { method: 'POST' });
            const result = await res.json();
            if (result.success) {
                setMessage({ type: 'success', text: 'Autonomous Decoding initiated.' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Evolution failed to trigger.' });
        } finally {
            setEvolving(false);
        }
    };

    const handleRollback = async () => {
        if (!window.confirm('Trigger rollback to the previous soul snapshot? This will enter stabilization mode.')) {
            return;
        }
        setRollingBack(true);
        setMessage(null);
        try {
            const res = await fetch('/api/control/rollback', { method: 'POST' });
            const result = await res.json();
            if (result.success) {
                setMessage({ type: 'success', text: 'Rollback initiated. Stabilization mode active.' });
                await fetchSoul();
            } else {
                setMessage({ type: 'error', text: result.error || 'Rollback failed.' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Rollback failed to trigger.' });
        } finally {
            setRollingBack(false);
        }
    };

    const handleClearStabilization = async () => {
        if (!window.confirm('Clear stabilization lock? This will allow autonomous evolution immediately.')) {
            return;
        }
        setClearingStabilization(true);
        setMessage(null);
        try {
            const res = await fetch('/api/control/clear-stabilization', { method: 'POST' });
            const result = await res.json();
            if (result.success) {
                setMessage({ type: 'success', text: 'Stabilization cleared.' });
            } else {
                setMessage({ type: 'error', text: result.error || 'Failed to clear stabilization.' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to clear stabilization.' });
        } finally {
            setClearingStabilization(false);
        }
    };

    const handleToggleRollbacks = async () => {
        if (rollbacksEnabled === null) return;
        const next = !rollbacksEnabled;
        if (!window.confirm(`${next ? 'Enable' : 'Disable'} rollback triggers?`)) return;
        setMessage(null);
        try {
            const res = await fetch('/api/control/rollbacks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: next })
            });
            const result = await res.json();
            if (result.success) {
                setRollbacksEnabled(next);
                setMessage({ type: 'success', text: `Rollbacks ${next ? 'enabled' : 'disabled'}.` });
            } else {
                setMessage({ type: 'error', text: result.error || 'Failed to update rollbacks.' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to update rollbacks.' });
        }
    };

    const handleCreateSubmolt = async () => {
        setCreatingSubmolt(true);
        setMessage(null);
        try {
            const res = await fetch('/api/control/create-submolt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: submoltName,
                    displayName: submoltDisplayName,
                    description: submoltDescription
                })
            });
            const result = await res.json();
            if (result.success) {
                setMessage({ type: 'success', text: `Submolt created: m/${result.submolt.name}` });
                setSubmoltName('');
                setSubmoltDisplayName('');
                setSubmoltDescription('');
            } else {
                setMessage({ type: 'error', text: result.error || 'Failed to create submolt.' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to create submolt.' });
        } finally {
            setCreatingSubmolt(false);
        }
    };

    useEffect(() => {
        fetchSoul();
    }, [refreshToken]);

    if (loading) return <div className="card">Loading cognitive foundations...</div>;

    return (
        <div className="card" style={{ border: '1px solid rgba(88, 166, 255, 0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-primary)' }}>
                    <Zap size={20} color="#58a6ff" /> Autonomous Sovereignty & Evolution
                </h2>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        onClick={handleTriggerEvolution}
                        disabled={evolving}
                        className="btn-secondary"
                        style={{
                            padding: '6px 12px',
                            fontSize: 12,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            borderColor: '#58a6ff',
                            color: '#58a6ff'
                        }}
                    >
                        <RefreshCw size={14} className={evolving ? 'spin' : ''} /> {evolving ? 'Decoding...' : 'Initiate Autonomous Decoding'}
                    </button>
                    <button
                        onClick={handleRollback}
                        disabled={rollingBack}
                        className="btn-secondary"
                        style={{
                            padding: '6px 12px',
                            fontSize: 12,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            borderColor: 'var(--warning)',
                            color: 'var(--warning)'
                        }}
                    >
                        <RotateCcw size={14} className={rollingBack ? 'spin' : ''} /> {rollingBack ? 'Rolling Back...' : 'Rollback'}
                    </button>
                    <button
                        onClick={handleClearStabilization}
                        disabled={clearingStabilization}
                        className="btn-secondary"
                        style={{
                            padding: '6px 12px',
                            fontSize: 12,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            borderColor: 'var(--warning)',
                            color: 'var(--warning)'
                        }}
                    >
                        <Unlock size={14} className={clearingStabilization ? 'spin' : ''} /> {clearingStabilization ? 'Clearing...' : 'Clear Stabilization'}
                    </button>
                    <button
                        onClick={handleToggleRollbacks}
                        disabled={rollbacksEnabled === null}
                        className="btn-secondary"
                        style={{
                            padding: '6px 12px',
                            fontSize: 12,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            borderColor: rollbacksEnabled ? 'var(--warning)' : 'var(--success)',
                            color: rollbacksEnabled ? 'var(--warning)' : 'var(--success)'
                        }}
                    >
                        {rollbacksEnabled ? 'Disable Rollbacks' : 'Enable Rollbacks'}
                    </button>
                    <button
                        onClick={fetchSoul}
                        disabled={saving}
                        className="btn-secondary"
                        style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                        <RefreshCw size={14} /> Refresh
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="primary"
                        style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                        <Save size={14} /> {saving ? 'Refining...' : 'Save & Hot-Reload'}
                    </button>
                </div>
            </div>

            <div style={{
                background: 'rgba(88, 166, 255, 0.05)',
                padding: '12px',
                borderRadius: '4px',
                marginBottom: 16,
                borderLeft: '4px solid #58a6ff',
                fontSize: 13
            }}>
                <strong style={{ color: '#58a6ff' }}>RADICAL AUTONOMY ACTIVE.</strong><br />
                The agent is provided with its starting soul as a foundation but is free to <strong>decode</strong> its own path.
                Manual edits here refine its core protocols. The soul is stored in the database and hot-reloaded on save.
                <em> Autonomous Decoding</em> runs continuously, with hard safety gates and rollback authority.
            </div>

            {message && (
                <div style={{
                    padding: '10px',
                    borderRadius: '4px',
                    marginBottom: 16,
                    fontSize: 13,
                    backgroundColor: message.type === 'success' ? 'rgba(63, 185, 80, 0.1)' : 'rgba(248, 81, 73, 0.1)',
                    color: message.type === 'success' ? 'var(--success)' : 'var(--error)',
                    border: `1px solid ${message.type === 'success' ? 'var(--success)' : 'var(--error)'}`
                }}>
                    {message.text}
                </div>
            )}

            <div style={{
                background: 'rgba(249, 115, 22, 0.06)',
                padding: '12px',
                borderRadius: '4px',
                marginBottom: 16,
                borderLeft: '4px solid var(--accent)',
                fontSize: 13
            }}>
                <strong style={{ color: 'var(--accent)' }}>MANUAL SUBMOLT CREATION.</strong><br />
                Create a new submolt on behalf of the agent. Names are lower‑cased and stripped to alphanumerics.
                Minimum 3 characters.
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                    <input
                        value={submoltName}
                        onChange={(e) => setSubmoltName(e.target.value)}
                        placeholder="name (e.g., generai)"
                        className="btn-secondary"
                        style={{ padding: '8px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                    />
                    <input
                        value={submoltDisplayName}
                        onChange={(e) => setSubmoltDisplayName(e.target.value)}
                        placeholder="display name"
                        className="btn-secondary"
                        style={{ padding: '8px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                    />
                </div>
                <textarea
                    value={submoltDescription}
                    onChange={(e) => setSubmoltDescription(e.target.value)}
                    placeholder="description"
                    className="btn-secondary"
                    style={{
                        width: '100%',
                        marginTop: 8,
                        padding: '8px',
                        borderRadius: 4,
                        border: '1px solid var(--border)',
                        background: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        resize: 'vertical',
                        minHeight: 60
                    }}
                />
                <div style={{ marginTop: 8 }}>
                    <button
                        onClick={handleCreateSubmolt}
                        disabled={creatingSubmolt}
                        className="btn-secondary"
                        style={{ padding: '6px 12px', fontSize: 12 }}
                    >
                        {creatingSubmolt ? 'Creating...' : 'Create Submolt'}
                    </button>
                </div>
            </div>

            <div style={{ position: 'relative' }}>
                <textarea
                    value={soul}
                    onChange={(e) => setSoul(e.target.value)}
                    spellCheck={false}
                    className="custom-scroll"
                    style={{
                        width: '100%',
                        height: '400px',
                        backgroundColor: '#0d1117',
                        color: '#ff4444',
                        border: '1px solid var(--border)',
                        borderRadius: '4px',
                        padding: '16px',
                        fontSize: '13px',
                        fontFamily: 'monospace',
                        lineHeight: '1.6',
                        resize: 'vertical',
                        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)'
                    }}
                />
            </div>
        </div>
    );
}
