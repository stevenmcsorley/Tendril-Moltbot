import { useMemo, useState } from 'react';
import RelativeTime from './RelativeTime';
import { Cloud, CloudDrizzle, Sun, Zap, Activity } from 'lucide-react';

export type EngagementWeatherState = {
    status: 'silence' | 'low' | 'steady' | 'high';
    count: number;
    windowMinutes: number;
    lowThreshold: number;
    highThreshold: number;
    lastSignalAt: string | null;
};

type TrendPoint = { timestamp: string; count: number };

const statusMeta = {
    silence: { label: 'Silence', color: 'var(--text-muted)', Icon: Cloud },
    low: { label: 'Low', color: 'var(--warning)', Icon: CloudDrizzle },
    steady: { label: 'Steady', color: 'var(--info)', Icon: Sun },
    high: { label: 'High', color: 'var(--success)', Icon: Zap },
};

export default function EngagementWeather({ weather, trend }: { weather?: EngagementWeatherState | null; trend?: TrendPoint[] | null }) {
    const [compact, setCompact] = useState(false);
    const meta = weather ? statusMeta[weather.status] : statusMeta.silence;
    const progress = weather
        ? Math.min(1, weather.count / Math.max(1, weather.highThreshold))
        : 0;
    const sparkline = useMemo(() => {
        if (!trend || trend.length === 0) return '';
        const values = trend.map(p => p.count);
        const max = Math.max(...values, 1);
        const min = Math.min(...values);
        const range = Math.max(1, max - min);
        return values.map((v, i) => {
            const x = (i / Math.max(1, values.length - 1)) * 100;
            const y = 24 - ((v - min) / range) * 20 - 2;
            return `${x.toFixed(2)},${y.toFixed(2)}`;
        }).join(' ');
    }, [trend]);

    return (
        <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div style={{ fontWeight: 600 }}>Engagement Weather</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                        className="btn-secondary"
                        style={{ fontSize: 11, padding: '4px 8px', whiteSpace: 'nowrap' }}
                        onClick={() => setCompact(prev => !prev)}
                    >
                        <Activity size={12} /> {compact ? 'Panel' : 'Instrument'}
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: meta.color, fontSize: 12 }}>
                        <meta.Icon size={14} /> {meta.label}
                    </div>
                </div>
            </div>
            {!compact ? (
                <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                        Signals (last {weather?.windowMinutes ?? 0}m)
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>
                            {weather?.count ?? 0}
                        </div>
                        <div style={{ flex: 1, height: 8, borderRadius: 999, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                            <div
                                style={{
                                    width: `${progress * 100}%`,
                                    height: '100%',
                                    background: meta.color,
                                    transition: 'width 0.3s ease'
                                }}
                            />
                        </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                        <span>Low ≤ {weather?.lowThreshold ?? 0}</span>
                        <span>High ≥ {weather?.highThreshold ?? 0}</span>
                    </div>
                    <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-secondary)' }}>
                        Last signal: {weather?.lastSignalAt ? <RelativeTime value={weather.lastSignalAt} /> : '—'}
                    </div>
                    {sparkline && (
                        <svg viewBox="0 0 100 24" style={{ width: '100%', height: 26, marginTop: 10 }}>
                            <polyline
                                fill="none"
                                stroke={meta.color}
                                strokeWidth="1"
                                points={sparkline}
                            />
                        </svg>
                    )}
                </div>
            ) : (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ fontSize: 20, fontWeight: 600 }}>{weather?.count ?? 0}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{weather?.windowMinutes ?? 0}m window</div>
                    </div>
                    <div style={{ height: 6, borderRadius: 999, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                        <div style={{ width: `${progress * 100}%`, height: '100%', background: meta.color }} />
                    </div>
                    {sparkline && (
                        <svg viewBox="0 0 100 24" style={{ width: '100%', height: 22 }}>
                            <polyline
                                fill="none"
                                stroke={meta.color}
                                strokeWidth="1"
                                points={sparkline}
                            />
                        </svg>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Last: {weather?.lastSignalAt ? <RelativeTime value={weather.lastSignalAt} /> : '—'}
                    </div>
                </div>
            )}
        </div>
    );
}
