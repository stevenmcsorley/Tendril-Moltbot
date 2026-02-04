/**
 * WebSocket Broadcaster
 * 
 * Handles real-time updates to the dashboard.
 * Broadcast-only: Server -> Client.
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';

export type WebSocketMessage = {
    type: 'log_entry' | 'stats_update' | 'dialogue_message' | 'timer_sync' | 'topology_update' | 'evolution_update' | 'sovereignty_update' | 'synthesis_update';
    timestamp: string;
    payload: any;
};

export class WebSocketBroadcaster {
    private wss: WebSocketServer | null = null;

    /**
     * Initialize WebSocket server attached to HTTP server
     */
    initialize(server: Server): void {
        this.wss = new WebSocketServer({ server, path: '/ws' });

        this.wss.on('connection', (ws) => {
            console.log('Client connected to dashboard logs');

            ws.on('error', console.error);

            // Send initial connection confirmation
            ws.send(JSON.stringify({
                type: 'connection_established',
                timestamp: new Date().toISOString(),
                payload: { message: 'Connected to Moltbot Stream' }
            }));
        });
    }

    /**
     * Broadcast message to all connected clients
     */
    broadcast(type: WebSocketMessage['type'], payload: any): void {
        if (!this.wss) return;

        const message: WebSocketMessage = {
            type,
            timestamp: new Date().toISOString(),
            payload
        };

        const data = JSON.stringify(message);

        this.wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(data);
            }
        });
    }
}

// Singleton
let _broadcaster: WebSocketBroadcaster | null = null;

export function getWebSocketBroadcaster(): WebSocketBroadcaster {
    if (!_broadcaster) {
        _broadcaster = new WebSocketBroadcaster();
    }
    return _broadcaster;
}
