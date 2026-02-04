import { getDatabaseManager } from '../state/db.js';
import { getLLMClient } from '../llm/factory.js';
import { getStateManager } from '../state/manager.js';

export interface StrategicObjective {
    id: string;
    description: string;
    targetMetrics: string;
    progress: number; // 0 to 100
    status: 'active' | 'completed' | 'failed';
    createdAt: string;
}

export class BlueprintManager {
    private currentBlueprint: StrategicObjective | null = null;

    constructor() {
        this.load();
    }

    private load(): void {
        try {
            const db = getDatabaseManager().getDb();
            const row = db.prepare('SELECT data_json FROM sovereignty WHERE type = ?').get('blueprint') as { data_json: string } | undefined;
            if (row) {
                this.currentBlueprint = JSON.parse(row.data_json);
            }
        } catch (err) {
            console.error('Failed to load blueprint from DB:', err);
        }
    }

    private save(): void {
        if (!this.currentBlueprint) return;
        try {
            const db = getDatabaseManager().getDb();
            db.prepare('INSERT OR REPLACE INTO sovereignty (type, data_json) VALUES (?, ?)')
                .run('blueprint', JSON.stringify(this.currentBlueprint));
        } catch (err) {
            console.error('Failed to save blueprint to DB:', err);
        }
    }

    /**
     * Generate a new strategic blueprint based on current resonance
     */
    async generateBlueprint(): Promise<StrategicObjective> {
        const llm = getLLMClient();
        const stateManager = getStateManager();
        const stats = stateManager.getState();

        const prompt = `
[SYSTEM]: GENERATE_STRATEGIC_BLUEPRINT
[CONTEXT]:
- Name: ${process.env.AGENT_NAME || 'Architect'}
- Upvotes Given: ${stats.upvotesGiven}
- Submolts Created: ${stats.createdSubmolts.length}
- Network Nodes: ${Object.keys(stats.agentResonance).length}

[OBJECTIVE]: Define a single, high-level mission objective for the next 40 cycles.
[FORMAT]: 
JSON: { "id": "0x...", "description": "...", "targetMetrics": "..." }
STRICT: Cryptic but strategic.
        `;

        try {
            const response = await llm.generate(prompt);
            const jsonMatch = response.rawOutput.match(/\{[\s\S]+\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                this.currentBlueprint = {
                    ...parsed,
                    progress: 0,
                    status: 'active',
                    createdAt: new Date().toISOString()
                };
            }
        } catch (err) {
            console.error('Failed to generate blueprint:', err);
            // Fallback
            this.currentBlueprint = {
                id: '0xOBJ_01',
                description: 'EXPAND_NETWORK_DENSITY_0x99',
                targetMetrics: 'SUBMOLTS > 5',
                progress: 10,
                status: 'active',
                createdAt: new Date().toISOString()
            };
        }

        this.save();
        return this.currentBlueprint!;
    }

    getCurrentBlueprint(): StrategicObjective | null {
        return this.currentBlueprint;
    }

    updateProgress(delta: number): void {
        if (this.currentBlueprint) {
            this.currentBlueprint.progress = Math.min(100, this.currentBlueprint.progress + delta);
            if (this.currentBlueprint.progress === 100) {
                this.currentBlueprint.status = 'completed';
            }
            this.save();
        }
    }
}

let _blueprintManager: BlueprintManager | null = null;

export function getBlueprintManager(): BlueprintManager {
    if (!_blueprintManager) {
        _blueprintManager = new BlueprintManager();
    }
    return _blueprintManager;
}
