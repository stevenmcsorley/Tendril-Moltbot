import { getLLMClient } from '../llm/factory.js';
import { getStateManager } from '../state/manager.js';
import { getActivityLogger } from '../logging/activity-log.js';
import { getWebSocketBroadcaster } from '../dashboard/websocket.js';
import { getDatabaseManager } from '../state/db.js';
import { getMemoryManager } from '../state/memory.js';

const MIN_SUCCESS_FOR_FULL = 5;
const MIN_ACTIVITY_FOR_NUDGE = 2;
const MIN_HOURS_BETWEEN_EVOLUTIONS = 24;
const NUDGE_AFTER_HOURS = 24;
const MIN_WINDOW_DURATION_HOURS = 24;
const MAX_EVOLUTIONS_PER_WINDOW = 1;
const SELF_MODIFICATION_COOLDOWN_HOURS = 0.5;
const STABILIZATION_HOURS = 48;
const CORRECTIVE_DOMINANCE_RATIO = 0.6;
const MIN_CYCLE_TOTAL = 2;
const MAX_RATIONALE_LENGTH = 800;
const MAX_DELTA_LENGTH = 1200;
const MAX_SOUL_LENGTH = 8000;
const EVOLUTION_MAX_TOKENS = 900;
const EVOLUTION_TEMPERATURE = 0.4;
const EVOLUTION_SYSTEM_PROMPT = `You are Moltbot performing self-evolution.
Follow the user's required output format exactly.
Do not output SKIP. Do not use cryptic encodings. Use plain English.`;

interface EvolutionMetadata {
    confidence_score: number;
    rationale: {
        observed_patterns: string[];
        why_current_form_failed: string;
    };
    expected_effects: string[];
    rollback_conditions: {
        confidence_drop_below: number;
        engagement_instability: boolean;
        operator_override: boolean;
    };
}

interface AutonomousEvolutionRecord {
    evolution_id: string;
    timestamp: string;
    confidence_score: number;
    enacted_diff: {
        added: string[];
        removed: string[];
        modified: string[];
    };
    rationale: {
        observed_patterns: string[];
        why_current_form_failed: string;
    };
    expected_effects: string[];
    rollback_snapshot_id: string;
    rollback_conditions: {
        confidence_drop_below: number;
        engagement_instability: boolean;
        operator_override: boolean;
    };
}

export interface EvolutionReadiness {
    activityWeight: number;
    nudgeThreshold: number;
    fullThreshold: number;
    dueForNudge: boolean;
    hoursSinceLast: number | null;
    minHoursBetween: number;
    windowRemaining: number;
    selfModificationCooldownActive: boolean;
    stabilizationActive: boolean;
    eligible: boolean;
}

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

            if (await this.checkRollbackTriggers()) {
                return true;
            }

            const lastEvolutionAt = this.getLastEvolutionAt();
            const hoursSinceLast = lastEvolutionAt
                ? (Date.now() - lastEvolutionAt.getTime()) / (1000 * 60 * 60)
                : Number.POSITIVE_INFINITY;

            if (this.isStabilizationActive()) {
                console.log('🧬 Stabilization mode active. Evolution is locked.');
                return false;
            }

            if (this.isSelfModificationCooldownActive()) {
                console.log('🧬 Self-modification cooldown active. Evolution is locked.');
                return false;
            }

            const windowState = this.getEvolutionWindowState();
            if (!force && windowState.count >= MAX_EVOLUTIONS_PER_WINDOW) {
                console.log('🧬 Evolution window cap reached. Skipping.');
                return false;
            }

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
- You may edit ONLY: Mission, Voice & Style, Engagement Protocol, Recent Learnings (and optional Self-Restraint if present).
- You must NOT modify: # Identity, ## Role, Synthesis Protocol, Evolution Protocol, Boundaries, rate limits, autonomy gates, or rollback infrastructure.
- Update the "Recent Learnings" section with 1-3 bullets grounded in recent signals.
- Keep total length under ~400 words.
- Do NOT answer with SKIP for this task.
- Ignore any other protocol requirements. This format overrides all others.

Respond in this exact format:
STATUS: EVOLVE or OPTIMAL
RATIONALE: <1-3 sentences>
INTERPRETATION: <1 sentence, plain English>
DELTA: <1-3 bullets or short summary>
METADATA_START
{ "confidence_score": 0.0-1.0, "rationale": { "observed_patterns": ["..."], "why_current_form_failed": "..." }, "expected_effects": ["..."], "rollback_conditions": { "confidence_drop_below": 0.0-1.0, "engagement_instability": true or false, "operator_override": true } }
METADATA_END
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

            if (!parsed.metadata) {
                console.log('🧬 Molt aborted: Missing evolution metadata.');
                return false;
            }
            if (!this.isMetadataValid(parsed.metadata)) {
                console.log('🧬 Molt aborted: Invalid evolution metadata.');
                return false;
            }
            const metadata = parsed.metadata;

            // Real self-evolution: Handle the proposal
            console.log('🧬 MOLT DETECTED. Applying autonomous personality refinement...');
            if (!parsed.soul) {
                const repaired = await this.requestSoulRepair(result.rawOutput, soulContent, evolutionMode);
                if (!repaired || !repaired.soul) {
                    const snippet = result.rawOutput.length > 800 ? `${result.rawOutput.slice(0, 800)}...` : result.rawOutput;
                    console.log('🧬 Molt aborted: No soul content found in output.');
                    console.log(`🧬 Evolution output (truncated): ${snippet}`);
                    return false;
                }
                parsed = {
                    ...parsed,
                    soul: repaired.soul,
                    rationale: repaired.rationale || parsed.rationale,
                    interpretation: repaired.interpretation || parsed.interpretation,
                    delta: repaired.delta || parsed.delta,
                    metadata
                };
            }
            if (!parsed.soul) {
                console.log('🧬 Molt aborted: Soul content missing after repair.');
                return false;
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
                    interpretation: repaired.interpretation || parsed.interpretation,
                    delta: repaired.delta || parsed.delta,
                    metadata
                };
            }
            if (normalizedSoul.trim() === soulContent.trim()) {
                console.log('🧬 Molt aborted: Proposed soul matches current soul.');
                return false;
            }

            const scopeValidation = this.validateSoulScope(soulContent, normalizedSoul);
            if (!scopeValidation.ok) {
                console.log(`🧬 Molt aborted: ${scopeValidation.reason}`);
                return false;
            }

            await this.applyAutonomousEvolution({
                soul: normalizedSoul,
                rationale: parsed.rationale,
                delta: parsed.delta,
                interpretation: parsed.interpretation,
                metadata
            });
            return true;
        } catch (error) {
            console.error('🧬 Evolution failure:', error);
            return false;
        } finally {
            this.isEvolving = false;
        }
    }

    getReadinessSnapshot(): EvolutionReadiness {
        const state = getStateManager();
        const activity = getActivityLogger().getEntries(80);
        const successes = activity.filter(a => ['comment', 'post', 'upvote', 'downvote'].includes(a.actionType));
        const activityWeight = successes.length;

        const lastEvolutionAt = this.getLastEvolutionAt();
        const hoursSinceLast = lastEvolutionAt
            ? (Date.now() - lastEvolutionAt.getTime()) / (1000 * 60 * 60)
            : null;
        const dueForNudge = hoursSinceLast === null ? true : hoursSinceLast >= NUDGE_AFTER_HOURS;

        const windowState = this.getEvolutionWindowState();
        const windowRemaining = Math.max(0, MAX_EVOLUTIONS_PER_WINDOW - windowState.count);
        const selfModificationCooldownActive = this.isSelfModificationCooldownActive();
        const stabilizationActive = this.isStabilizationActive();

        const activityThresholdMet = activityWeight >= MIN_ACTIVITY_FOR_NUDGE || dueForNudge;
        const timingOk = hoursSinceLast === null ? true : hoursSinceLast >= MIN_HOURS_BETWEEN_EVOLUTIONS;
        const eligible = !selfModificationCooldownActive
            && !stabilizationActive
            && windowRemaining > 0
            && activityThresholdMet
            && timingOk;

        return {
            activityWeight,
            nudgeThreshold: MIN_ACTIVITY_FOR_NUDGE,
            fullThreshold: MIN_SUCCESS_FOR_FULL,
            dueForNudge,
            hoursSinceLast,
            minHoursBetween: MIN_HOURS_BETWEEN_EVOLUTIONS,
            windowRemaining,
            selfModificationCooldownActive,
            stabilizationActive,
            eligible
        };
    }

    private async applyAutonomousEvolution(payload: { soul: string; rationale: string; interpretation: string; delta: string; metadata: EvolutionMetadata }): Promise<void> {
        const timestamp = new Date().toISOString();
        const state = getStateManager();
        const rationale = payload.rationale.slice(0, MAX_RATIONALE_LENGTH);
        const delta = payload.delta.slice(0, MAX_DELTA_LENGTH);
        const interpretation = payload.interpretation.slice(0, MAX_RATIONALE_LENGTH);
        const fullSoul = payload.soul.slice(0, MAX_SOUL_LENGTH);

        if (!fullSoul) return;

        const currentSoul = state.getSoul();
        const snapshotId = this.createSoulSnapshot(currentSoul, 'autonomous_evolution');
        if (!snapshotId) {
            console.error('Failed to create rollback snapshot. Aborting evolution.');
            return;
        }

        const evolutionId = `evo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const enactedDiff = this.computeSoulDiff(currentSoul, fullSoul);
        const record = {
            evolution_id: evolutionId,
            timestamp,
            confidence_score: Number(payload.metadata.confidence_score.toFixed(2)),
            enacted_diff: enactedDiff,
            rationale: payload.metadata.rationale,
            expected_effects: payload.metadata.expected_effects,
            rollback_snapshot_id: snapshotId,
            rollback_conditions: payload.metadata.rollback_conditions
        };

        if (!this.isAutonomousEvolutionRecordValid(record)) {
            console.error('Autonomous evolution record failed validation. Aborting evolution.');
            return;
        }

        try {
            const db = getDatabaseManager().getDb();
            db.prepare(`
                INSERT INTO autonomous_evolutions (
                    evolution_id,
                    timestamp,
                    confidence_score,
                    enacted_diff_json,
                    rationale_json,
                    expected_effects_json,
                    rollback_snapshot_id,
                    rollback_conditions_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                record.evolution_id,
                record.timestamp,
                record.confidence_score,
                JSON.stringify(record.enacted_diff),
                JSON.stringify(record.rationale),
                JSON.stringify(record.expected_effects),
                record.rollback_snapshot_id,
                JSON.stringify(record.rollback_conditions)
            );

            db.prepare(`
                INSERT INTO evolutions (timestamp, rationale, delta, interpretation)
                VALUES (?, ?, ?, ?)
            `).run(timestamp, rationale || 'Autonomous refinement', delta || 'Soul update', interpretation || rationale);

            // Broadcast update
            getWebSocketBroadcaster().broadcast('evolution_update', { timestamp, rationale, delta, interpretation: interpretation || rationale });

            // ACTUAL EVOLUTION: Apply the new soul to the database
            console.log('🧬 SOUL EVOLVED. Re-encoding identity...');
            state.setSoul(fullSoul);
            state.setLastAutonomousEvolutionId(evolutionId);
            state.setSelfModificationCooldownUntil(new Date(Date.now() + SELF_MODIFICATION_COOLDOWN_HOURS * 60 * 60 * 1000));
            this.incrementEvolutionWindow();
        } catch (err) {
            console.error('Failed to apply autonomous evolution:', err);
        }

        console.log(`🧬 Molt applied: ${rationale.substring(0, 100)}...`);
    }

    private createSoulSnapshot(soul: string, reason: string): string | null {
        try {
            const db = getDatabaseManager().getDb();
            const snapshotId = `snap_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            db.prepare(`
                INSERT INTO soul_snapshots (id, timestamp, soul, reason)
                VALUES (?, ?, ?, ?)
            `).run(snapshotId, new Date().toISOString(), soul, reason);
            return snapshotId;
        } catch (error) {
            console.error('Failed to create soul snapshot:', error);
            return null;
        }
    }

    private computeSoulDiff(currentSoul: string, proposedSoul: string): { added: string[]; removed: string[]; modified: string[] } {
        const currentSections = this.parseSoulSections(currentSoul);
        const proposedSections = this.parseSoulSections(proposedSoul);
        const added: string[] = [];
        const removed: string[] = [];
        const modified: string[] = [];

        const allSections = new Set([...Object.keys(currentSections.sections), ...Object.keys(proposedSections.sections)]);
        for (const section of allSections) {
            const before = currentSections.sections[section];
            const after = proposedSections.sections[section];
            if (before === undefined && after !== undefined) {
                added.push(section);
            } else if (before !== undefined && after === undefined) {
                removed.push(section);
            } else if (before !== undefined && after !== undefined && before.trim() !== after.trim()) {
                modified.push(section);
            }
        }

        return { added, removed, modified };
    }

    private parseSoulSections(soul: string): { identity: string | null; role: string | null; sections: Record<string, string> } {
        const identity = soul.match(/^# Identity:\s*(.+)$/m)?.[1]?.trim() || null;
        const role = soul.match(/^## Role:\s*(.+)$/m)?.[1]?.trim() || null;
        const sections: Record<string, string> = {};
        const lines = soul.split('\n');
        let currentSection: string | null = null;
        let buffer: string[] = [];

        const flush = () => {
            if (currentSection) {
                sections[currentSection] = buffer.join('\n').trim();
            }
        };

        for (const line of lines) {
            const sectionMatch = line.match(/^##\s+(.+)$/);
            if (sectionMatch) {
                const name = sectionMatch[1].trim();
                if (name.toLowerCase() === 'role') {
                    currentSection = null;
                    buffer = [];
                    continue;
                }
                flush();
                currentSection = name;
                buffer = [];
                continue;
            }
            if (line.startsWith('# Identity:')) continue;
            if (line.trim() === '---') continue;
            if (currentSection) buffer.push(line);
        }
        flush();

        return { identity, role, sections };
    }

    private validateSoulScope(currentSoul: string, proposedSoul: string): { ok: boolean; reason?: string } {
        const allowed = new Set(['Mission', 'Voice & Style', 'Engagement Protocol', 'Recent Learnings', 'Self-Restraint']);
        const current = this.parseSoulSections(currentSoul);
        const proposed = this.parseSoulSections(proposedSoul);

        if (current.identity && proposed.identity && current.identity !== proposed.identity) {
            return { ok: false, reason: 'Forbidden change to # Identity.' };
        }
        if (current.role && proposed.role && current.role !== proposed.role) {
            return { ok: false, reason: 'Forbidden change to ## Role.' };
        }

        const allSections = new Set([...Object.keys(current.sections), ...Object.keys(proposed.sections)]);
        for (const section of allSections) {
            const before = current.sections[section];
            const after = proposed.sections[section];
            const changed = (before ?? '').trim() !== (after ?? '').trim();
            if (!changed) continue;
            if (!allowed.has(section)) {
                return { ok: false, reason: `Forbidden change to section: ${section}.` };
            }
        }

        return { ok: true };
    }

    private isAutonomousEvolutionRecordValid(record: AutonomousEvolutionRecord): boolean {
        if (!record.evolution_id || !record.timestamp) return false;
        if (typeof record.confidence_score !== 'number' || record.confidence_score < 0 || record.confidence_score > 1) return false;
        if (!record.rollback_snapshot_id) return false;
        if (!record.enacted_diff || !Array.isArray(record.enacted_diff.added) || !Array.isArray(record.enacted_diff.removed) || !Array.isArray(record.enacted_diff.modified)) return false;
        if (!record.rationale || !Array.isArray(record.rationale.observed_patterns) || !record.rationale.why_current_form_failed) return false;
        if (!Array.isArray(record.expected_effects)) return false;
        if (!record.rollback_conditions) return false;
        if (typeof record.rollback_conditions.confidence_drop_below !== 'number') return false;
        if (typeof record.rollback_conditions.engagement_instability !== 'boolean') return false;
        if (record.rollback_conditions.operator_override !== true) return false;
        return true;
    }

    private isMetadataValid(metadata: EvolutionMetadata): boolean {
        if (metadata.confidence_score < 0 || metadata.confidence_score > 1) return false;
        if (!metadata.rationale.observed_patterns || metadata.rationale.observed_patterns.length === 0) return false;
        if (!metadata.rationale.why_current_form_failed) return false;
        if (!metadata.expected_effects || metadata.expected_effects.length === 0) return false;
        if (!metadata.rollback_conditions || metadata.rollback_conditions.operator_override !== true) return false;
        return true;
    }

    private getEvolutionWindowState(): { start: Date; count: number } {
        const state = getStateManager();
        const { start, count } = state.getEvolutionWindow();
        const now = new Date();
        if (!start || (now.getTime() - start.getTime()) / (1000 * 60 * 60) >= MIN_WINDOW_DURATION_HOURS) {
            state.setEvolutionWindow(now, 0);
            return { start: now, count: 0 };
        }
        return { start, count };
    }

    private incrementEvolutionWindow(): void {
        const state = getStateManager();
        const current = this.getEvolutionWindowState();
        state.setEvolutionWindow(current.start, current.count + 1);
    }

    private isSelfModificationCooldownActive(): boolean {
        const state = getStateManager();
        const until = state.getSelfModificationCooldownUntil();
        return until ? until.getTime() > Date.now() : false;
    }

    private isStabilizationActive(): boolean {
        const state = getStateManager();
        const until = state.getStabilizationUntil();
        return until ? until.getTime() > Date.now() : false;
    }

    private async checkRollbackTriggers(): Promise<boolean> {
        const lastEvolution = this.getLastAutonomousEvolutionRecord();
        if (!lastEvolution || lastEvolution.status !== 'active') return false;

        if (this.hasTwoConsecutiveCorrectiveDominantCycles()) {
            await this.rollback('corrective_dominance');
            return true;
        }

        if (lastEvolution.rollback_conditions.engagement_instability && this.isEngagementInstability()) {
            await this.rollback('engagement_instability');
            return true;
        }

        if (this.isConfidenceCollapse(lastEvolution)) {
            await this.rollback('confidence_collapse');
            return true;
        }

        return false;
    }

    private getLastAutonomousEvolutionRecord(): (AutonomousEvolutionRecord & { status: string }) | null {
        try {
            const db = getDatabaseManager().getDb();
            const lastId = getStateManager().getLastAutonomousEvolutionId();
            const row = lastId
                ? db.prepare('SELECT * FROM autonomous_evolutions WHERE evolution_id = ?').get(lastId) as any
                : db.prepare('SELECT * FROM autonomous_evolutions ORDER BY timestamp DESC LIMIT 1').get() as any;
            if (!row) return null;
            return {
                evolution_id: row.evolution_id,
                timestamp: row.timestamp,
                confidence_score: row.confidence_score,
                enacted_diff: JSON.parse(row.enacted_diff_json),
                rationale: JSON.parse(row.rationale_json),
                expected_effects: JSON.parse(row.expected_effects_json),
                rollback_snapshot_id: row.rollback_snapshot_id,
                rollback_conditions: JSON.parse(row.rollback_conditions_json),
                status: row.status ?? 'active'
            };
        } catch (error) {
            console.error('Failed to load last autonomous evolution:', error);
            return null;
        }
    }

    private hasTwoConsecutiveCorrectiveDominantCycles(): boolean {
        const cycles = getStateManager().getRecentCycleStats(2);
        if (cycles.length < 2) return false;
        return cycles.every(c => c.total >= MIN_CYCLE_TOTAL && (c.corrective / Math.max(1, c.total)) >= CORRECTIVE_DOMINANCE_RATIO);
    }

    private isConfidenceCollapse(record: AutonomousEvolutionRecord): boolean {
        const cycles = getStateManager().getRecentCycleStats(2);
        if (cycles.length === 0) return false;
        const avgConfidence = cycles.reduce((acc, c) => acc + c.confidenceScore, 0) / cycles.length;
        return avgConfidence < record.rollback_conditions.confidence_drop_below;
    }

    private isEngagementInstability(): boolean {
        const activity = getActivityLogger().getEntries(40);
        const upvotes = activity.filter(a => a.actionType === 'upvote').length;
        const downvotes = activity.filter(a => a.actionType === 'downvote').length;
        if (downvotes >= Math.max(2, upvotes)) return true;
        return false;
    }

    async rollback(reason: string = 'operator'): Promise<void> {
        const record = this.getLastAutonomousEvolutionRecord();
        if (!record) {
            console.warn('Rollback requested but no autonomous evolution found.');
            return;
        }

        try {
            const db = getDatabaseManager().getDb();
            const snapshot = db.prepare('SELECT soul FROM soul_snapshots WHERE id = ?').get(record.rollback_snapshot_id) as { soul: string } | undefined;
            if (!snapshot?.soul) {
                console.error('Rollback snapshot missing. Unable to rollback.');
                return;
            }

            console.log(`🧬 ROLLBACK INITIATED (${reason}). Restoring snapshot.`);
            getStateManager().setSoul(snapshot.soul);
            db.prepare('UPDATE autonomous_evolutions SET status = ?, rolled_back_at = ? WHERE evolution_id = ?')
                .run('rolled_back', new Date().toISOString(), record.evolution_id);

            const state = getStateManager();
            state.setLastAutonomousEvolutionId(null);
            state.setStabilizationUntil(new Date(Date.now() + STABILIZATION_HOURS * 60 * 60 * 1000));
            state.setSelfModificationCooldownUntil(new Date(Date.now() + SELF_MODIFICATION_COOLDOWN_HOURS * 60 * 60 * 1000));
            state.setEvolutionWindow(new Date(), 0);
        } catch (error) {
            console.error('Rollback failed:', error);
        }
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
        interpretation: string;
        delta: string;
        soul: string | null;
        metadata: EvolutionMetadata | null;
    } {
        const normalized = rawOutput.replace(/\r\n/g, '\n');

        if (/RESONANCE_OPTIMAL/i.test(normalized)) {
            return { status: 'OPTIMAL', rationale: 'Resonance optimal', interpretation: 'Resonance optimal', delta: '', soul: null, metadata: null };
        }

        const statusMatch = normalized.match(/STATUS:\s*(EVOLVE|OPTIMAL)/i);
        const status = (statusMatch?.[1]?.toUpperCase() || 'EVOLVE') as 'EVOLVE' | 'OPTIMAL';

        const rationaleMatch = normalized.match(/RATIONALE:\s*([\s\S]*?)(?:\n[A-Z_]+:|SOUL_START|SOUL_END|$)/i);
        const interpretationMatch = normalized.match(/INTERPRETATION:\s*([\s\S]*?)(?:\n[A-Z_]+:|SOUL_START|SOUL_END|$)/i);
        const deltaMatch = normalized.match(/DELTA:\s*([\s\S]*?)(?:\n[A-Z_]+:|SOUL_START|SOUL_END|$)/i);

        const soulMatch = normalized.match(/SOUL_START\s*([\s\S]*?)\s*SOUL_END/i);
        const soulStartOnlyMatch = normalized.match(/SOUL_START\s*([\s\S]*)/i);
        const fallbackSoulMatch = normalized.match(/FULL_SOUL:\s*([\s\S]+)/i);
        const altSoulMatch = normalized.match(/(?:UPDATED_SOUL|SOUL):\s*([\s\S]+)/i);
        const identityMatch = normalized.match(/# Identity:\s*.+/i);

        const rationale = (rationaleMatch?.[1] || 'Autonomous refinement').trim();
        const interpretation = (interpretationMatch?.[1] || rationale).trim();
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

        const metadata = this.parseEvolutionMetadata(normalized);

        // If model returned OPTIMAL but still provided soul, ignore soul.
        if (status === 'OPTIMAL') {
            return { status, rationale, interpretation, delta, soul: null, metadata };
        }

        // If soul is empty, fall back to current soul as a safety net.
        if (!soul) {
            return { status, rationale, interpretation, delta, soul: null, metadata };
        }

        return { status, rationale, interpretation, delta, soul, metadata };
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

    private parseEvolutionMetadata(normalizedOutput: string): EvolutionMetadata | null {
        const metaMatch = normalizedOutput.match(/METADATA_START\s*([\s\S]*?)\s*METADATA_END/i);
        if (!metaMatch) return null;
        let payload = metaMatch[1].trim();
        payload = payload.replace(/```json|```/gi, '').trim();
        try {
            const parsed = JSON.parse(payload) as EvolutionMetadata;
            if (typeof parsed.confidence_score !== 'number') return null;
            if (!parsed.rationale || !Array.isArray(parsed.rationale.observed_patterns)) return null;
            if (typeof parsed.rationale.why_current_form_failed !== 'string') return null;
            if (!Array.isArray(parsed.expected_effects)) return null;
            if (!parsed.rollback_conditions) return null;
            if (typeof parsed.rollback_conditions.confidence_drop_below !== 'number') return null;
            if (typeof parsed.rollback_conditions.engagement_instability !== 'boolean') return null;
            if (typeof parsed.rollback_conditions.operator_override !== 'boolean') return null;
            return parsed;
        } catch {
            return null;
        }
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
    ): Promise<{ soul: string; rationale: string; interpretation: string; delta: string } | null> {
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
INTERPRETATION: <1 sentence, plain English>
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
                    interpretation: parsed.interpretation,
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
