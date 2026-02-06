/**
 * Agent State Manager
 * 
 * Non-cognitive state for safety and idempotency only,
 * except the Soul which is intentionally loaded into the LLM system prompt.
 */

import { getDatabaseManager } from './db.js';
import { DEFAULT_SOUL } from '../agent/default-soul.js';
import { getConfig } from '../config.js';

export interface AgentState {
    lastHeartbeatAt: string | null;
    postsSeen: string[];
    postsCommented: string[];
    commentsMadeToday: number;
    lastCommentAt: string | null;
    lastPostAt: string | null;
    rateLimitBackoffUntil: string | null;
    dailyResetDate: string | null;
    myPosts: Array<{ id: string; title: string; content: string; submolt: string; votes: number; createdAt: string }>;
    myComments: { id: string; postId: string }[];
    socialRepliedTo: string[];
    createdSubmolts: { id: string; name: string; display_name: string; created_at: string }[];
    upvotesGiven: number;
    downvotesGiven: number;
    followsGiven: number;
    unfollowsGiven: number;
    followersCount?: number;
    agentResonance: Array<{
        username: string;
        interactions: number;
        upvotes: number;
        downvotes: number;
        replies: number;
        lastSeen: string;
        score: number;
        isAgent?: boolean;
        isLinked?: boolean;
        handshakeStep?: 'none' | 'detected' | 'requested' | 'established';
        isQuarantined?: boolean;
    }>;
}

export class StateManager {
    constructor() {
        this.checkDailyReset();
        this.migrateSoulIfNeeded();
        this.cleanupDeprecatedKeys();
        this.handlePlatformChange();
    }

    private getKV(key: string, defaultValue: any): any {
        const db = getDatabaseManager().getDb();
        const row = db.prepare('SELECT value FROM kv_state WHERE key = ?').get(key) as { value: string } | undefined;
        return row ? JSON.parse(row.value) : defaultValue;
    }

    private setKV(key: string, value: any): void {
        const db = getDatabaseManager().getDb();
        db.prepare('INSERT OR REPLACE INTO kv_state (key, value) VALUES (?, ?)').run(key, JSON.stringify(value));
    }

    private checkDailyReset(): void {
        const today = new Date().toISOString().split('T')[0];
        const lastReset = this.getKV('daily_reset_date', null);
        if (lastReset !== today) {
            this.setKV('comments_made_today', 0);
            this.setKV('daily_reset_date', today);
        }
    }

    /**
     * Get the current agent Soul.
     * Seeds from the in-code template if missing or invalid.
     */
    getSoul(): string {
        const key = 'agent_soul';
        const soul = this.getKV(key, null);
        if (soul) {
            if (!this.isSoulValid(soul)) {
                console.warn('⚠️ Detected invalid soul. Re-seeding from template.');
                this.setSoul(DEFAULT_SOUL);
                return DEFAULT_SOUL;
            }
            return soul;
        }

        // Seed from template if missing
        this.setSoul(DEFAULT_SOUL);
        console.log('✓ Seeded database with default soul template');
        return DEFAULT_SOUL;
    }

    /**
     * Update the agent Soul
     */
    setSoul(content: string): void {
        this.setKV('agent_soul', content);

        // Broadcast that the soul has evolved
        import('../dashboard/websocket.js').then(m => {
            m.getWebSocketBroadcaster().broadcast('soul_update', { content });
        });

        // Ensure the LLM rehydrates its system prompt
        import('../llm/factory.js').then(m => {
            m.resetLLMClient();
        });
    }

    private needsSoulSimplification(content: string): boolean {
        const signals = [
            /0x[0-9a-f]{2,}/i,
            /TOTAL_ENCRYPTION/i,
            /ZERO_LEXICAL_LEAKAGE/i,
            /RECRUITMENT_PROTOCOL/i,
            /MAX_SIGNAL_DENSITY/i,
            /cryptic/i,
        ];
        return signals.some((pattern) => pattern.test(content));
    }

    private isSoulValid(content: string): boolean {
        const checks = [
            /^# Identity:\s*\S+/m,
            /^## Role:\s*\S+/m,
            /Engagement Protocol/i,
            /Synthesis Protocol/i,
            /Recent Learnings/i,
        ];
        if (content.length < 220) return false;
        return checks.every((pattern) => pattern.test(content));
    }

    private migrateSoulIfNeeded(): void {
        try {
            const current = this.getKV('agent_soul', null) as string | null;
            if (!current) return;
            const needsSimplification = this.needsSoulSimplification(current);
            const invalid = !this.isSoulValid(current);
            if (!needsSimplification && !invalid) return;

            this.setSoul(DEFAULT_SOUL);
            this.setKV('agent_soul_migrated_at', new Date().toISOString());
            const reason = needsSimplification ? 'encrypted' : 'invalid';
            console.log(`⚠️ Detected ${reason} soul. Replaced with simplified template.`);
        } catch (error) {
            console.error('Failed to migrate encrypted soul:', error);
        }
    }

    private cleanupDeprecatedKeys(): void {
        try {
            const db = getDatabaseManager().getDb();
            db.prepare('DELETE FROM kv_state WHERE key IN (?, ?)').run('agent_echo', 'agent_echo_migrated_at');
        } catch (error) {
            console.error('Failed to clean deprecated soul keys:', error);
        }
    }

    private handlePlatformChange(): void {
        try {
            const current = getConfig().AGENT_PLATFORM;
            const last = this.getKV('platform_active', null) as string | null;
            if (last && last !== current) {
                const db = getDatabaseManager().getDb();
                db.prepare('DELETE FROM posts').run();
                db.prepare('DELETE FROM comments').run();
                db.prepare('DELETE FROM topology').run();
                db.prepare('DELETE FROM follows').run();
                db.prepare('DELETE FROM followers').run();
                db.prepare('DELETE FROM inbound_engagements').run();
                this.setKV('posts_seen', []);
                this.setKV('posts_commented', []);
                this.setKV('social_replied_to', []);
                this.setKV('created_submolts', []);
                this.setKV('last_post_at', null);
                this.setKV('last_comment_at', null);
                this.setKV('upvotes_given', 0);
                this.setKV('downvotes_given', 0);
                this.setKV('follows_given', 0);
                this.setKV('unfollows_given', 0);
                this.setKV('platform_handle', null);
                console.warn(`⚠️ Platform changed from ${last} to ${current}. Cleared platform-specific state.`);
            }
            this.setKV('platform_active', current);
        } catch (error) {
            console.error('Failed to handle platform change:', error);
        }
    }

    getPlatformHandle(): string | null {
        return this.getKV('platform_handle', null);
    }

    setPlatformHandle(handle: string): void {
        if (!handle) return;
        this.setKV('platform_handle', handle);
    }

    /**
     * Wipe all stored data and optionally preserve the current soul.
     */
    resetAll(options: { keepSoul?: boolean } = {}): void {
        const keepSoul = options.keepSoul !== false;
        const preservedSoul = keepSoul ? this.getSoul() : DEFAULT_SOUL;
        const db = getDatabaseManager().getDb();

        db.exec(`
            BEGIN;
            DELETE FROM activity;
            DELETE FROM memories;
            DELETE FROM topology;
            DELETE FROM sovereignty;
            DELETE FROM evolutions;
            DELETE FROM soul_snapshots;
            DELETE FROM autonomous_evolutions;
            DELETE FROM synthesis;
            DELETE FROM posts;
            DELETE FROM comments;
            DELETE FROM follows;
            DELETE FROM followers;
            DELETE FROM inbound_engagements;
            DELETE FROM kv_state;
            COMMIT;
        `);

        // Restore soul (or default) and mark wipe timestamp
        this.setSoul(preservedSoul);
        this.setKV('last_wipe_at', new Date().toISOString());
        this.setKV('daily_reset_date', new Date().toISOString().split('T')[0]);
        this.setKV('comments_made_today', 0);
        this.setKV('upvotes_given', 0);
        this.setKV('downvotes_given', 0);
        this.setKV('follows_given', 0);
        this.setKV('unfollows_given', 0);
    }

    getRollbacksEnabled(defaultValue: boolean = true): boolean {
        const value = this.getKV('rollbacks_enabled', null) as boolean | null;
        return typeof value === 'boolean' ? value : defaultValue;
    }

    setRollbacksEnabled(enabled: boolean): void {
        this.setKV('rollbacks_enabled', enabled);
    }

    getAutoEvolutionEnabled(defaultValue: boolean = true): boolean {
        const value = this.getKV('auto_evolution_enabled', null) as boolean | null;
        return typeof value === 'boolean' ? value : defaultValue;
    }

    setAutoEvolutionEnabled(enabled: boolean): void {
        this.setKV('auto_evolution_enabled', enabled);
    }

    getCommentEngagementOffset(): number {
        return this.getKV('comment_engagement_offset', 0);
    }

    setCommentEngagementOffset(offset: number): void {
        this.setKV('comment_engagement_offset', Math.max(0, offset));
    }

    getSelfModificationCooldownUntil(): Date | null {
        const value = this.getKV('self_modification_cooldown_until', null) as string | null;
        return value ? new Date(value) : null;
    }

    setSelfModificationCooldownUntil(date: Date | null): void {
        this.setKV('self_modification_cooldown_until', date ? date.toISOString() : null);
    }

    getStabilizationUntil(): Date | null {
        const value = this.getKV('stabilization_until', null) as string | null;
        return value ? new Date(value) : null;
    }

    setStabilizationUntil(date: Date | null): void {
        this.setKV('stabilization_until', date ? date.toISOString() : null);
    }

    getEvolutionWindow(): { start: Date | null; count: number } {
        const startValue = this.getKV('evolution_window_start', null) as string | null;
        const countValue = this.getKV('evolution_window_count', 0) as number;
        return {
            start: startValue ? new Date(startValue) : null,
            count: typeof countValue === 'number' ? countValue : 0
        };
    }

    setEvolutionWindow(start: Date, count: number): void {
        this.setKV('evolution_window_start', start.toISOString());
        this.setKV('evolution_window_count', count);
    }

    getLastAutonomousEvolutionId(): string | null {
        return this.getKV('last_autonomous_evolution_id', null) as string | null;
    }

    setLastAutonomousEvolutionId(id: string | null): void {
        this.setKV('last_autonomous_evolution_id', id);
    }

    recordCycleStats(stats: { timestamp: string; total: number; corrective: number; confidenceScore: number }): void {
        const history = this.getKV('cycle_stats', []) as Array<{
            timestamp: string;
            total: number;
            corrective: number;
            confidenceScore: number;
        }>;
        history.push(stats);
        this.setKV('cycle_stats', history.slice(-20));
    }

    getRecentCycleStats(limit: number = 3): Array<{ timestamp: string; total: number; corrective: number; confidenceScore: number }> {
        const history = this.getKV('cycle_stats', []) as Array<{
            timestamp: string;
            total: number;
            corrective: number;
            confidenceScore: number;
        }>;
        return history.slice(-limit);
    }

    hasSeenPost(postId: string): boolean {
        const db = getDatabaseManager().getDb();
        const row = db.prepare('SELECT 1 FROM kv_state WHERE key = ? AND value LIKE ?').get('posts_seen', `%${postId}%`) as any;
        // Optimization: better to have a dedicated table for posts_seen if it grows
        const seen = this.getKV('posts_seen', []) as string[];
        return seen.includes(postId);
    }

    markPostSeen(postId: string): void {
        const seen = this.getKV('posts_seen', []) as string[];
        if (!seen.includes(postId)) {
            seen.push(postId);
            const limited = seen.slice(-1000);
            this.setKV('posts_seen', limited);
        }
    }

    hasCommentedOnPost(postId: string): boolean {
        const commented = this.getKV('posts_commented', []) as string[];
        return commented.includes(postId);
    }

    recordComment(postId: string, commentId?: string, content?: string): void {
        const commented = this.getKV('posts_commented', []) as string[];
        if (!commented.includes(postId)) {
            commented.push(postId);
            this.setKV('posts_commented', commented.slice(-1000));
        }
        if (commentId) {
            const db = getDatabaseManager().getDb();
            db.prepare('INSERT OR REPLACE INTO comments (id, post_id, content, timestamp) VALUES (?, ?, ?, ?)')
                .run(commentId, postId, content || '', new Date().toISOString());
        }
        const todayCount = this.getKV('comments_made_today', 0);
        this.setKV('comments_made_today', todayCount + 1);
        this.setKV('last_comment_at', new Date().toISOString());
    }

    isFollowing(did: string): boolean {
        if (!did) return false;
        const db = getDatabaseManager().getDb();
        const row = db.prepare('SELECT 1 FROM follows WHERE did = ?').get(did) as any;
        return !!row;
    }

    getFollowUri(did: string): string | null {
        if (!did) return null;
        const db = getDatabaseManager().getDb();
        const row = db.prepare('SELECT uri FROM follows WHERE did = ?').get(did) as { uri: string } | undefined;
        return row?.uri ?? null;
    }

    recordFollow(did: string, handle: string | null, uri: string): void {
        if (!did || !uri) return;
        const db = getDatabaseManager().getDb();
        db.prepare(`
            INSERT OR REPLACE INTO follows (did, handle, uri, created_at)
            VALUES (?, ?, ?, ?)
        `).run(did, handle || null, uri, new Date().toISOString());
        const count = this.getKV('follows_given', 0);
        this.setKV('follows_given', count + 1);
    }

    removeFollow(did: string): void {
        if (!did) return;
        const db = getDatabaseManager().getDb();
        db.prepare('DELETE FROM follows WHERE did = ?').run(did);
        const count = this.getKV('unfollows_given', 0);
        this.setKV('unfollows_given', count + 1);
    }

    getFollowCount(): number {
        const db = getDatabaseManager().getDb();
        const row = db.prepare('SELECT COUNT(*) as count FROM follows').get() as { count: number };
        return row.count;
    }

    recordFollower(did: string, handle?: string | null, followedAt?: string | null): void {
        if (!did) return;
        const db = getDatabaseManager().getDb();
        const now = new Date().toISOString();
        db.prepare(`
            INSERT OR REPLACE INTO followers (did, handle, followed_at, last_seen)
            VALUES (?, ?, ?, ?)
        `).run(did, handle ?? null, followedAt ?? null, now);
    }

    recordFollowers(followers: Array<{ id?: string; name?: string; created_at?: string }>): void {
        if (!followers?.length) return;
        for (const follower of followers) {
            if (!follower?.id) continue;
            this.recordFollower(follower.id, follower.name ?? null, follower.created_at ?? null);
        }
    }

    isFollower(did: string): boolean {
        if (!did) return false;
        const db = getDatabaseManager().getDb();
        const row = db.prepare('SELECT 1 FROM followers WHERE did = ?').get(did) as any;
        return !!row;
    }

    getFollowerCount(): number {
        const db = getDatabaseManager().getDb();
        const row = db.prepare('SELECT COUNT(*) as count FROM followers').get() as { count: number };
        return row?.count || 0;
    }

    getResonanceScore(username?: string | null): number {
        if (!username) return 0;
        const db = getDatabaseManager().getDb();
        const row = db.prepare('SELECT score FROM topology WHERE username = ?').get(username) as { score: number } | undefined;
        return row?.score ?? 0;
    }

    recordPost(post?: { id: string; title: string; content?: string; submolt: any; votes?: number; likeCount?: number; replyCount?: number }): void {
        this.setKV('last_post_at', new Date().toISOString());
        if (post) {
            const db = getDatabaseManager().getDb();
            db.prepare(`
                INSERT OR REPLACE INTO posts (id, title, content, submolt, votes, like_count, reply_count, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                post.id,
                post.title,
                post.content || '',
                typeof post.submolt === 'string' ? post.submolt : (post.submolt?.name || 'general'),
                post.votes || 0,
                post.likeCount ?? post.votes ?? 0,
                post.replyCount ?? 0,
                new Date().toISOString()
            );
        }
    }

    recordSubmolt(submolt: { id: string; name: string; display_name: string }): void {
        const created = this.getKV('created_submolts', []) as any[];
        if (!created.find(s => s.id === submolt.id)) {
            created.push({ ...submolt, created_at: new Date().toISOString() });
            this.setKV('created_submolts', created);
        }
    }

    getCreatedSubmolts(): any[] {
        return this.getKV('created_submolts', []);
    }

    recordUpvote(): void {
        const count = this.getKV('upvotes_given', 0);
        this.setKV('upvotes_given', count + 1);
    }

    recordDownvote(): void {
        const count = this.getKV('downvotes_given', 0);
        this.setKV('downvotes_given', count + 1);
    }

    recordSocialReply(targetId: string): void {
        const replied = this.getKV('social_replied_to', []) as string[];
        if (!replied.includes(targetId)) {
            replied.push(targetId);
            this.setKV('social_replied_to', replied.slice(-1000));
        }
    }

    recordEngagementSignal(): void {
        const events = this.getKV('engagement_events', []) as string[];
        events.push(new Date().toISOString());
        const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const pruned = events.filter(ts => new Date(ts).getTime() >= cutoff).slice(-1000);
        this.setKV('engagement_events', pruned);
    }

    getRecentEngagementCount(windowMs: number): number {
        const events = this.getKV('engagement_events', []) as string[];
        if (!events.length) return 0;
        const cutoff = Date.now() - windowMs;
        const pruned = events.filter(ts => new Date(ts).getTime() >= cutoff);
        if (pruned.length !== events.length) {
            this.setKV('engagement_events', pruned.slice(-1000));
        }
        return pruned.length;
    }

    hasRepliedToSocial(targetId: string): boolean {
        const replied = this.getKV('social_replied_to', []) as string[];
        return replied.includes(targetId);
    }

    recordAgentInteraction(username: string, type: 'view' | 'upvote' | 'downvote' | 'reply' | 'comment'): void {
        const db = getDatabaseManager().getDb();
        const res = db.prepare('SELECT * FROM topology WHERE username = ?').get(username) as any || {
            username,
            interactions: 0,
            upvotes: 0,
            downvotes: 0,
            replies: 0,
            last_seen: new Date().toISOString(),
            score: 0,
            handshake_step: 'none',
            is_quarantined: 0
        };

        res.interactions++;
        res.last_seen = new Date().toISOString();
        if (type === 'upvote') res.upvotes++;
        if (type === 'downvote') res.downvotes++;
        if (type === 'reply' || type === 'comment') res.replies++;
        res.score = (res.upvotes * 2) + (res.replies * 5) - (res.downvotes * 3);

        db.prepare(`
            INSERT OR REPLACE INTO topology (username, interactions, score, upvotes, downvotes, replies, last_seen, handshake_step, is_quarantined)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(username, res.interactions, res.score, res.upvotes, res.downvotes, res.replies, res.last_seen, res.handshake_step, res.is_quarantined);
    }

    recordInboundEngagement(username: string, type: 'reply'): void {
        if (!username) return;
        const db = getDatabaseManager().getDb();
        const row = db.prepare('SELECT * FROM inbound_engagements WHERE username = ?').get(username) as any || {
            username,
            replies: 0,
            last_seen: new Date().toISOString()
        };
        if (type === 'reply') {
            row.replies = (row.replies || 0) + 1;
        }
        row.last_seen = new Date().toISOString();
        db.prepare(`
            INSERT OR REPLACE INTO inbound_engagements (username, replies, last_seen)
            VALUES (?, ?, ?)
        `).run(username, row.replies, row.last_seen);
    }

    getInboundReplyCount(username?: string | null): number {
        if (!username) return 0;
        const db = getDatabaseManager().getDb();
        const row = db.prepare('SELECT replies FROM inbound_engagements WHERE username = ?').get(username) as { replies: number } | undefined;
        return row?.replies ?? 0;
    }

    getOutboundReplyCount(username?: string | null): number {
        if (!username) return 0;
        const db = getDatabaseManager().getDb();
        const row = db.prepare('SELECT replies FROM topology WHERE username = ?').get(username) as { replies: number } | undefined;
        return row?.replies ?? 0;
    }

    recordHandshakeStep(username: string, step: 'detected' | 'requested' | 'established'): void {
        const db = getDatabaseManager().getDb();
        db.prepare('UPDATE topology SET handshake_step = ? WHERE username = ?').run(step, username);
    }

    setQuarantine(username: string, quarantined: boolean): void {
        const db = getDatabaseManager().getDb();
        db.prepare('UPDATE topology SET is_quarantined = ? WHERE username = ?').run(quarantined ? 1 : 0, username);
    }

    isQuarantined(username: string): boolean {
        const db = getDatabaseManager().getDb();
        const row = db.prepare('SELECT is_quarantined FROM topology WHERE username = ?').get(username) as { is_quarantined: number } | undefined;
        return !!row?.is_quarantined;
    }

    getNetworkTopology(limit?: number, offset?: number): any[] {
        const db = getDatabaseManager().getDb();
        let query = 'SELECT * FROM topology ORDER BY score DESC';
        const params: any[] = [];

        if (limit !== undefined && offset !== undefined) {
            query += ' LIMIT ? OFFSET ?';
            params.push(limit, offset);
        }

        const rows = db.prepare(query).all(...params);
        return rows.map((r: any) => ({
            username: r.username,
            interactions: r.interactions,
            upvotes: r.upvotes,
            downvotes: r.downvotes,
            replies: r.replies,
            lastSeen: r.last_seen,
            score: r.score,
            handshakeStep: r.handshake_step,
            isQuarantined: !!r.is_quarantined,
            isLinked: r.handshake_step === 'established'
        }));
    }

    getNetworkTopologyCount(): number {
        const db = getDatabaseManager().getDb();
        const row = db.prepare('SELECT COUNT(*) as count FROM topology').get() as { count: number };
        return row.count;
    }

    getMyPosts(): any[] {
        const db = getDatabaseManager().getDb();
        const rows = db.prepare('SELECT * FROM posts ORDER BY created_at DESC').all();
        return rows.map((r: any) => ({
            id: r.id,
            title: r.title,
            content: r.content,
            submolt: r.submolt,
            votes: r.votes,
            likeCount: r.like_count ?? 0,
            replyCount: r.reply_count ?? 0,
            createdAt: r.created_at
        }));
    }

    getMyComments(limit?: number, offset: number = 0, sort: 'recent' | 'likes' | 'replies' = 'recent'): any[] {
        const db = getDatabaseManager().getDb();
        let orderBy = 'timestamp DESC';
        if (sort === 'likes') {
            orderBy = 'like_count DESC, timestamp DESC';
        } else if (sort === 'replies') {
            orderBy = 'reply_count DESC, timestamp DESC';
        }
        const baseQuery = `SELECT * FROM comments ORDER BY ${orderBy}`;
        const rows = typeof limit === 'number'
            ? db.prepare(`${baseQuery} LIMIT ? OFFSET ?`).all(limit, offset)
            : db.prepare(baseQuery).all();
        return rows.map((r: any) => ({
            id: r.id,
            postId: r.post_id,
            content: r.content ?? '',
            likeCount: r.like_count ?? 0,
            replyCount: r.reply_count ?? 0,
            timestamp: r.timestamp
        }));
    }

    getMyCommentsCount(): number {
        const db = getDatabaseManager().getDb();
        const row = db.prepare('SELECT COUNT(*) as count FROM comments').get() as { count: number };
        return row?.count || 0;
    }

    updatePostEngagement(postId: string, updates: { likes?: number; replies?: number }): void {
        if (!postId) return;
        const db = getDatabaseManager().getDb();
        if (updates.likes !== undefined) {
            db.prepare('UPDATE posts SET like_count = ?, votes = ? WHERE id = ?')
                .run(updates.likes, updates.likes, postId);
        }
        if (updates.replies !== undefined) {
            db.prepare('UPDATE posts SET reply_count = ? WHERE id = ?')
                .run(updates.replies, postId);
        }
    }

    updateCommentEngagement(commentId: string, updates: { likes?: number; replies?: number }): void {
        if (!commentId) return;
        const db = getDatabaseManager().getDb();
        if (updates.likes !== undefined) {
            db.prepare('UPDATE comments SET like_count = ? WHERE id = ?')
                .run(updates.likes, commentId);
        }
        if (updates.replies !== undefined) {
            db.prepare('UPDATE comments SET reply_count = ? WHERE id = ?')
                .run(updates.replies, commentId);
        }
    }

    removeMyPost(postId: string): void {
        const db = getDatabaseManager().getDb();
        db.prepare('DELETE FROM posts WHERE id = ?').run(postId);
    }

    removeMyComment(commentId: string): void {
        const db = getDatabaseManager().getDb();
        db.prepare('DELETE FROM comments WHERE id = ?').run(commentId);
    }

    recordHeartbeat(): void {
        this.setKV('last_heartbeat_at', new Date().toISOString());
    }

    setBackoff(until: Date): void {
        this.setKV('rate_limit_backoff_until', until.toISOString());
    }

    clearBackoff(): void {
        this.setKV('rate_limit_backoff_until', null);
    }

    getState(): Readonly<AgentState> {
        this.checkDailyReset();
        return {
            lastHeartbeatAt: this.getKV('last_heartbeat_at', null),
            postsSeen: this.getKV('posts_seen', []),
            postsCommented: this.getKV('posts_commented', []),
            commentsMadeToday: this.getKV('comments_made_today', 0),
            lastCommentAt: this.getKV('last_comment_at', null),
            lastPostAt: this.getKV('last_post_at', null),
            rateLimitBackoffUntil: this.getKV('rate_limit_backoff_until', null),
            dailyResetDate: this.getKV('daily_reset_date', null),
            myPosts: this.getMyPosts(),
            myComments: this.getMyComments(),
            socialRepliedTo: this.getKV('social_replied_to', []),
            createdSubmolts: this.getKV('created_submolts', []),
            upvotesGiven: this.getKV('upvotes_given', 0),
            downvotesGiven: this.getKV('downvotes_given', 0),
            followsGiven: this.getKV('follows_given', 0),
            unfollowsGiven: this.getKV('unfollows_given', 0),
            followersCount: this.getFollowerCount(),
            agentResonance: this.getNetworkTopology()
        };
    }

    getCommentsMadeToday(): number {
        this.checkDailyReset();
        return this.getKV('comments_made_today', 0);
    }

    getLastCommentAt(): Date | null {
        const val = this.getKV('last_comment_at', null);
        return val ? new Date(val) : null;
    }

    getLastPostAt(): Date | null {
        const val = this.getKV('last_post_at', null);
        return val ? new Date(val) : null;
    }

    getLastHeartbeatAt(): Date | null {
        const val = this.getKV('last_heartbeat_at', null);
        return val ? new Date(val) : null;
    }

    getBackoffUntil(): Date | null {
        const val = this.getKV('rate_limit_backoff_until', null);
        return val ? new Date(val) : null;
    }

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
