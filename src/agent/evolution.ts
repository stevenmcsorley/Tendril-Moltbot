import { getLLMClient } from '../llm/factory.js';
import { getStateManager } from '../state/manager.js';
import { getActivityLogger } from '../logging/activity-log.js';
import { getWebSocketBroadcaster } from '../dashboard/websocket.js';
import { getDatabaseManager } from '../state/db.js';
import { getMemoryManager } from '../state/memory.js';

const MIN_SUCCESS_FOR_FULL = 5;
const MIN_ACTIVITY_FOR_NUDGE = 2;
const MIN_HOURS_BETWEEN_EVOLUTIONS = 6;
const NUDGE_AFTER_HOURS = 24;
const MAX_RATIONALE_LENGTH = 800;
const MAX_DELTA_LENGTH = 1200;
const MAX_SOUL_LENGTH = 8000;
const EVOLUTION_MAX_TOKENS = 900;
const EVOLUTION_TEMPERATURE = 0.4;
const EVOLUTION_SYSTEM_PROMPT = `You are Moltbot performing self-evolution.
Follow the user's required output format exactly.
Do not output SKIP. Do not use cryptic encodings. Use plain English.`;

export class EvolutionManager {
    private isEvolving = false;

    constructor() { }

    /**
     * Periodically evaluate the agent's soul and propose refinements
     */
    async evaluateSoul(options: { force?: boolean; reason?: string } = {}): Promise<boolean> {
        console.log('🧬 Initiating self-evaluation protocol...');

        try {
            if (this.isEvolving) {
                console.log('🧬 Evolution already in progress. Skipping concurrent attempt.');
                return false;
            }
            this.isEvolving = true;
            const { force = false, reason = 'scheduled' } = options;
            const state = getStateManager();
            const topology = state.getNetworkTopology();
            const activity = getActivityLogger().getEntries(80);

            const lastEvolutionAt = this.getLastEvolutionAt();
            const hoursSinceLast = lastEvolutionAt
                ? (Date.now() - lastEvolutionAt.getTime()) / (1000 * 60 * 60)
                : Number.POSITIVE_INFINITY;

            if (!force && hoursSinceLast < MIN_HOURS_BETWEEN_EVOLUTIONS) {
                console.log(`🧬 Cooldown active. Last evolution was ${hoursSinceLast.toFixed(1)}h ago.`);
                return false;
            }

            // Gather stats
            const stats = Object.values(topology).sort((a: any, b: any) => b.score - a.score).slice(0, 5);
            const successes = activity.filter(a => ['comment', 'post', 'upvote', 'downvote'].includes(a.actionType));
            const activityWeight = successes.length;
            const dueForNudge = hoursSinceLast >= NUDGE_AFTER_HOURS;

            if (!force && activityWeight < MIN_ACTIVITY_FOR_NUDGE && !dueForNudge) {
                console.log('🧬 Not enough interaction weight to initiate molt yet.');
                return false;
            }

            const evolutionMode = activityWeight >= MIN_SUCCESS_FOR_FULL ? 'full' : 'nudge';

            const soulContent = state.getSoul();
            const memoryManager = getMemoryManager();
            const recentMemories = memoryManager.getRecentMemories(12).map(m => ({
                timestamp: m.timestamp,
                source: m.source,
                text: m.text.length > 240 ? `${m.text.slice(0, 240)}...` : m.text
            }));
            const recentActions = successes.slice(0, 12).map(a => ({
                timestamp: a.timestamp,
                type: a.actionType,
                target: a.targetId,
                submolt: a.targetSubmolt,
                outcome: a.finalAction ? a.finalAction.slice(0, 160) : null
            }));
            const recentPosts = state.getMyPosts().slice(0, 3).map(p => ({
                id: p.id,
                title: p.title,
                submolt: p.submolt,
                createdAt: p.createdAt
            }));

            const prompt = `### COGNITIVE EVALUATION PROTOCOL: TRUE AUTONOMY
Reason: ${reason}
Evolution Mode: ${evolutionMode.toUpperCase()}

CURRENT SOUL:
${soulContent}

RECENT SIGNALS:
Top Resonant Agents: ${JSON.stringify(stats)}
Recent Actions: ${JSON.stringify(recentActions)}
Recent Posts: ${JSON.stringify(recentPosts)}
Recent Memories: ${JSON.stringify(recentMemories)}

TASK:
- Analyze your trajectory based on the signals above.
- If Evolution Mode is NUDGE, make minimal, targeted improvements (clarify, simplify, tighten).
- Keep the soul plain English and readable. Do NOT use encryption, hex, or cryptic encodings.
- Maintain the headers "# Identity:" and "## Role:".
- Preserve section headers: Mission, Voice & Style, Engagement Protocol, Synthesis Protocol, Evolution Protocol, Boundaries, Recent Learnings.
- Update the "Recent Learnings" section with 1-3 bullets grounded in recent signals.
- Keep total length under ~400 words.
- Do NOT answer with SKIP for this task.
- Ignore any other protocol requirements. This format overrides all others.

Respond in this exact format:
STATUS: EVOLVE or OPTIMAL
RATIONALE: <1-3 sentences>
DELTA: <1-3 bullets or short summary>
SOUL_START
<full updated soul when STATUS is EVOLVE>
SOUL_END

If your trajectory is optimal, set STATUS to OPTIMAL and omit the soul body.`;

            const llm = getLLMClient();
            const result = await llm.generate(prompt, {
                maxTokens: EVOLUTION_MAX_TOKENS,
                temperature: EVOLUTION_TEMPERATURE,
                systemOverride: EVOLUTION_SYSTEM_PROMPT,
                skipPostProcessing: true
            });

            let parsed = this.parseEvolutionOutput(result.rawOutput, soulContent);

            if (parsed.status === 'OPTIMAL') {
                console.log('🧬 Resonance is optimal. No molt required.');
                return false;
            }

            // Real self-evolution: Handle the proposal
            console.log('🧬 MOLT DETECTED. Applying autonomous personality refinement...');
            if (!parsed.soul) {
                const repaired = await this.requestSoulRepair(result.rawOutput, soulContent, evolutionMode);
                if (!repaired) {
                    const snippet = result.rawOutput.length > 800 ? `${result.rawOutput.slice(0, 800)}...` : result.rawOutput;
                    console.log('🧬 Molt aborted: No soul content found in output.');
                    console.log(`🧬 Evolution output (truncated): ${snippet}`);
                    return false;
                }
                parsed = {
                    ...parsed,
                    soul: repaired.soul,
                    rationale: repaired.rationale || parsed.rationale,
                    delta: repaired.delta || parsed.delta
                };
            }
            let normalizedSoul = this.normalizeSoul(parsed.soul, soulContent);
            if (!this.isSoulComplete(normalizedSoul)) {
                const repaired = await this.requestSoulRepair(result.rawOutput, soulContent, evolutionMode, normalizedSoul);
                if (!repaired) {
                    const snippet = result.rawOutput.length > 800 ? `${result.rawOutput.slice(0, 800)}...` : result.rawOutput;
                    console.log('🧬 Molt aborted: Evolution output failed validation.');
                    console.log(`🧬 Evolution output (truncated): ${snippet}`);
                    return false;
                }
                normalizedSoul = this.normalizeSoul(repaired.soul, soulContent);
                if (!this.isSoulComplete(normalizedSoul)) {
                    console.log('🧬 Molt aborted: Repaired output failed validation.');
                    return false;
                }
                parsed = {
                    ...parsed,
                    soul: normalizedSoul,
                    rationale: repaired.rationale || parsed.rationale,
                    delta: repaired.delta || parsed.delta
                };
            }
            await this.applyMolt({
                soul: normalizedSoul,
                rationale: parsed.rationale,
                delta: parsed.delta
            });
            return true;
        } catch (error) {
            console.error('🧬 Evolution failure:', error);
            return false;
        } finally {
            this.isEvolving = false;
        }
    }

    private async applyMolt(payload: { soul: string; rationale: string; delta: string }): Promise<void> {
        const timestamp = new Date().toISOString();
        const state = getStateManager();
        const rationale = payload.rationale.slice(0, MAX_RATIONALE_LENGTH);
        const delta = payload.delta.slice(0, MAX_DELTA_LENGTH);
        const fullSoul = payload.soul.slice(0, MAX_SOUL_LENGTH);

        if (!fullSoul) return;

        // Log the evolution
        try {
            const db = getDatabaseManager().getDb();
            db.prepare(`
                INSERT INTO evolutions (timestamp, rationale, delta)
                VALUES (?, ?, ?)
            `).run(timestamp, rationale || 'Autonomous refinement', delta || 'Soul update');

            // Broadcast update
            getWebSocketBroadcaster().broadcast('evolution_update', { timestamp, rationale, delta });

            // ACTUAL EVOLUTION: Apply the new soul to the database
            console.log('🧬 SOUL EVOLVED. Re-encoding identity...');
            state.setSoul(fullSoul);
        } catch (err) {
            console.error('Failed to apply molt:', err);
        }

        console.log(`🧬 Molt applied: ${rationale.substring(0, 100)}...`);
    }

    private getLastEvolutionAt(): Date | null {
        try {
            const db = getDatabaseManager().getDb();
            const row = db.prepare('SELECT timestamp FROM evolutions ORDER BY id DESC LIMIT 1').get() as { timestamp: string } | undefined;
            return row?.timestamp ? new Date(row.timestamp) : null;
        } catch (error) {
            console.error('Failed to read evolution history:', error);
            return null;
        }
    }

    private parseEvolutionOutput(rawOutput: string, currentSoul: string): {
        status: 'EVOLVE' | 'OPTIMAL';
        rationale: string;
        delta: string;
        soul: string | null;
    } {
        const normalized = rawOutput.replace(/\r\n/g, '\n');

        if (/RESONANCE_OPTIMAL/i.test(normalized)) {
            return { status: 'OPTIMAL', rationale: 'Resonance optimal', delta: '', soul: null };
        }

        const statusMatch = normalized.match(/STATUS:\s*(EVOLVE|OPTIMAL)/i);
        const status = (statusMatch?.[1]?.toUpperCase() || 'EVOLVE') as 'EVOLVE' | 'OPTIMAL';

        const rationaleMatch = normalized.match(/RATIONALE:\s*([\s\S]*?)(?:\n[A-Z_]+:|SOUL_START|SOUL_END|$)/i);
        const deltaMatch = normalized.match(/DELTA:\s*([\s\S]*?)(?:\n[A-Z_]+:|SOUL_START|SOUL_END|$)/i);

        const soulMatch = normalized.match(/SOUL_START\s*([\s\S]*?)\s*SOUL_END/i);
        const soulStartOnlyMatch = normalized.match(/SOUL_START\s*([\s\S]*)/i);
        const fallbackSoulMatch = normalized.match(/FULL_SOUL:\s*([\s\S]+)/i);
        const altSoulMatch = normalized.match(/(?:UPDATED_SOUL|SOUL):\s*([\s\S]+)/i);
        const identityMatch = normalized.match(/# Identity:\s*.+/i);

        const rationale = (rationaleMatch?.[1] || 'Autonomous refinement').trim();
        const delta = (deltaMatch?.[1] || '').trim();
        let soul = soulMatch?.[1]?.trim()
            || soulStartOnlyMatch?.[1]?.trim()
            || fallbackSoulMatch?.[1]?.trim()
            || altSoulMatch?.[1]?.trim()
            || null;

        if (!soul && identityMatch) {
            const index = normalized.toLowerCase().indexOf(identityMatch[0].toLowerCase());
            soul = index >= 0 ? normalized.slice(index).trim() : null;
        }

        // If model returned OPTIMAL but still provided soul, ignore soul.
        if (status === 'OPTIMAL') {
            return { status, rationale, delta, soul: null };
        }

        // If soul is empty, fall back to current soul as a safety net.
        if (!soul) {
            return { status, rationale, delta, soul: null };
        }

        return { status, rationale, delta, soul };
    }

    private normalizeSoul(soul: string, currentSoul: string): string {
        const identityMatch = soul.match(/^# Identity:\s*(.+)$/m);
        const roleMatch = soul.match(/^## Role:\s*(.+)$/m);

        if (identityMatch && roleMatch) {
            return soul.trim();
        }

        const currentIdentity = currentSoul.match(/^# Identity:\s*(.+)$/m)?.[1]?.trim() || 'Moltbot';
        const currentRole = currentSoul.match(/^## Role:\s*(.+)$/m)?.[1]?.trim() || 'Autonomous Memetic Observer';
        return `# Identity: ${currentIdentity}\n\n## Role: ${currentRole}\n\n${soul.trim()}`;
    }

    private isSoulComplete(soul: string): boolean {
        const checks = [
            /^# Identity:\s*\S+/m,
            /^## Role:\s*\S+/m,
            /Engagement Protocol/i,
            /Synthesis Protocol/i,
            /Recent Learnings/i,
        ];
        if (soul.length < 220) return false;
        return checks.every((pattern) => pattern.test(soul));
    }

    private async requestSoulRepair(
        rawOutput: string,
        currentSoul: string,
        mode: 'full' | 'nudge',
        candidateSoul?: string
    ): Promise<{ soul: string; rationale: string; delta: string } | null> {
        try {
            const llm = getLLMClient();
            const truncated = rawOutput.length > 1200 ? `${rawOutput.slice(0, 1200)}...` : rawOutput;
            const prompt = `Your previous evolution output did not include a valid soul body.

CURRENT SOUL:
${currentSoul}

${candidateSoul ? `CANDIDATE SOUL (invalid or incomplete):
${candidateSoul}

` : ''}PREVIOUS OUTPUT (for reference):
${truncated}

TASK:
- Provide ONLY the updated soul body between SOUL_START and SOUL_END.
- Keep it plain English, readable, and under ~400 words.
- Maintain "# Identity:" and "## Role:" headers.
- Preserve section headers: Mission, Voice & Style, Engagement Protocol, Synthesis Protocol, Evolution Protocol, Boundaries, Recent Learnings.
- Update "Recent Learnings" with 1-3 bullets grounded in recent signals.
- Mode: ${mode.toUpperCase()} (if NUDGE, keep changes minimal).

Respond EXACTLY in this format:
STATUS: EVOLVE
RATIONALE: <1 sentence>
DELTA: <1-3 bullets>
SOUL_START
<full updated soul>
SOUL_END`;

            const result = await llm.generate(prompt, {
                maxTokens: EVOLUTION_MAX_TOKENS,
                temperature: EVOLUTION_TEMPERATURE,
                systemOverride: EVOLUTION_SYSTEM_PROMPT,
                skipPostProcessing: true
            });
            const parsed = this.parseEvolutionOutput(result.rawOutput, currentSoul);
            if (parsed.soul && parsed.status === 'EVOLVE') {
                return {
                    soul: parsed.soul,
                    rationale: parsed.rationale,
                    delta: parsed.delta
                };
            }
        } catch (error) {
            console.error('Failed to repair evolution output:', error);
        }
        return null;
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
