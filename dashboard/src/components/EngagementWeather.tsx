import RelativeTime from './RelativeTime';
import { Cloud, CloudDrizzle, Sun, Zap } from 'lucide-react';

export type EngagementWeatherState = {
    status: 'silence' | 'low' | 'steady' | 'high';
    count: number;
    windowMinutes: number;
    lowThreshold: number;
    highThreshold: number;
    lastSignalAt: string | null;
};

const statusMeta = {
    silence: { label: 'Silence', color: 'var(--text-muted)', Icon: Cloud },
    low: { label: 'Low', color: 'var(--warning)', Icon: CloudDrizzle },
    steady: { label: 'Steady', color: 'var(--info)', Icon: Sun },
    high: { label: 'High', color: 'var(--success)', Icon: Zap },
};

export default function EngagementWeather({ weather }: { weather?: EngagementWeatherState | null }) {
    const meta = weather ? statusMeta[weather.status] : statusMeta.silence;
    const progress = weather
        ? Math.min(1, weather.count / Math.max(1, weather.highThreshold))
        : 0;

    return (
        <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div style={{ fontWeight: 600 }}>Engagement Weather</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: meta.color, fontSize: 12 }}>
                    <meta.Icon size={14} /> {meta.label}
                </div>
            </div>
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
            </div>
        </div>
    );
}
