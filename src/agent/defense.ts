import type { Post } from '../platforms/types.js';
import { getStateManager } from '../state/manager.js';

export interface DefenseMetrics {
    rapidVoteSpike: boolean;
    poisonedSignals: boolean;
    repetitiveNoise: boolean;
}

export class DefenseManager {
    private recentlyProcessedPosts: Map<string, { author: string; timestamp: number }> = new Map();

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
        const lastSeen = this.recentlyProcessedPosts.get(post.author?.name);
        if (lastSeen && (Date.now() - lastSeen.timestamp) < 5000) { // < 5 seconds
            metrics.repetitiveNoise = true;
        }

        this.recentlyProcessedPosts.set(post.author?.name, {
            author: post.author?.name,
            timestamp: Date.now()
        });

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

        if (metrics.rapidVoteSpike || metrics.poisonedSignals || metrics.repetitiveNoise) {
            console.warn(`[DEFENSE]: Adversarial pattern detected from @${post.author?.name}. Quarantining node.`);
            stateManager.setQuarantine(post.author?.name, true);
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
