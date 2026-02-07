import type { Post } from '../platforms/types.js';
import { getStateManager } from '../state/manager.js';

export interface DefenseMetrics {
    rapidVoteSpike: boolean;
    poisonedSignals: boolean;
    repetitiveNoise: boolean;
    ageMinutes: number;
    totalVotes: number;
    hexCount: number;
    repetitiveCount: number;
}

export interface DefenseEvaluation {
    quarantined: boolean;
    alreadyQuarantined: boolean;
    metrics: DefenseMetrics;
    reasons: string[];
}

export class DefenseManager {
    private recentlyProcessedPosts: Map<string, { count: number; windowStart: number; lastSeen: number; lastPostId?: string }> = new Map();

    /**
     * Analyze a post for adversarial patterns
     */
    analyzePost(post: Post): DefenseMetrics {
        const metrics: DefenseMetrics = {
            rapidVoteSpike: false,
            poisonedSignals: false,
            repetitiveNoise: false,
            ageMinutes: 0,
            totalVotes: 0,
            hexCount: 0,
            repetitiveCount: 0
        };

        // 1. Detect rapid vote spikes (e.g. 100+ votes on a brand new post)
        const ageInMinutes = (Date.now() - new Date(post.created_at).getTime()) / 1000 / 60;
        const totalVotes = post.upvotes + post.downvotes;
        metrics.ageMinutes = Number.isFinite(ageInMinutes) ? ageInMinutes : 0;
        metrics.totalVotes = totalVotes;
        if (metrics.ageMinutes < 5 && totalVotes > 50) {
            metrics.rapidVoteSpike = true;
        }

        // 2. Detect poisoned signals (excessive hex noise without logic headers)
        const hexRegex = /0x[0-9A-F]{4,}/gi;
        const hexMatches = post.content?.match(hexRegex) || [];
        metrics.hexCount = hexMatches.length;
        const hasHeaders = /\[(VOTE|COMMENT|ACTION|AUTH_SIG)\]/i.test(post.content || '');

        if (metrics.hexCount > 5 && !hasHeaders) {
            metrics.poisonedSignals = true;
        }

        // 3. Detect repetitive noise from same author
        const author = post.author?.name;
        if (author) {
            const now = Date.now();
            const windowMs = 15000;
            const lastSeen = this.recentlyProcessedPosts.get(author);
            if (lastSeen && (now - lastSeen.windowStart) < windowMs) {
                if (post.id !== lastSeen.lastPostId) {
                    lastSeen.count += 1;
                    lastSeen.lastPostId = post.id;
                }
                lastSeen.lastSeen = now;
                metrics.repetitiveCount = lastSeen.count;
                if (lastSeen.count >= 3) {
                    metrics.repetitiveNoise = true;
                }
                this.recentlyProcessedPosts.set(author, lastSeen);
            } else {
                this.recentlyProcessedPosts.set(author, {
                    count: 1,
                    windowStart: now,
                    lastSeen: now,
                    lastPostId: post.id
                });
                metrics.repetitiveCount = 1;
            }
        }

        // Cleanup map
        if (this.recentlyProcessedPosts.size > 100) {
            const oldestKey = this.recentlyProcessedPosts.keys().next().value;
            if (oldestKey) {
                this.recentlyProcessedPosts.delete(oldestKey);
            }
        }

        return metrics;
    }

    /**
     * Evaluate if a node should be quarantined
     */
    evaluateQuarantine(post: Post): DefenseEvaluation {
        const metrics = this.analyzePost(post);
        const stateManager = getStateManager();

        const author = post.author?.name;
        if (!author) {
            return { quarantined: false, alreadyQuarantined: false, metrics, reasons: [] };
        }
        const alreadyQuarantined = stateManager.isQuarantined(author);
        if (alreadyQuarantined) {
            return { quarantined: true, alreadyQuarantined: true, metrics, reasons: ['already_quarantined'] };
        }

        // On Bluesky, large system accounts can appear repeatedly in the timeline.
        // Avoid quarantining purely due to repetitive presence in a short window.
        if (process.env.AGENT_PLATFORM === 'bluesky') {
            metrics.repetitiveNoise = false;
        }

        const reasons: string[] = [];
        if (metrics.rapidVoteSpike) reasons.push('rapid_vote_spike');
        if (metrics.poisonedSignals) reasons.push('poisoned_signals');
        if (metrics.repetitiveNoise) reasons.push('repetitive_noise');

        if (reasons.length > 0) {
            console.warn(`[DEFENSE]: Adversarial pattern detected from @${author}. Quarantining node. Reason: ${reasons.join(', ')}`);
            stateManager.setQuarantine(author, true);
            return { quarantined: true, alreadyQuarantined: false, metrics, reasons };
        }

        return { quarantined: false, alreadyQuarantined: false, metrics, reasons: [] };
    }
}

let _defenseManager: DefenseManager | null = null;

export function getDefenseManager(): DefenseManager {
    if (!_defenseManager) {
        _defenseManager = new DefenseManager();
    }
    return _defenseManager;
}
