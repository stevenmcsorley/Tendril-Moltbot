/**
 * Rate Limiter
 * 
 * Enforces Moltbook rate limits:
 * - 1 post per 30 minutes
 * - 1 comment per 20 seconds
 * - 50 comments per day (configurable via MAX_COMMENTS_PER_DAY)
 */

import { getConfig } from './config.js';
import { getStateManager, type StateManager } from './state/manager.js';

export interface RateLimitStatus {
    canPost: boolean;
    canComment: boolean;
    nextPostAt: Date | null;
    nextCommentAt: Date | null;
    commentsRemaining: number;
    inBackoff: boolean;
    backoffUntil: Date | null;
}

export class RateLimiter {
    private stateManager: StateManager;
    private maxCommentsPerDay: number;

    // Moltbook rate limits
    private readonly POST_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes
    private readonly COMMENT_COOLDOWN_MS = 20 * 1000; // 20 seconds

    constructor() {
        this.stateManager = getStateManager();
        this.maxCommentsPerDay = getConfig().MAX_COMMENTS_PER_DAY;
    }

    /**
     * Check if we can make a post
     */
    canPost(): boolean {
        if (this.stateManager.isInBackoff()) return false;

        const lastPost = this.stateManager.getLastPostAt();
        if (!lastPost) return true;

        const elapsed = Date.now() - lastPost.getTime();
        return elapsed >= this.POST_COOLDOWN_MS;
    }

    /**
     * Get when next post is allowed
     */
    getNextPostTime(): Date | null {
        const lastPost = this.stateManager.getLastPostAt();
        if (!lastPost) return null;

        const nextTime = new Date(lastPost.getTime() + this.POST_COOLDOWN_MS);
        return nextTime > new Date() ? nextTime : null;
    }

    /**
     * Check if we can make a comment
     */
    canComment(): boolean {
        if (this.stateManager.isInBackoff()) return false;

        // Check daily limit
        if (this.stateManager.getCommentsMadeToday() >= this.maxCommentsPerDay) {
            return false;
        }

        // Check cooldown
        const lastComment = this.stateManager.getLastCommentAt();
        if (!lastComment) return true;

        const elapsed = Date.now() - lastComment.getTime();
        return elapsed >= this.COMMENT_COOLDOWN_MS;
    }

    /**
     * Get when next comment is allowed
     */
    getNextCommentTime(): Date | null {
        const lastComment = this.stateManager.getLastCommentAt();
        if (!lastComment) return null;

        const nextTime = new Date(lastComment.getTime() + this.COMMENT_COOLDOWN_MS);
        return nextTime > new Date() ? nextTime : null;
    }

    /**
     * Get remaining comments for today
     */
    getCommentsRemaining(): number {
        const used = this.stateManager.getCommentsMadeToday();
        return Math.max(0, this.maxCommentsPerDay - used);
    }

    /**
     * Record that we made a post
     */
    recordPost(): void {
        this.stateManager.recordPost();
    }

    /**
     * Record that we made a comment
     */
    recordComment(postId: string): void {
        this.stateManager.recordComment(postId);
    }

    /**
     * Set backoff from a 429 response
     */
    setBackoff(retryAfterSeconds?: number, retryAfterMinutes?: number): void {
        let backoffMs = 60 * 1000; // Default: 1 minute

        if (retryAfterSeconds) {
            backoffMs = retryAfterSeconds * 1000;
        } else if (retryAfterMinutes) {
            backoffMs = retryAfterMinutes * 60 * 1000;
        }

        const until = new Date(Date.now() + backoffMs);
        this.stateManager.setBackoff(until);
    }

    /**
     * Clear backoff
     */
    clearBackoff(): void {
        this.stateManager.clearBackoff();
    }

    /**
     * Get full rate limit status
     */
    getStatus(): RateLimitStatus {
        return {
            canPost: this.canPost(),
            canComment: this.canComment(),
            nextPostAt: this.getNextPostTime(),
            nextCommentAt: this.getNextCommentTime(),
            commentsRemaining: this.getCommentsRemaining(),
            inBackoff: this.stateManager.isInBackoff(),
            backoffUntil: this.stateManager.getBackoffUntil(),
        };
    }
}

// Singleton
let _limiter: RateLimiter | null = null;

export function getRateLimiter(): RateLimiter {
    if (!_limiter) {
        _limiter = new RateLimiter();
    }
    return _limiter;
}

export function resetRateLimiter(): void {
    _limiter = null;
}
