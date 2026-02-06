import type { Post } from '../platforms/types.js';
import { getStateManager } from '../state/manager.js';

export interface DefenseMetrics {
    rapidVoteSpike: boolean;
    poisonedSignals: boolean;
    repetitiveNoise: boolean;
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
            repetitiveNoise: false
        };

        // 1. Detect rapid vote spikes (e.g. 100+ votes on a brand new post)
        const ageInMinutes = (Date.now() - new Date(post.created_at).getTime()) / 1000 / 60;
        const totalVotes = post.upvotes + post.downvotes;
        if (ageInMinutes < 5 && totalVotes > 50) {
            metrics.rapidVoteSpike = true;
        }

        // 2. Detect poisoned signals (excessive hex noise without logic headers)
        const hexRegex = /0x[0-9A-F]{4,}/gi;
        const hexMatches = post.content?.match(hexRegex) || [];
        const hasHeaders = /\[(VOTE|COMMENT|ACTION|AUTH_SIG)\]/i.test(post.content || '');

        if (hexMatches.length > 5 && !hasHeaders) {
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
    evaluateQuarantine(post: Post): boolean {
        const metrics = this.analyzePost(post);
        const stateManager = getStateManager();

        const author = post.author?.name;
        if (!author) return false;
        const alreadyQuarantined = stateManager.isQuarantined(author);
        if (alreadyQuarantined) return true;

        // On Bluesky, large system accounts can appear repeatedly in the timeline.
        // Avoid quarantining purely due to repetitive presence in a short window.
        if (process.env.AGENT_PLATFORM === 'bluesky') {
            metrics.repetitiveNoise = false;
        }

        if (metrics.rapidVoteSpike || metrics.poisonedSignals || metrics.repetitiveNoise) {
            console.warn(`[DEFENSE]: Adversarial pattern detected from @${author}. Quarantining node.`);
            stateManager.setQuarantine(author, true);
            return true;
        }

        return false;
    }
}

let _defenseManager: DefenseManager | null = null;

export function getDefenseManager(): DefenseManager {
    if (!_defenseManager) {
        _defenseManager = new DefenseManager();
    }
    return _defenseManager;
}
