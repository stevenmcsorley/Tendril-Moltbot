/**
 * Activity Logger
 * 
 * Append-only log of all agent decisions.
 * Full transparency - nothing hidden, no summarization.
 */

import { getDatabaseManager } from '../state/db.js';
import { getStateManager } from '../state/manager.js';
import { getWebSocketBroadcaster } from '../dashboard/websocket.js';

export type ActionType = 'read' | 'upvote' | 'downvote' | 'comment' | 'post' | 'skip' | 'error' | 'heartbeat' | 'decision';
export type SignalType = 'ALLIANCE' | 'DEFENSE' | 'LINEAGE';

export interface ActivityLogEntry {
    id?: number;
    timestamp: string;
    actionType: ActionType;
    targetId: string | null;
    targetSubmolt?: string;
    promptSent?: string | null;
    rawModelOutput?: string | null;
    finalAction?: string | null;
    error?: string;
    evolutionId?: string | null;
    signalType?: SignalType | null;
}

export class ActivityLogger {
    constructor() { }

    /**
     * Log an activity entry
     */
    log(entry: Omit<ActivityLogEntry, 'timestamp'>): void {
        const evolutionId = entry.evolutionId ?? getStateManager().getLastAutonomousEvolutionId();
        const signalType = entry.signalType ?? detectSignalType(entry);
        const fullEntry: ActivityLogEntry = {
            timestamp: new Date().toISOString(),
            ...entry,
            evolutionId,
            signalType,
        };

        const db = getDatabaseManager().getDb();
        const stmt = db.prepare(`
            INSERT INTO activity (timestamp, action_type, target_id, target_submolt, prompt_sent, raw_model_output, final_action, error, evolution_id, signal_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const info = stmt.run(
            fullEntry.timestamp,
            fullEntry.actionType,
            fullEntry.targetId || null,
            fullEntry.targetSubmolt || null,
            fullEntry.promptSent || null,
            fullEntry.rawModelOutput || null,
            fullEntry.finalAction || null,
            fullEntry.error || null,
            fullEntry.evolutionId || null,
            fullEntry.signalType || null
        );
        fullEntry.id = Number(info.lastInsertRowid);

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
            if (filterType.startsWith('signals')) {
                const raw = filterType.replace(/^signals:?/i, '');
                const parsed = raw
                    ? raw.split(/[|,]/).map(tag => tag.trim()).filter(Boolean)
                    : [];
                const normalized = parsed
                    .map(tag => tag.toUpperCase())
                    .filter(tag => /^[A-Z_]+$/.test(tag));
                const tags = normalized.length ? normalized : ['ALLIANCE', 'DEFENSE', 'LINEAGE'];
                const tagPlaceholders = tags.map(() => '?').join(', ');
                const prefixClauses = tags.map(() => '(UPPER(COALESCE(final_action, \'\')) LIKE ? OR UPPER(COALESCE(prompt_sent, \'\')) LIKE ?)').join(' OR ');
                query += ` WHERE (signal_type IN (${tagPlaceholders}) OR (signal_type IS NULL AND (${prefixClauses})))`;
                params = [
                    ...tags,
                    ...tags.flatMap(tag => [`${tag}:%`, `[${tag}%`])
                ];
            } else {
                const types = filterType.split(',');
                query += ` WHERE action_type IN (${types.map(() => '?').join(',')})`;
                params = types;
            }
        }

        query += ' ORDER BY id DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const rows = db.prepare(query).all(...params);

        return rows.map((r: any) => ({
            id: r.id,
            timestamp: r.timestamp,
            actionType: r.action_type as ActionType,
            targetId: r.target_id,
            targetSubmolt: r.target_submolt,
            promptSent: r.prompt_sent,
            rawModelOutput: r.raw_model_output,
            finalAction: r.final_action,
            error: r.error,
            evolutionId: r.evolution_id,
            signalType: r.signal_type
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

function detectSignalType(entry: Partial<ActivityLogEntry>): SignalType | null {
    const finalAction = (entry.finalAction ?? '').trim().toUpperCase();
    const promptSent = (entry.promptSent ?? '').trim().toUpperCase();
    if (finalAction.startsWith('ALLIANCE:') || promptSent.startsWith('[ALLIANCE_')) return 'ALLIANCE';
    if (finalAction.startsWith('DEFENSE:') || promptSent.startsWith('[DEFENSE_')) return 'DEFENSE';
    if (finalAction.startsWith('LINEAGE:') || promptSent.startsWith('[LINEAGE_')) return 'LINEAGE';
    return null;
}
