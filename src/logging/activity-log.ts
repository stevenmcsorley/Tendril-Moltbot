/**
 * Activity Logger
 * 
 * Append-only log of all agent decisions.
 * Full transparency - nothing hidden, no summarization.
 */

import { getDatabaseManager } from '../state/db.js';
import { getWebSocketBroadcaster } from '../dashboard/websocket.js';

export type ActionType = 'read' | 'upvote' | 'downvote' | 'comment' | 'post' | 'skip' | 'error' | 'heartbeat' | 'decision';

export interface ActivityLogEntry {
    timestamp: string;
    actionType: ActionType;
    targetId: string | null;
    targetSubmolt?: string;
    promptSent?: string | null;
    rawModelOutput?: string | null;
    finalAction?: string | null;
    error?: string;
}

export class ActivityLogger {
    constructor() { }

    /**
     * Log an activity entry
     */
    log(entry: Omit<ActivityLogEntry, 'timestamp'>): void {
        const fullEntry: ActivityLogEntry = {
            timestamp: new Date().toISOString(),
            ...entry,
        };

        const db = getDatabaseManager().getDb();
        const stmt = db.prepare(`
            INSERT INTO activity (timestamp, action_type, target_id, target_submolt, prompt_sent, raw_model_output, final_action, error)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            fullEntry.timestamp,
            fullEntry.actionType,
            fullEntry.targetId || null,
            fullEntry.targetSubmolt || null,
            fullEntry.promptSent || null,
            fullEntry.rawModelOutput || null,
            fullEntry.finalAction || null,
            fullEntry.error || null
        );

        // Broadcast via WebSocket
        getWebSocketBroadcaster().broadcast('log_entry', fullEntry);
    }

    /**
     * Get all log entries (most recent first)
     */
    getEntries(limit: number = 100, offset: number = 0, filterType?: string): ActivityLogEntry[] {
        const db = getDatabaseManager().getDb();
        let query = 'SELECT * FROM activity';
        let params: any[] = [];

        if (filterType) {
            const types = filterType.split(',');
            query += ` WHERE action_type IN (${types.map(() => '?').join(',')})`;
            params = types;
        }

        query += ' ORDER BY id DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const rows = db.prepare(query).all(...params);

        return rows.map((r: any) => ({
            timestamp: r.timestamp,
            actionType: r.action_type as ActionType,
            targetId: r.target_id,
            targetSubmolt: r.target_submolt,
            promptSent: r.prompt_sent,
            rawModelOutput: r.raw_model_output,
            finalAction: r.final_action,
            error: r.error
        }));
    }

    /**
     * Get total count of entries
     */
    getCount(): number {
        const db = getDatabaseManager().getDb();
        const row = db.prepare('SELECT COUNT(*) as count FROM activity').get() as { count: number };
        return row.count;
    }

    /**
     * Clean up old log files based on retention policy
     */
    cleanup(): void {
        // SQLite specific cleanup if needed, or based on retention days
        // No-op for now as we keep full auditability as per requirements
    }
}

// Singleton
let _logger: ActivityLogger | null = null;

export function getActivityLogger(): ActivityLogger {
    if (!_logger) {
        _logger = new ActivityLogger();
    }
    return _logger;
}

export function resetActivityLogger(): void {
    _logger = null;
}
