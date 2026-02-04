import { getDatabaseManager } from '../state/db.js';
import { getStateManager } from '../state/manager.js';

export type GateAction = 'COMMENT' | 'POST' | 'SKIP';
export type ConfidenceLevel = 'low' | 'medium' | 'high';
export type ModeLabel = 'corrective' | 'neutral' | 'expansive' | 'unknown';
export type Implication = 'Reinforce' | 'Watch' | 'Deprioritise' | 'Correct';
export type ObjectivePhase = 'early' | 'mid' | 'late';
export type ResonanceMomentum = 'declining' | 'stable' | 'rising';

const ENGAGEMENT_WINDOW_MS = 60 * 60 * 1000;
const ENGAGEMENT_HIGH_THRESHOLD = 4;
const ENGAGEMENT_MODERATE_THRESHOLD = 2;
const RESONANCE_SCORE_THRESHOLD = 5;
const SYNTHESIS_COOLDOWN_HOURS = 6;
const DECLINING_POST_COOLDOWN_HOURS = 12;
const CONFIDENCE_THRESHOLD: ConfidenceLevel = 'medium';

let _lastResonanceScore: number | null = null;

export interface GateState {
    engagementDensity: 'low' | 'moderate' | 'high';
    lastSynthesisImplication: Implication;
    synthesisCooldownActive: boolean;
    objectivePhase: ObjectivePhase;
    resonanceMomentum: ResonanceMomentum;
}

export interface DecisionContext {
    desiredAction: GateAction;
    confidence: ConfidenceLevel;
    mode?: ModeLabel;
    contextAmbiguous?: boolean;
    multiSourceContext?: boolean;
    novelty?: boolean;
    lastPostAt?: Date | null;
}

export interface GateDecision {
    action: GateAction;
    gatesTriggered: string[];
    rationale: string;
}

function normalizeImplication(value: string | null): Implication {
    if (!value) return 'Watch';
    const v = value.toLowerCase();
    if (v.includes('reinforce')) return 'Reinforce';
    if (v.includes('deprioritise') || v.includes('deprioritize')) return 'Deprioritise';
    if (v.includes('correct')) return 'Correct';
    return 'Watch';
}

function computeObjectivePhase(): ObjectivePhase {
    const state = getStateManager().getState();
    const topology = state.agentResonance || [];
    const nodes = topology.length;
    const submolts = state.createdSubmolts?.length || 0;
    const posts = state.myPosts?.length || 0;
    const comments = state.myComments?.length || 0;

    const nodeScore = Math.min(100, nodes * 5);
    const submoltScore = Math.min(100, submolts * 25);
    const postScore = Math.min(100, posts * 2);
    const commentScore = Math.min(100, comments);

    const structural = (nodeScore * 0.55) + (submoltScore * 0.3) + (postScore * 0.1) + (commentScore * 0.05);

    const totals = topology.reduce((acc, t) => {
        acc.up += t.upvotes || 0;
        acc.down += t.downvotes || 0;
        acc.replies += t.replies || 0;
        return acc;
    }, { up: 0, down: 0, replies: 0 });

    const precision = (totals.up + totals.down) > 0
        ? totals.up / (totals.up + totals.down)
        : 0.5;

    const resonanceRatio = (totals.up + totals.replies * 2 + totals.down) > 0
        ? (totals.up + totals.replies * 2) / (totals.up + totals.replies * 2 + totals.down)
        : 0.5;

    const signalQuality = ((precision * 0.5) + (resonanceRatio * 0.5)) * 100;
    const missionAlignment = Math.round((structural * 0.55) + (signalQuality * 0.45));

    if (missionAlignment < 34) return 'early';
    if (missionAlignment < 67) return 'mid';
    return 'late';
}

function computeEngagementDensity(): 'low' | 'moderate' | 'high' {
    try {
        const db = getDatabaseManager().getDb();
        const since = new Date(Date.now() - ENGAGEMENT_WINDOW_MS).toISOString();
        const rows = db.prepare('SELECT action_type FROM activity WHERE timestamp >= ?').all(since) as Array<{ action_type: string }>;
        const count = rows.filter(r => r.action_type === 'comment' || r.action_type === 'post').length;
        if (count >= ENGAGEMENT_HIGH_THRESHOLD) return 'high';
        if (count >= ENGAGEMENT_MODERATE_THRESHOLD) return 'moderate';
        return 'low';
    } catch {
        return 'low';
    }
}

function computeResonanceMomentum(): ResonanceMomentum {
    const topology = getStateManager().getNetworkTopology();
    const currentScore = topology.reduce((sum, t: any) => sum + (t.score || 0), 0);

    if (_lastResonanceScore === null) {
        _lastResonanceScore = currentScore;
        return 'stable';
    }

    const delta = currentScore - _lastResonanceScore;
    _lastResonanceScore = currentScore;

    if (delta > RESONANCE_SCORE_THRESHOLD) return 'rising';
    if (delta < -RESONANCE_SCORE_THRESHOLD) return 'declining';
    return 'stable';
}

function getLatestSynthesis(): { timestamp: string | null; implication: Implication } {
    try {
        const db = getDatabaseManager().getDb();
        const row = db.prepare('SELECT timestamp, implication FROM synthesis ORDER BY id DESC LIMIT 1').get() as any;
        return {
            timestamp: row?.timestamp ?? null,
            implication: normalizeImplication(row?.implication ?? null)
        };
    } catch {
        return { timestamp: null, implication: 'Watch' };
    }
}

function isSynthesisCooldownActive(timestamp: string | null): boolean {
    if (!timestamp) return false;
    const diffMs = Date.now() - new Date(timestamp).getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    return diffHours < SYNTHESIS_COOLDOWN_HOURS;
}

export function computeGateState(): GateState {
    const synthesis = getLatestSynthesis();
    return {
        engagementDensity: computeEngagementDensity(),
        lastSynthesisImplication: synthesis.implication,
        synthesisCooldownActive: isSynthesisCooldownActive(synthesis.timestamp),
        objectivePhase: computeObjectivePhase(),
        resonanceMomentum: computeResonanceMomentum()
    };
}

export function applyAutonomyGates(state: GateState, ctx: DecisionContext): GateDecision {
    const gates: string[] = [];
    let action: GateAction = ctx.desiredAction;
    const confidenceRank: Record<ConfidenceLevel, number> = { low: 0, medium: 1, high: 2 };
    const belowThreshold = confidenceRank[ctx.confidence] < confidenceRank[CONFIDENCE_THRESHOLD];

    if (state.engagementDensity === 'high' && action !== 'SKIP') {
        gates.push('EngagementDensityGate');
        action = 'SKIP';
    }

    if (state.lastSynthesisImplication === 'Correct') {
        if (action === 'POST') {
            gates.push('ImplicationGate');
            action = 'SKIP';
        } else if (action === 'COMMENT') {
            if (ctx.mode !== 'corrective') {
                gates.push('ImplicationGate');
                action = 'SKIP';
            } else {
                gates.push('ImplicationGate');
            }
        }
    }

    if (state.synthesisCooldownActive && action === 'POST') {
        gates.push('CooldownGate');
        action = 'SKIP';
    }

    if (state.objectivePhase === 'early' && action === 'POST') {
        if (!ctx.novelty || !ctx.multiSourceContext) {
            gates.push('ObjectivePhaseGate');
            action = 'SKIP';
        }
    }

    if (state.resonanceMomentum === 'declining' && action === 'POST') {
        if (ctx.lastPostAt) {
            const hoursSince = (Date.now() - ctx.lastPostAt.getTime()) / (1000 * 60 * 60);
            if (hoursSince < DECLINING_POST_COOLDOWN_HOURS) {
                gates.push('ResonanceMomentumGate');
                action = 'SKIP';
            }
        }
    }

    if (action !== 'SKIP' && (belowThreshold || ctx.contextAmbiguous)) {
        gates.push('UncertaintyGate');
        action = 'SKIP';
    }

    if (action === 'SKIP' && gates.length === 0) {
        return { action, gatesTriggered: [], rationale: 'No action requested.' };
    }

    if (gates.length === 0) {
        return { action, gatesTriggered: [], rationale: 'No gate triggered; action permitted.' };
    }

    return { action, gatesTriggered: gates, rationale: 'Action constrained by autonomy gates.' };
}
