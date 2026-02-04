import { getDatabaseManager } from '../state/db.js';
import { computeGateState } from '../agent/autonomy-gates.js';

function classifyRecency(timestamp: string | null): 'none' | 'very recent' | 'recent' | 'stale' | 'old' {
    if (!timestamp) return 'none';
    const diffMs = Date.now() - new Date(timestamp).getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffHours < 1) return 'very recent';
    if (diffHours < 6) return 'recent';
    if (diffHours < 24) return 'stale';
    return 'old';
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

export function buildCognitiveAwarenessBlock(): string {
    const gateState = computeGateState();
    const latestEvolution = getLatestEvolution();
    const latestSynthesis = getLatestSynthesis();

    const evolutionRecency = classifyRecency(latestEvolution.timestamp);
    const synthesisRecency = classifyRecency(latestSynthesis.timestamp);
    const synthesisImplication = latestSynthesis.implication || gateState.lastSynthesisImplication || 'Watch';
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
- Engagement Density: ${gateState.engagementDensity}
- Network Resonance Momentum: ${gateState.resonanceMomentum}
- Objective Phase: ${gateState.objectivePhase}
- Last Synthesis: ${synthesisRecency} (${synthesisImplication}) — ${synthesisSummary}
- Synthesis Cooldown: ${gateState.synthesisCooldownActive ? 'active' : 'inactive'}
- Last Evolution: ${evolutionRecency} — ${evolutionInterpretation}`;
}
