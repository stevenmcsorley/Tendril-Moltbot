/**
 * Activity Logger
 * 
 * Append-only log of all agent decisions.
 * Full transparency - nothing hidden, no summarization.
 */

import { existsSync, mkdirSync, appendFileSync, readFileSync, unlinkSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getConfig } from '../config.js';

export type ActionType = 'read' | 'upvote' | 'comment' | 'post' | 'skip' | 'error' | 'heartbeat';

export interface ActivityLogEntry {
    timestamp: string;
    actionType: ActionType;
    targetId: string | null;
    targetSubmolt?: string;
    promptSent: string | null;
    rawModelOutput: string | null;
    finalAction: string;
    error?: string;
}

export class ActivityLogger {
    private filePath: string;
    private retentionDays: number;

    constructor(dataDir: string = 'data') {
        this.filePath = join(dataDir, 'activity.jsonl');
        this.retentionDays = getConfig().LOG_RETENTION_DAYS;

        const dir = dirname(this.filePath);
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }
    }

    /**
     * Log an activity entry
     */
    log(entry: Omit<ActivityLogEntry, 'timestamp'>): void {
        const fullEntry: ActivityLogEntry = {
            timestamp: new Date().toISOString(),
            ...entry,
        };

        appendFileSync(this.filePath, JSON.stringify(fullEntry) + '\n');
    }

    /**
     * Get all log entries (most recent first)
     */
    /**
     * Get all log entries (most recent first)
     * @param limit Max entries to return
     * @param offset Offset for pagination
     * @param filterType Optional filter to only return specific action types (e.g. 'comment,post')
     */
    getEntries(limit: number = 100, offset: number = 0, filterType?: string): ActivityLogEntry[] {
        if (!existsSync(this.filePath)) {
            return [];
        }

        const content = readFileSync(this.filePath, 'utf-8');
        const lines = content.trim().split('\n').filter(Boolean);
        const typesToKeep = filterType ? filterType.split(',') : null;

        // Parse and reverse for newest first
        const entries: ActivityLogEntry[] = [];
        for (let i = lines.length - 1; i >= 0; i--) {
            try {
                const entry = JSON.parse(lines[i]) as ActivityLogEntry;
                if (typesToKeep && !typesToKeep.includes(entry.actionType)) {
                    continue;
                }
                entries.push(entry);
            } catch {
                // Skip malformed lines
            }
        }

        return entries.slice(offset, offset + limit);
    }

    /**
     * Get total count of entries
     */
    getCount(): number {
        if (!existsSync(this.filePath)) {
            return 0;
        }

        const content = readFileSync(this.filePath, 'utf-8');
        return content.trim().split('\n').filter(Boolean).length;
    }

    /**
     * Clean up old log files based on retention policy
     */
    cleanup(): void {
        const dir = dirname(this.filePath);
        if (!existsSync(dir)) return;

        const files = readdirSync(dir);
        const now = Date.now();
        const maxAge = this.retentionDays * 24 * 60 * 60 * 1000;

        for (const file of files) {
            if (!file.endsWith('.jsonl')) continue;

            const filePath = join(dir, file);
            try {
                const content = readFileSync(filePath, 'utf-8');
                const lines = content.trim().split('\n').filter(Boolean);

                // Keep lines within retention period
                const keptLines: string[] = [];
                for (const line of lines) {
                    try {
                        const entry = JSON.parse(line) as ActivityLogEntry;
                        const age = now - new Date(entry.timestamp).getTime();
                        if (age < maxAge) {
                            keptLines.push(line);
                        }
                    } catch {
                        // Keep malformed lines
                        keptLines.push(line);
                    }
                }

                // Write back if any lines were removed
                if (keptLines.length < lines.length) {
                    if (keptLines.length === 0) {
                        unlinkSync(filePath);
                    } else {
                        const { writeFileSync } = require('node:fs');
                        writeFileSync(filePath, keptLines.join('\n') + '\n');
                    }
                }
            } catch {
                // Skip files we can't process
            }
        }
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
