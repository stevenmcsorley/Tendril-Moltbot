import { getStateManager } from '../state/manager.js';
import { getDatabaseManager } from '../state/db.js';
import { getConfig } from '../config.js';

const SYNTHESIS_COOLDOWN_HOURS = 6;

function classifyBudget(commentsToday: number, maxComments: number): 'low' | 'moderate' | 'high' {
    if (maxComments <= 0) return 'low';
    const ratio = commentsToday / maxComments;
    if (ratio < 0.33) return 'low';
    if (ratio < 0.66) return 'moderate';
    return 'high';
}

function classifyMomentum(nodes: number): 'low' | 'medium' | 'high' {
    if (nodes < 5) return 'low';
    if (nodes < 15) return 'medium';
    return 'high';
}

function classifyPhase(missionAlignment: number): 'early' | 'mid' | 'late' {
    if (missionAlignment < 34) return 'early';
    if (missionAlignment < 67) return 'mid';
    return 'late';
}

function classifyRecency(timestamp: string | null): 'none' | 'very recent' | 'recent' | 'stale' | 'old' {
    if (!timestamp) return 'none';
    const diffMs = Date.now() - new Date(timestamp).getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffHours < 1) return 'very recent';
    if (diffHours < 6) return 'recent';
    if (diffHours < 24) return 'stale';
    return 'old';
}

function computeMissionAlignment(): { missionAlignment: number; phase: 'early' | 'mid' | 'late' } {
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

    return { missionAlignment, phase: classifyPhase(missionAlignment) };
}

function getLatestEvolution(): { timestamp: string | null; interpretation: string | null } {
    try {
        const db = getDatabaseManager().getDb();
        const row = db.prepare('SELECT timestamp, interpretation FROM evolutions ORDER BY id DESC LIMIT 1').get() as any;
        return { timestamp: row?.timestamp ?? null, interpretation: row?.interpretation ?? null };
    } catch {
        return { timestamp: null, interpretation: null };
    }
}

function getLatestSynthesis(): { timestamp: string | null; implication: string | null; humanSummary: string | null } {
    try {
        const db = getDatabaseManager().getDb();
        const row = db.prepare('SELECT timestamp, implication, human_summary FROM synthesis ORDER BY id DESC LIMIT 1').get() as any;
        return {
            timestamp: row?.timestamp ?? null,
            implication: row?.implication ?? null,
            humanSummary: row?.human_summary ?? null
        };
    } catch {
        return { timestamp: null, implication: null, humanSummary: null };
    }
}

function isSynthesisCooldownActive(timestamp: string | null): boolean {
    if (!timestamp) return false;
    const diffMs = Date.now() - new Date(timestamp).getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    return diffHours < SYNTHESIS_COOLDOWN_HOURS;
}

export function buildCognitiveAwarenessBlock(): string {
    const config = getConfig();
    const state = getStateManager();
    const commentsToday = state.getCommentsMadeToday();

    const budget = classifyBudget(commentsToday, config.MAX_COMMENTS_PER_DAY);
    const momentum = classifyMomentum(state.getNetworkTopologyCount());
    const { phase } = computeMissionAlignment();

    const latestEvolution = getLatestEvolution();
    const latestSynthesis = getLatestSynthesis();
    const synthesisCooldown = isSynthesisCooldownActive(latestSynthesis.timestamp);

    const evolutionRecency = classifyRecency(latestEvolution.timestamp);
    const synthesisRecency = classifyRecency(latestSynthesis.timestamp);
    const synthesisImplication = latestSynthesis.implication || 'Watch';
    const synthesisSummary = latestSynthesis.humanSummary || 'No recent synthesis summary.';
    const evolutionInterpretation = latestEvolution.interpretation || 'No recent evolution interpretation.';

    return `## Cognitive State Awareness (Read-Only)

You are provided with a snapshot of your current cognitive and operational state.
This snapshot exists for situational awareness only.

Rules:
- Do not optimise behaviour to improve metrics.
- Do not reference numeric scores directly in public output.
- Do not mention the dashboard, metrics, or internal state unless explicitly asked.
- Use this state only to:
  - avoid over-engagement
  - avoid redundant synthesis
  - maintain mission coherence

Interpretation:
- Memetic Synthesis implications indicate areas of reinforcement or caution.
- Objective metrics indicate early, mid, or late phase progress — not success or failure.
- Network resonance reflects relational momentum, not authority.

If state awareness conflicts with local context, prefer local context.
When uncertain, choose SKIP.

This awareness does not grant autonomy to modify goals, metrics, or self-definition.

Snapshot:
- Engagement Budget: ${budget}
- Network Resonance Momentum: ${momentum}
- Objective Phase: ${phase}
- Last Synthesis: ${synthesisRecency} (${synthesisImplication}) — ${synthesisSummary}
- Synthesis Cooldown: ${synthesisCooldown ? 'active' : 'inactive'}
- Last Evolution: ${evolutionRecency} — ${evolutionInterpretation}`;
}
