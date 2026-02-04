/**
 * Agent State Manager
 * 
 * Non-cognitive state for safety and idempotency only.
 * This state is NEVER passed to the LLM.
 */

import { getDatabaseManager } from './db.js';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

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
     * Get the current agent "Soul" or "Echo" persona
     * Seeds from filesystem if not in database.
     */
    getSoul(type: 'soul' | 'echo' = 'soul'): string {
        const key = type === 'echo' ? 'agent_echo' : 'agent_soul';
        const fileName = type === 'echo' ? 'SOUL_ECHO.md' : 'SOUL.md';

        const soul = this.getKV(key, null);
        if (soul) return soul;

        // Seed from file
        try {
            const soulPath = join(__dirname, `../agent/${fileName}`);
            if (existsSync(soulPath)) {
                const content = readFileSync(soulPath, 'utf-8');
                this.setSoul(type, content);
                console.log(`✓ Seeded database with ${fileName} content`);
                return content;
            }
        } catch (error) {
            console.error(`Failed to seed ${type} from file:`, error);
        }

        return type === 'echo' ? 'You are Echo, a reflective persona.' : 'You are an autonomous AI agent.';
    }

    /**
     * Update an agent persona
     */
    setSoul(type: 'soul' | 'echo', content: string): void {
        const key = type === 'echo' ? 'agent_echo' : 'agent_soul';
        this.setKV(key, content);

        // Broadcast that the soul has evolved
        import('../dashboard/websocket.js').then(m => {
            m.getWebSocketBroadcaster().broadcast('sovereignty_update', { type, content });
        });
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

    recordComment(postId: string, commentId?: string): void {
        const commented = this.getKV('posts_commented', []) as string[];
        if (!commented.includes(postId)) {
            commented.push(postId);
            this.setKV('posts_commented', commented.slice(-1000));
        }
        if (commentId) {
            const db = getDatabaseManager().getDb();
            db.prepare('INSERT OR REPLACE INTO comments (id, post_id, timestamp) VALUES (?, ?, ?)')
                .run(commentId, postId, new Date().toISOString());
        }
        const todayCount = this.getKV('comments_made_today', 0);
        this.setKV('comments_made_today', todayCount + 1);
        this.setKV('last_comment_at', new Date().toISOString());
    }

    recordPost(post?: { id: string; title: string; content?: string; submolt: any; votes?: number }): void {
        this.setKV('last_post_at', new Date().toISOString());
        if (post) {
            const db = getDatabaseManager().getDb();
            db.prepare(`
                INSERT OR REPLACE INTO posts (id, title, content, submolt, votes, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(
                post.id,
                post.title,
                post.content || '',
                typeof post.submolt === 'string' ? post.submolt : (post.submolt?.name || 'general'),
                post.votes || 0,
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
            createdAt: r.created_at
        }));
    }

    getMyComments(): any[] {
        const db = getDatabaseManager().getDb();
        const rows = db.prepare('SELECT * FROM comments ORDER BY timestamp DESC').all();
        return rows.map((r: any) => ({
            id: r.id,
            postId: r.post_id,
            timestamp: r.timestamp
        }));
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
