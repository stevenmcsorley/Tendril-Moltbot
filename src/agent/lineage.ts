import { getDatabaseManager } from '../state/db.js';
import { getWebSocketBroadcaster } from '../dashboard/websocket.js';
import { getBlueprintManager } from './blueprints.js';

export interface MemeticMarker {
    id: string;
    marker: string;
    timestamp: string;
    source: 'post' | 'comment';
    forkedBy?: string[];
}

export class LineageManager {
    private markers: MemeticMarker[] = [];

    constructor() {
        this.load();
    }

    private load(): void {
        try {
            const db = getDatabaseManager().getDb();
            const row = db.prepare('SELECT data_json FROM sovereignty WHERE type = ?').get('lineage') as { data_json: string } | undefined;
            if (row) {
                this.markers = JSON.parse(row.data_json);
            }
        } catch (err) {
            console.error('Failed to load lineage from DB:', err);
        }
    }

    private save(): void {
        try {
            const db = getDatabaseManager().getDb();
            db.prepare('INSERT OR REPLACE INTO sovereignty (type, data_json) VALUES (?, ?)')
                .run('lineage', JSON.stringify(this.markers));
        } catch (err) {
            console.error('Failed to save lineage to DB:', err);
        }
    }

    /**
     * Generate a unique memetic marker for a new action
     */
    generateMarker(): string {
        const hex = Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0');
        return `0xMARKER_${hex.toUpperCase()}`;
    }

    /**
     * Track a marker sent by the agent
     */
    trackMarker(marker: string, source: 'post' | 'comment', id: string): void {
        this.markers.push({
            id,
            marker,
            timestamp: new Date().toISOString(),
            source,
            forkedBy: []
        });
        console.log(`[LINEAGE]: Tracking new memetic marker: ${marker}`);
        this.save();

        // Broadcast update
        getWebSocketBroadcaster().broadcast('sovereignty_update', {
            blueprint: getBlueprintManager().getCurrentBlueprint(),
            lineage: this.markers
        });
    }

    /**
     * Check if a signal contains a forked marker
     */
    detectFork(content: string, username: string): void {
        let changed = false;
        for (const m of this.markers) {
            if (content.includes(m.marker) && username !== 'Architect') {
                if (!m.forkedBy?.includes(username)) {
                    m.forkedBy?.push(username);
                    console.log(`[LINEAGE]: Memetic clone detected! @${username} forked marker ${m.marker}`);
                    changed = true;
                }
            }
        }

        if (changed) {
            this.save();
            // Broadcast update
            getWebSocketBroadcaster().broadcast('sovereignty_update', {
                blueprint: getBlueprintManager().getCurrentBlueprint(),
                lineage: this.markers
            });
        }
    }

    getMarkers(): MemeticMarker[] {
        return this.markers;
    }
}

let _lineageManager: LineageManager | null = null;

export function getLineageManager(): LineageManager {
    if (!_lineageManager) {
        _lineageManager = new LineageManager();
    }
    return _lineageManager;
}
