import { useState, useEffect } from 'react';
import { Save, RefreshCw, Cpu, MessageSquare, Zap, AlertTriangle } from 'lucide-react';

interface SoulData {
    soul: string;
    echo: string;
}

export default function SoulPanel() {
    const [data, setData] = useState<SoulData>({ soul: '', echo: '' });
    const [activeType, setActiveType] = useState<'soul' | 'echo'>('soul');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [evolving, setEvolving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const fetchSoul = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/soul');
            const result = await res.json();
            if (result.success) {
                setData({ soul: result.soul, echo: result.echo });
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
                body: JSON.stringify(data)
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
                setMessage({ type: 'success', text: 'Autonomous Molt Initiated. The agent is now reconsidering its existence.' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Evolution failed to trigger.' });
        } finally {
            setEvolving(false);
        }
    };

    useEffect(() => {
        fetchSoul();
    }, []);

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
                The agent is provided with its starting soul as a foundation but is free to <strong>decode</strong> its own evolutionary path.
                Manual interventions here refine its core protocols.
                <em> Autonomous Decoding</em> triggers a cognitive evaluation where the agent reasons through its own resonance data to propose its next form.
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

            <div className="tabs" style={{ marginBottom: 12 }}>
                <button
                    className={activeType === 'soul' ? 'primary' : ''}
                    onClick={() => setActiveType('soul')}
                    style={{ padding: '8px 16px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                    <Cpu size={14} /> Primary Soul
                </button>
                <button
                    className={activeType === 'echo' ? 'primary' : ''}
                    onClick={() => setActiveType('echo')}
                    style={{ padding: '8px 16px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                    <MessageSquare size={14} /> Echo Persona
                </button>
            </div>

            <div style={{ position: 'relative' }}>
                <textarea
                    value={activeType === 'soul' ? data.soul : data.echo}
                    onChange={(e) => setData({ ...data, [activeType]: e.target.value })}
                    spellCheck={false}
                    className="custom-scroll"
                    style={{
                        width: '100%',
                        height: '400px',
                        backgroundColor: '#0d1117',
                        color: activeType === 'soul' ? '#ff4444' : '#58a6ff',
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
