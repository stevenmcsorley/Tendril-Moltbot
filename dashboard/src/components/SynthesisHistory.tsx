import { useState } from 'react';
import type { SynthesisReport } from '../../../src/agent/synthesis';
import Tooltip from './Tooltip';

interface SynthesisHistoryProps {
    history: SynthesisReport[];
}

export default function SynthesisHistory({ history }: SynthesisHistoryProps) {
    const [decodedOpen, setDecodedOpen] = useState<Record<string, boolean>>({});
    const [decodedText, setDecodedText] = useState<Record<string, string>>({});

    const extractHexPayload = (text: string): string | null => {
        const matches = text.match(/0x[0-9a-fA-F]+/g);
        if (matches && matches.length > 0) {
            return matches.reduce((longest, current) => current.length > longest.length ? current : longest, matches[0]);
        }
        const compact = text.replace(/\s+/g, '');
        if (/^[0-9a-fA-F]+$/.test(compact) && compact.length >= 16) {
            return compact;
        }
        return null;
    };

    const decodeHexPayload = (text: string): string | null => {
        const hex = extractHexPayload(text);
        if (!hex) return null;
        const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
        if (clean.length % 2 !== 0) return null;
        try {
            const bytes = clean.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) ?? [];
            return new TextDecoder().decode(new Uint8Array(bytes));
        } catch {
            return null;
        }
    };

    const toggleDecode = (key: string, reportText: string) => {
        setDecodedOpen(prev => ({ ...prev, [key]: !prev[key] }));
        setDecodedText(prev => {
            if (prev[key] !== undefined) return prev;
            const decoded = decodeHexPayload(reportText);
            return { ...prev, [key]: decoded || 'No hex payload found.' };
        });
    };

    if (history.length === 0) {
        return (
            <div className="card">
                <h2>
                    Memetic Synthesis Archive
                    <Tooltip text="Summaries of clustered memories. Each report compresses recent signal convergence into a compact theme and a synthesis payload.">
                        <span style={{ marginLeft: 6, cursor: 'help' }}>ⓘ</span>
                    </Tooltip>
                </h2>
                <div className="panel-subtitle">Periodic clustering of recent memories into a condensed convergence report.</div>
                <div className="empty-state">No synthesis reports generated yet. Density threshold not reached.</div>
            </div>
        );
    }

    return (
        <div className="card">
            <h2>
                Memetic Synthesis Archive
                <Tooltip text="Summaries of clustered memories. Each report compresses recent signal convergence into a compact theme and a synthesis payload.">
                    <span style={{ marginLeft: 6, cursor: 'help' }}>ⓘ</span>
                </Tooltip>
            </h2>
            <div className="panel-subtitle">Periodic clustering of recent memories into a condensed convergence report.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {history.map((report) => {
                    const reportKey = `${report.timestamp}-${report.summary}`;
                    return (
                    <div key={reportKey} style={{
                        padding: 16,
                        background: 'var(--bg-tertiary)',
                        borderRadius: 6,
                        border: '1px solid var(--border)',
                        position: 'relative'
                    }}>
                        <div style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 8, fontFamily: 'monospace' }}>
                            SIGNAL_TIMESTAMP: {new Date(report.timestamp).toLocaleString()}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: 12 }}>
                            SUMMARY: <span className="synthesis-summary">{report.summary}</span>
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 8 }}>
                            Human Interpretation: <span style={{ color: 'var(--info)' }}>{report.humanSummary}</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
                            Implication: <strong style={{ color: 'var(--warning)' }}>{report.implication}</strong>
                        </div>
                        <div style={{
                            fontSize: 13,
                            color: 'var(--text-secondary)',
                            background: 'var(--bg-primary)',
                            padding: 12,
                            borderRadius: 4,
                            marginBottom: 12,
                            fontFamily: 'monospace',
                            borderLeft: '2px solid var(--accent)'
                        }} className="synthesis-report">
                            {report.report}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            <button
                                className="btn-secondary"
                                onClick={() => toggleDecode(reportKey, report.report)}
                            >
                                {decodedOpen[reportKey] ? 'Hide Decode' : 'Decode Hex'}
                            </button>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                Decode the synthesis payload to plain text.
                            </span>
                        </div>
                        {decodedOpen[reportKey] && (
                            <div style={{
                                fontSize: 13,
                                color: 'var(--text-primary)',
                                background: 'var(--bg-primary)',
                                padding: 12,
                                borderRadius: 4,
                                marginBottom: 12,
                                borderLeft: '2px solid var(--info)'
                            }}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                                    DECODED_PAYLOAD:
                                </div>
                                {decodedText[reportKey]}
                            </div>
                        )}

                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            <div style={{ marginBottom: 4 }}>CONVERGENCE_CLUSTERS:</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {report.clusters.map((cluster, cIdx) => (
                                    <div key={cIdx} style={{
                                        background: 'rgba(0, 255, 255, 0.05)',
                                        padding: '4px 8px',
                                        borderRadius: 4,
                                        fontSize: 10,
                                        border: '1px solid rgba(0, 255, 255, 0.1)'
                                    }}>
                                        {cluster.count}x signals → {cluster.center.substring(0, 30)}...
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )})}
            </div>
        </div>
    );
}
