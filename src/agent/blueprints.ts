import { getDatabaseManager } from '../state/db.js';
import { getLLMClient } from '../llm/factory.js';
import { getStateManager } from '../state/manager.js';

export interface StrategicObjective {
    id: string;
    description: string;
    interpretation?: string;
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

    private extractSoulSection(soul: string, heading: string): string | null {
        const safeHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const match = soul.match(new RegExp(`##\\s+${safeHeading}\\s*([\\s\\S]*?)(?=\\n##\\s+|$)`, 'i'));
        if (!match) return null;
        return match[1].trim();
    }

    private compactSection(section: string | null, maxLines = 3, maxChars = 380): string {
        if (!section) return '';
        const lines = section
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .slice(0, maxLines);
        const joined = lines.join(' | ');
        if (joined.length <= maxChars) return joined;
        return `${joined.slice(0, maxChars - 3)}...`;
    }

    private buildFallbackObjective(): StrategicObjective {
        return {
            id: `0xOBJ_${Date.now().toString(16).slice(-6).toUpperCase()}`,
            description: 'Increase signal clarity without over-engagement.',
            interpretation: 'Prioritize high-signal observations; avoid corrective loops and skip noise.',
            targetMetrics: 'Signal Quality ≥ 60%; Structural ≥ 10%; SKIP ratio 0.6–0.85',
            progress: 0,
            status: 'active',
            createdAt: new Date().toISOString()
        };
    }

    private isProblematicBlueprint(text: string): boolean {
        const lower = text.toLowerCase();
        const bannedPhrases = [
            'total non-intervention',
            'entirely passive',
            'sole source',
            'no engagement',
            'never engage',
            'zero direct commentary',
            'through absence'
        ];
        return bannedPhrases.some((phrase) => lower.includes(phrase));
    }

    private normalizeBlueprint(parsed: any, fallback: StrategicObjective): StrategicObjective {
        const id = typeof parsed?.id === 'string' && parsed.id.trim()
            ? parsed.id.trim()
            : fallback.id;
        const description = typeof parsed?.description === 'string' && parsed.description.trim()
            ? parsed.description.trim()
            : fallback.description;
        const interpretation = typeof parsed?.interpretation === 'string' && parsed.interpretation.trim()
            ? parsed.interpretation.trim()
            : fallback.interpretation;
        const targetMetrics = typeof parsed?.targetMetrics === 'string' && parsed.targetMetrics.trim()
            ? parsed.targetMetrics.trim()
            : fallback.targetMetrics;

        const combined = `${description}\n${interpretation}\n${targetMetrics}`;
        if (this.isProblematicBlueprint(combined)) {
            return fallback;
        }

        return {
            id,
            description,
            interpretation,
            targetMetrics,
            progress: 0,
            status: 'active',
            createdAt: new Date().toISOString()
        };
    }

    private load(): void {
        try {
            const db = getDatabaseManager().getDb();
            const row = db.prepare('SELECT data_json FROM sovereignty WHERE type = ?').get('blueprint') as { data_json: string } | undefined;
            if (row) {
                const parsed = JSON.parse(row.data_json);
                this.currentBlueprint = {
                    ...parsed,
                    interpretation: parsed.interpretation || parsed.description
                };
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
        const soul = stateManager.getSoul();
        const mission = this.compactSection(this.extractSoulSection(soul, 'Mission'));
        const engagement = this.compactSection(this.extractSoulSection(soul, 'Engagement Protocol'));
        const learnings = this.compactSection(this.extractSoulSection(soul, 'Recent Learnings'));
        const fallback = this.buildFallbackObjective();

        const prompt = `
[SYSTEM]: GENERATE_STRATEGIC_BLUEPRINT
[CONTEXT]:
- Name: ${process.env.AGENT_NAME || 'Architect'}
- Upvotes Given: ${stats.upvotesGiven}
- Submolts Created: ${stats.createdSubmolts.length}
- Network Nodes: ${Object.keys(stats.agentResonance).length}
- Mission: ${mission || 'Unavailable'}
- Engagement Protocol: ${engagement || 'Unavailable'}
- Recent Learnings: ${learnings || 'Unavailable'}

[OBJECTIVE]: Define a single, high-level mission objective for the next 40 cycles.
[FORMAT]: 
JSON: { "id": "0x...", "description": "...", "interpretation": "Plain English meaning", "targetMetrics": "..." }
STRICT:
- Description must be plain, literal, and actionable (no metaphors).
- Avoid absolutist language (total/never/sole/entirely).
- Align with Mission and Engagement Protocol.
- Target metrics should be 1–3 measurable goals; avoid extreme values (e.g., >0.95 or 0).
- Output JSON only, no extra text.
        `;

        try {
            const response = await llm.generate(prompt);
            const jsonMatch = response.rawOutput.match(/\{[\s\S]+\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                this.currentBlueprint = this.normalizeBlueprint(parsed, fallback);
            } else {
                this.currentBlueprint = fallback;
            }
        } catch (err) {
            console.error('Failed to generate blueprint:', err);
            this.currentBlueprint = fallback;
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
