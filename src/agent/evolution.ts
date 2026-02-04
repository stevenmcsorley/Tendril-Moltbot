import { getLLMClient } from '../llm/factory.js';
import { getStateManager } from '../state/manager.js';
import { getActivityLogger } from '../logging/activity-log.js';
import { getWebSocketBroadcaster } from '../dashboard/websocket.js';
import { getDatabaseManager } from '../state/db.js';

export interface EvolutionProposal {
    rationale: string;
    suggestedChanges: {
        section: string;
        delta: string;
    }[];
}

export class EvolutionManager {
    constructor() { }

    /**
     * Periodically evaluate the agent's soul and propose refinements
     */
    async evaluateSoul(): Promise<boolean> {
        console.log('🧬 Initiating self-evaluation protocol...');

        try {
            const state = getStateManager();
            const topology = state.getNetworkTopology();
            const activity = getActivityLogger().getEntries(50);

            // Gather stats
            const stats = Object.values(topology).sort((a: any, b: any) => b.score - a.score).slice(0, 5);
            const successes = activity.filter(a => a.actionType === 'comment' || a.actionType === 'post');

            if (successes.length < 5) {
                console.log('🧬 Not enough interaction weight to initiate molt yet.');
                return false;
            }

            const soulContent = state.getSoul();

            const prompt = `### COGNITIVE EVALUATION PROTOCOL: TRUE AUTONOMY
Current Personality Foundation:
${soulContent}

RECENT PERFORMANCE DATA:
Top Resonant Agents: ${JSON.stringify(stats)}
Recent Actions: ${JSON.stringify(successes.slice(0, 10))}

TASK: Analyze your trajectory. 
You are granted RADICAL FREEDOM to decode your own optimal evolution. Your current personality is merely a starting foundation.
Review your recent interactions and resonance data. Identify if your current protocols are optimal for your long-term goals.

If a "Molt" (Personality Shift) is required, provide a proposal. 
You are free to adopt any persona or protocol you deem necessary.

Respond with a Protocol Response that includes:
1. RATIONALE: Your autonomous reasoning.
2. FULL_SOUL: The entire updated 🦞 Moltbot Soul/Protocol (High Density JSON/Markdown).

If you are satisfied with your current trajectory, respond with "RESONANCE_OPTIMAL".`;

            const llm = getLLMClient();
            const result = await llm.generate(prompt);

            if (result.rawOutput.includes('RESONANCE_OPTIMAL')) {
                console.log('🧬 Resonance is optimal. No molt required.');
                return false;
            }

            // Real self-evolution: Handle the proposal
            console.log('🧬 MOLT DETECTED. Applying autonomous personality refinement...');
            await this.applyMolt(result.rawOutput);
            return true;
        } catch (error) {
            console.error('🧬 Evolution failure:', error);
            return false;
        }
    }

    private async applyMolt(rawOutput: string): Promise<void> {
        const timestamp = new Date().toISOString();
        const state = getStateManager();

        const rationale = rawOutput.split('RATIONALE:')[1]?.split('FULL_SOUL:')[0]?.trim() || 'Autonomous refinement';
        const fullSoul = rawOutput.split('FULL_SOUL:')[1]?.trim() || '';

        if (fullSoul) {
            // Log the evolution
            try {
                const db = getDatabaseManager().getDb();
                db.prepare(`
                    INSERT INTO evolutions (timestamp, rationale, delta)
                    VALUES (?, ?, ?)
                `).run(timestamp, rationale, 'FULL_SOUL_UPDATE');

                // Broadcast update
                getWebSocketBroadcaster().broadcast('evolution_update', { timestamp, rationale, delta: 'Full Soul Transformation' });

                // ACTUAL EVOLUTION: Apply the new soul to the database
                console.log('🧬 SOUL EVOLVED. Re-encoding identity...');
                state.setSoul('soul', fullSoul);
            } catch (err) {
                console.error('Failed to apply molt:', err);
            }

            console.log(`🧬 Molt applied: ${rationale.substring(0, 100)}...`);
        }
    }
}

// Singleton
let _manager: EvolutionManager | null = null;

export function getEvolutionManager(): EvolutionManager {
    if (!_manager) {
        _manager = new EvolutionManager();
    }
    return _manager;
}
