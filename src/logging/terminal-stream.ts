import { getWebSocketBroadcaster } from '../dashboard/websocket.js';

/**
 * Terminal Stream Logger
 * 
 * Intercepts console logs and broadcasts them via WebSocket for dashboard visualization.
 */
export function initializeTerminalStream(): void {
    const broadcaster = getWebSocketBroadcaster();

    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    console.log = (...args: any[]) => {
        originalLog(...args);
        broadcastLog('info', args);
    };

    console.warn = (...args: any[]) => {
        originalWarn(...args);
        broadcastLog('warn', args);
    };

    console.error = (...args: any[]) => {
        originalError(...args);
        broadcastLog('error', args);
    };

    function broadcastLog(level: string, args: any[]): void {
        const message = args.map(arg => {
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg, null, 2);
                } catch {
                    return String(arg);
                }
            }
            return String(arg);
        }).join(' ');

        broadcaster.broadcast('terminal_log', {
            level,
            message,
            timestamp: new Date().toISOString()
        });
    }

    console.log('✓ Terminal stream initialized (UI redirection active)');
}
