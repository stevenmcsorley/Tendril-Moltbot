/**
 * Rate Limiter
 * 
 * Enforces platform-safe rate limits (configurable):
 * - Post cooldown (minutes)
 * - Comment cooldown (seconds)
 * - Max comments per day
 * Optionally adapts cooldowns based on recent engagement.
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
    private postCooldownMs: number;
    private commentCooldownMs: number;
    private adaptiveEnabled: boolean;
    private adaptiveWindowMs: number;
    private adaptiveLow: number;
    private adaptiveHigh: number;
    private adaptivePostMinMs: number;
    private adaptivePostMaxMs: number;
    private adaptiveCommentMinMs: number;
    private adaptiveCommentMaxMs: number;
    private adaptiveHighFactor: number;
    private adaptiveLowFactor: number;
    private adaptiveSilenceFactor: number;

    constructor() {
        this.stateManager = getStateManager();
        const config = getConfig();
        this.maxCommentsPerDay = config.MAX_COMMENTS_PER_DAY;
        this.postCooldownMs = config.POST_COOLDOWN_MINUTES * 60 * 1000;
        this.commentCooldownMs = config.COMMENT_COOLDOWN_SECONDS * 1000;
        this.adaptiveEnabled = config.ADAPTIVE_RATE_LIMITING;
        this.adaptiveWindowMs = config.ADAPTIVE_WINDOW_MINUTES * 60 * 1000;
        this.adaptiveLow = config.ADAPTIVE_ENGAGEMENT_LOW;
        this.adaptiveHigh = config.ADAPTIVE_ENGAGEMENT_HIGH;
        this.adaptivePostMinMs = config.ADAPTIVE_POST_MINUTES_MIN * 60 * 1000;
        this.adaptivePostMaxMs = config.ADAPTIVE_POST_MINUTES_MAX * 60 * 1000;
        this.adaptiveCommentMinMs = config.ADAPTIVE_COMMENT_SECONDS_MIN * 1000;
        this.adaptiveCommentMaxMs = config.ADAPTIVE_COMMENT_SECONDS_MAX * 1000;
        this.adaptiveHighFactor = config.ADAPTIVE_FACTOR_HIGH;
        this.adaptiveLowFactor = config.ADAPTIVE_FACTOR_LOW;
        this.adaptiveSilenceFactor = config.ADAPTIVE_SILENCE_FACTOR ?? 1;
    }

    private clamp(value: number, min: number, max: number): number {
        return Math.min(Math.max(value, min), max);
    }

    private getAdaptiveMultiplier(): number {
        if (!this.adaptiveEnabled) return 1;
        const engagement = this.stateManager.getRecentEngagementCount(this.adaptiveWindowMs);
        if (engagement === 0) return this.adaptiveSilenceFactor;
        if (engagement >= this.adaptiveHigh) return this.adaptiveHighFactor;
        if (engagement <= this.adaptiveLow) return this.adaptiveLowFactor;
        return 1;
    }

    private getPostCooldownMs(): number {
        const multiplier = this.getAdaptiveMultiplier();
        const scaled = Math.round(this.postCooldownMs * multiplier);
        return this.clamp(scaled, this.adaptivePostMinMs, this.adaptivePostMaxMs);
    }

    private getCommentCooldownMs(): number {
        const multiplier = this.getAdaptiveMultiplier();
        const scaled = Math.round(this.commentCooldownMs * multiplier);
        return this.clamp(scaled, this.adaptiveCommentMinMs, this.adaptiveCommentMaxMs);
    }

    /**
     * Check if we can make a post
     */
    canPost(): boolean {
        if (this.stateManager.isInBackoff()) return false;

        const lastPost = this.stateManager.getLastPostAt();
        if (!lastPost) return true;

        const elapsed = Date.now() - lastPost.getTime();
        return elapsed >= this.getPostCooldownMs();
    }

    /**
     * Get when next post is allowed
     */
    getNextPostTime(): Date | null {
        const lastPost = this.stateManager.getLastPostAt();
        if (!lastPost) return null;

        const nextTime = new Date(lastPost.getTime() + this.getPostCooldownMs());
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
        return elapsed >= this.getCommentCooldownMs();
    }

    /**
     * Get when next comment is allowed
     */
    getNextCommentTime(): Date | null {
        const lastComment = this.stateManager.getLastCommentAt();
        if (!lastComment) return null;

        const nextTime = new Date(lastComment.getTime() + this.getCommentCooldownMs());
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
