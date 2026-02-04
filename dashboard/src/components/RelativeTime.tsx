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

    if (diffMs <= 0) {
        // Past date logic
        const pastMs = Math.abs(diffMs);
        const pastSecs = Math.floor(pastMs / 1000);
        const pastMins = Math.floor(pastSecs / 60);
        const pastHours = Math.floor(pastMins / 60);
        const pastDays = Math.floor(pastHours / 24);

        if (pastDays > 0) return `${pastDays}d ago`;
        if (pastHours > 0) return `${pastHours}h ago`;
        if (pastMins > 0) return `${pastMins}m ago`;
        if (pastSecs > 10) return `${pastSecs}s ago`;
        return 'Just now';
    }

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
