import { getWebSocketBroadcaster } from '../dashboard/websocket.js';

const MAX_BUFFER = 100;
const logBuffer: any[] = [];

/**
 * Terminal Stream Logger
 * 
 * Intercepts console logs and broadcasts them via WebSocket for dashboard visualization.
 */
export function initializeTerminalStream(): void {
    if ((console.log as any).__wrapped) return;

    const broadcaster = getWebSocketBroadcaster();

    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    console.log = (...args: any[]) => {
        originalLog(...args);
        broadcastLog('info', args);
    };
    (console.log as any).__wrapped = true;

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

        const logEntry = {
            level,
            message,
            timestamp: new Date().toISOString()
        };

        // Buffer the log
        logBuffer.push(logEntry);
        if (logBuffer.length > MAX_BUFFER) {
            logBuffer.shift();
        }

        broadcaster.broadcast('terminal_log', logEntry);
    }

    console.log('✓ Terminal stream initialized (UI redirection active)');
}

/**
 * Get the current log buffer
 */
export function getTerminalLogBuffer(): any[] {
    return [...logBuffer];
}
