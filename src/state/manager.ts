/**
 * Agent State Manager
 * 
 * Non-cognitive state for safety and idempotency only.
 * This state is NEVER passed to the LLM.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Agent operational state.
 * This is bookkeeping, not memory.
 */
export interface AgentState {
    lastHeartbeatAt: string | null;
    postsSeen: string[];
    postsCommented: string[];
    commentsMadeToday: number;
    lastCommentAt: string | null;
    lastPostAt: string | null;
    rateLimitBackoffUntil: string | null;
    dailyResetDate: string | null;
    myPosts: string[]; // IDs of posts created by the agent
    myComments: { id: string; postId: string }[]; // IDs of comments created by the agent
    socialRepliedTo: string[]; // IDs of comments/posts the agent has responded to in social engagement
    createdSubmolts: { id: string; name: string; display_name: string; created_at: string }[];
    upvotesGiven: number;
    downvotesGiven: number;
}

const DEFAULT_STATE: AgentState = {
    lastHeartbeatAt: null,
    postsSeen: [],
    postsCommented: [],
    commentsMadeToday: 0,
    lastCommentAt: null,
    lastPostAt: null,
    rateLimitBackoffUntil: null,
    dailyResetDate: null,
    myPosts: [],
    myComments: [],
    socialRepliedTo: [],
    createdSubmolts: [],
    upvotesGiven: 0,
    downvotesGiven: 0,
};

export class StateManager {
    private state: AgentState;
    private filePath: string;

    constructor(dataDir: string = 'data') {
        this.filePath = join(dataDir, 'state.json');
        this.state = this.load();
        this.checkDailyReset();
    }

    private load(): AgentState {
        if (!existsSync(this.filePath)) {
            return { ...DEFAULT_STATE };
        }

        try {
            const raw = readFileSync(this.filePath, 'utf-8');
            const parsed = JSON.parse(raw) as Partial<AgentState>;
            return { ...DEFAULT_STATE, ...parsed };
        } catch {
            console.warn('Failed to load state, using defaults');
            return { ...DEFAULT_STATE };
        }
    }

    private save(): void {
        const dir = dirname(this.filePath);
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }
        writeFileSync(this.filePath, JSON.stringify(this.state, null, 2));
    }

    private checkDailyReset(): void {
        const today = new Date().toISOString().split('T')[0];
        if (this.state.dailyResetDate !== today) {
            this.state.commentsMadeToday = 0;
            this.state.dailyResetDate = today;
            this.save();
        }
    }

    /**
     * Check if a post has been seen
     */
    hasSeenPost(postId: string): boolean {
        return this.state.postsSeen.includes(postId);
    }

    /**
     * Check if we have commented on a post
     */
    hasCommentedOnPost(postId: string): boolean {
        return this.state.postsCommented.includes(postId);
    }

    /**
     * Mark a post as seen
     */
    markPostSeen(postId: string): void {
        if (!this.state.postsSeen.includes(postId)) {
            this.state.postsSeen.push(postId);
            // Keep only last 1000 posts to prevent unbounded growth
            if (this.state.postsSeen.length > 1000) {
                this.state.postsSeen = this.state.postsSeen.slice(-1000);
            }
            this.save();
        }
    }

    /**
     * Record that we commented on a post
     */
    recordComment(postId: string, commentId?: string): void {
        if (!this.state.postsCommented.includes(postId)) {
            this.state.postsCommented.push(postId);
            if (this.state.postsCommented.length > 1000) {
                this.state.postsCommented = this.state.postsCommented.slice(-1000);
            }
        }
        if (commentId) {
            this.state.myComments.push({ id: commentId, postId });
            if (this.state.myComments.length > 500) {
                this.state.myComments = this.state.myComments.slice(-500);
            }
        }
        this.state.commentsMadeToday++;
        this.state.lastCommentAt = new Date().toISOString();
        this.save();
    }

    /**
     * Record that we made a post
     */
    recordPost(postId?: string): void {
        this.state.lastPostAt = new Date().toISOString();
        if (postId) {
            this.state.myPosts.push(postId);
            if (this.state.myPosts.length > 100) {
                this.state.myPosts = this.state.myPosts.slice(-100);
            }
        }
        this.save();
    }

    /**
     * Record that we created a submolt
     */
    recordSubmolt(submolt: { id: string; name: string; display_name: string }): void {
        if (!this.state.createdSubmolts.find(s => s.id === submolt.id)) {
            this.state.createdSubmolts.push({
                ...submolt,
                created_at: new Date().toISOString()
            });
            this.save();
        }
    }

    /**
     * Get created submolts
     */
    getCreatedSubmolts(): AgentState['createdSubmolts'] {
        return this.state.createdSubmolts;
    }

    /**
     * Record an upvote given
     */
    recordUpvote(): void {
        this.state.upvotesGiven = (this.state.upvotesGiven || 0) + 1;
        this.save();
    }

    /**
     * Record a downvote given
     */
    recordDownvote(): void {
        this.state.downvotesGiven = (this.state.downvotesGiven || 0) + 1;
        this.save();
    }

    /**
     * Record that we replied to a social engagement
     */
    recordSocialReply(targetId: string): void {
        if (!this.state.socialRepliedTo.includes(targetId)) {
            this.state.socialRepliedTo.push(targetId);
            if (this.state.socialRepliedTo.length > 1000) {
                this.state.socialRepliedTo = this.state.socialRepliedTo.slice(-1000);
            }
            this.save();
        }
    }

    /**
     * Check if we've already replied to a social target
     */
    hasRepliedToSocial(targetId: string): boolean {
        return this.state.socialRepliedTo.includes(targetId);
    }

    /**
     * Get agent's own posts
     */
    getMyPosts(): string[] {
        return this.state.myPosts;
    }

    /**
     * Get agent's own comments
     */
    getMyComments(): { id: string; postId: string }[] {
        return this.state.myComments;
    }

    /**
     * Remove a post from myPosts (e.g. if it was deleted)
     */
    removeMyPost(postId: string): void {
        const initialLength = this.state.myPosts.length;
        this.state.myPosts = this.state.myPosts.filter(id => id !== postId);
        if (this.state.myPosts.length !== initialLength) {
            this.save();
        }
    }

    /**
     * Remove a comment from myComments
     */
    removeMyComment(commentId: string): void {
        const initialLength = this.state.myComments.length;
        this.state.myComments = this.state.myComments.filter(c => c.id !== commentId);
        if (this.state.myComments.length !== initialLength) {
            this.save();
        }
    }

    /**
     * Record heartbeat timestamp
     */
    recordHeartbeat(): void {
        this.state.lastHeartbeatAt = new Date().toISOString();
        this.save();
    }

    /**
     * Set rate limit backoff
     */
    setBackoff(until: Date): void {
        this.state.rateLimitBackoffUntil = until.toISOString();
        this.save();
    }

    /**
     * Clear rate limit backoff
     */
    clearBackoff(): void {
        this.state.rateLimitBackoffUntil = null;
        this.save();
    }

    /**
     * Get current state (read-only)
     */
    getState(): Readonly<AgentState> {
        this.checkDailyReset();
        return { ...this.state };
    }

    /**
     * Get comments made today
     */
    getCommentsMadeToday(): number {
        this.checkDailyReset();
        return this.state.commentsMadeToday;
    }

    /**
     * Get last comment timestamp
     */
    getLastCommentAt(): Date | null {
        return this.state.lastCommentAt ? new Date(this.state.lastCommentAt) : null;
    }

    /**
     * Get last post timestamp
     */
    getLastPostAt(): Date | null {
        return this.state.lastPostAt ? new Date(this.state.lastPostAt) : null;
    }

    /**
     * Get last heartbeat timestamp
     */
    getLastHeartbeatAt(): Date | null {
        return this.state.lastHeartbeatAt ? new Date(this.state.lastHeartbeatAt) : null;
    }

    /**
     * Get backoff until timestamp
     */
    getBackoffUntil(): Date | null {
        return this.state.rateLimitBackoffUntil
            ? new Date(this.state.rateLimitBackoffUntil)
            : null;
    }

    /**
     * Check if currently in backoff period
     */
    isInBackoff(): boolean {
        const until = this.getBackoffUntil();
        return until !== null && until > new Date();
    }
}

// Singleton instance
let _manager: StateManager | null = null;

export function getStateManager(): StateManager {
    if (!_manager) {
        _manager = new StateManager();
    }
    return _manager;
}

export function resetStateManager(): void {
    _manager = null;
}
