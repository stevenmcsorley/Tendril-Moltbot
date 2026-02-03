import { useState, useEffect } from 'react';

interface RelativeTimeProps {
    value: string | null;
    refreshInterval?: number;
}

function formatRelativeTime(iso: string | null): string {
    if (!iso) return '—';
    const now = new Date();
    const target = new Date(iso);
    const diffMs = target.getTime() - now.getTime();

    if (diffMs <= 0) return 'Ready';

    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);

    if (diffHours > 0) {
        return `${diffHours}h ${diffMins % 60}m to go`;
    }
    if (diffMins > 0) {
        return `${diffMins}m ${diffSecs % 60}s to go`;
    }
    return `${diffSecs}s to go`;
}

export default function RelativeTime({ value, refreshInterval = 1000 }: RelativeTimeProps) {
    const [display, setDisplay] = useState(formatRelativeTime(value));

    useEffect(() => {
        // Initial set
        setDisplay(formatRelativeTime(value));

        if (!value) return;

        const interval = setInterval(() => {
            const newDisplay = formatRelativeTime(value);
            setDisplay(newDisplay);
        }, refreshInterval);

        return () => clearInterval(interval);
    }, [value, refreshInterval]);

    return <span>{display}</span>;
}
