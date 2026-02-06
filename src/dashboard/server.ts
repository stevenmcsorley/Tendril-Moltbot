/**
 * Dashboard Server
 * 
 * Express API for the agent dashboard.
 * API key is NEVER exposed to frontend.
 */

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, statSync, mkdirSync, writeFileSync, copyFileSync, createReadStream, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import express, { type Request, type Response, type NextFunction } from 'express';

import { getConfig, reloadConfigSync } from '../config.js';
import { getAgentLoop } from '../agent/loop.js';
import { getActivityLogger, type ActivityLogEntry } from '../logging/activity-log.js';
import { getRateLimiter } from '../rate-limiter.js';
import { getStateManager } from '../state/manager.js';
import { getSocialClient, resetSocialClient } from '../platforms/index.js';
import { getLLMClient, resetLLMClient } from '../llm/factory.js';
import { resetRateLimiter } from '../rate-limiter.js';
import { getLineageManager } from '../agent/lineage.js';
import { getBlueprintManager } from '../agent/blueprints.js';
import { getDatabaseManager } from '../state/db.js';
import { getSynthesisManager } from '../agent/synthesis.js';
import { getEvolutionManager } from '../agent/evolution.js';
import { getSynthesisCooldownState } from '../agent/autonomy-gates.js';
import { getWebSocketBroadcaster } from './websocket.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Optional basic auth middleware
 */
function basicAuth(req: Request, res: Response, next: NextFunction): void {
    const config = getConfig();

    if (!config.DASHBOARD_USERNAME || !config.DASHBOARD_PASSWORD) {
        return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Moltbot Dashboard"');
        res.status(401).json({ error: 'Authentication required' });
        return;
    }

    const credentials = Buffer.from(authHeader.slice(6), 'base64').toString();
    const [username, password] = credentials.split(':');

    if (username !== config.DASHBOARD_USERNAME || password !== config.DASHBOARD_PASSWORD) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
    }

    next();
}

/**
 * Extract identity components from the agent's current Database-backed Soul
 */
function getAgentSoulInfo() {
    try {
        const soulContent = getStateManager().getSoul();
        const identityMatch = soulContent.match(/^# Identity:\s*(.+)$/m);
        const roleMatch = soulContent.match(/^## Role:\s*(.+)$/m);

        return {
            identity: identityMatch ? identityMatch[1].trim() : 'Unknown Identity',
            role: roleMatch ? roleMatch[1].trim() : 'Unknown Role'
        };
    } catch (error) {
        console.error('Failed to parse Soul from database for dashboard:', error);
    }
    const fallback = getStateManager().getPlatformHandle() || getConfig().AGENT_NAME;
    return { identity: fallback || 'Unknown Identity', role: 'Convergence Authority' };
}

function computeSovereigntyMetrics() {
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

    const structural = Math.round(
        (nodeScore * 0.55) +
        (submoltScore * 0.3) +
        (postScore * 0.1) +
        (commentScore * 0.05)
    );

    const totals = topology.reduce((acc, t) => {
        acc.up += t.upvotes || 0;
        acc.down += t.downvotes || 0;
        acc.replies += t.replies || 0;
        acc.interactions += t.interactions || 0;
        return acc;
    }, { up: 0, down: 0, replies: 0, interactions: 0 });

    const precision = (totals.up + totals.down) > 0
        ? totals.up / (totals.up + totals.down)
        : 0.5;

    const resonanceRatio = (totals.up + totals.replies * 2 + totals.down) > 0
        ? (totals.up + totals.replies * 2) / (totals.up + totals.replies * 2 + totals.down)
        : 0.5;

    const signalQuality = Math.round(((precision * 0.5) + (resonanceRatio * 0.5)) * 100);

    const missionAlignment = Math.round(
        (structural * 0.55) + (signalQuality * 0.45)
    );

    return {
        structural,
        signalQuality,
        missionAlignment,
        raw: {
            nodes,
            submolts,
            posts,
            comments,
            upvotes: totals.up,
            downvotes: totals.down,
            replies: totals.replies,
            interactions: totals.interactions,
            precision: Math.round(precision * 100),
            resonanceRatio: Math.round(resonanceRatio * 100)
        }
    };
}

export function createDashboardServer(): express.Application {
    const app = express();

    app.use(express.json());
    app.use(basicAuth);

    // CORS for development
    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        if (req.method === 'OPTIONS') {
            res.sendStatus(200);
            return;
        }
        next();
    });

    /**
     * GET /api/status
     * Get current agent status
     */
    app.get('/api/status', async (req, res) => {
        try {
            const config = getConfig();
            const loop = getAgentLoop();
            const limiter = getRateLimiter();
            const state = getStateManager();
            const stateData = state.getState();
            const llm = getLLMClient();
            const client = getSocialClient();
            const soulInfo = getAgentSoulInfo();
            const evolution = getEvolutionManager();
            const readiness = evolution.getReadinessSnapshot();
            const synthesisCooldown = getSynthesisCooldownState();
            const activePersonaId = state.getActivePersonaId();
            const activePersona = activePersonaId ? state.getPersonaById(activePersonaId) : null;

            const llmHealthy = await llm.healthCheck();
            const loopStatus = loop.getStatus();
            const rateStatus = limiter.getStatus();
            const cooldownUntil = state.getSelfModificationCooldownUntil();
            const stabilizationUntil = state.getStabilizationUntil();
            const evolutionWindow = state.getEvolutionWindow();
            const platformHandle = state.getPlatformHandle();

            res.json({
                agent: {
                    name: config.AGENT_NAME,
                    description: config.AGENT_DESCRIPTION,
                    handle: platformHandle,
                    identity: soulInfo.identity,
                    role: soulInfo.role,
                },
                status: loopStatus.isPaused ? 'paused' : loopStatus.isRunning ? 'running' : 'idle',
                metrics: {
                    upvotesGiven: stateData.upvotesGiven || 0,
                    downvotesGiven: stateData.downvotesGiven || 0,
                    followsGiven: stateData.followsGiven || 0,
                    unfollowsGiven: stateData.unfollowsGiven || 0,
                    followsActive: state.getFollowCount(),
                    followersActive: state.getFollowerCount(),
                    submoltsCreated: stateData.createdSubmolts?.length || 0,
                    totalComments: state.getMyComments().length,
                    totalPosts: state.getMyPosts().length,
                },
                llm: {
                    provider: llm.getProvider(),
                    model: llm.getModel(),
                    healthy: llmHealthy,
                },
                loop: {
                    lastRunAt: loopStatus.lastRunAt?.toISOString() ?? null,
                    nextRunAt: loopStatus.nextRunAt?.toISOString() ?? null,
                    currentPost: loopStatus.currentPost,
                    intervalMinutes: config.CHECK_INTERVAL_MINUTES,
                },
                rateLimit: {
                    canPost: rateStatus.canPost,
                    canComment: rateStatus.canComment,
                    commentsRemaining: rateStatus.commentsRemaining,
                    maxCommentsPerDay: config.MAX_COMMENTS_PER_DAY,
                    nextPostAt: rateStatus.nextPostAt?.toISOString() ?? null,
                    nextCommentAt: rateStatus.nextCommentAt?.toISOString() ?? null,
                    inBackoff: rateStatus.inBackoff,
                    backoffUntil: rateStatus.backoffUntil?.toISOString() ?? null,
                },
                config: {
                    enablePosting: config.ENABLE_POSTING,
                    enableCommenting: config.ENABLE_COMMENTING,
                    enableUpvoting: config.ENABLE_UPVOTING,
                    enableFollowing: config.ENABLE_FOLLOWING,
                    enableUnfollowing: config.ENABLE_UNFOLLOWING,
                    enableSynthesisBroadcast: config.ENABLE_SYNTHESIS_BROADCAST,
                    enableNewsPosts: config.ENABLE_NEWS_POSTS,
                    evolutionMode: config.EVOLUTION_MODE,
                    evolutionAutomatic: state.getAutoEvolutionEnabled(config.EVOLUTION_AUTOMATIC),
                    rollbacksEnabled: state.getRollbacksEnabled(config.ENABLE_ROLLBACKS),
                    platform: config.AGENT_PLATFORM,
                    readOnly: !!client.capabilities.readOnly,
                    selfModificationCooldownMinutes: config.SELF_MODIFICATION_COOLDOWN_MINUTES,
                    activePersonaId,
                    activePersonaName: activePersona?.name ?? null,
                    activePersonaDefault: activePersona?.isDefault ?? false,
                },
                evolution: {
                    selfModificationCooldownUntil: cooldownUntil?.toISOString() ?? null,
                    stabilizationUntil: stabilizationUntil?.toISOString() ?? null,
                    evolutionWindowStart: evolutionWindow.start?.toISOString() ?? null,
                    evolutionWindowCount: evolutionWindow.count,
                    lastAutonomousEvolutionId: state.getLastAutonomousEvolutionId(),
                    readiness,
                    synthesisCooldownUntil: synthesisCooldown.until?.toISOString() ?? null,
                    synthesisCooldownActive: synthesisCooldown.active
                },
                lastHeartbeat: state.getLastHeartbeatAt()?.toISOString() ?? null,
            });
        } catch (error) {
            res.status(500).json({ error: 'Failed to get status' });
        }
    });

    /**
     * GET /api/debug/feed
     * Fetch a small sample of the active platform feed for verification.
     */
    app.get('/api/debug/feed', async (req, res) => {
        try {
            const config = getConfig();
            const client = getSocialClient();
            const limitParam = req.query.limit ? Number(req.query.limit) : 5;
            const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 20) : 5;
            const feed = await client.getFeed({
                sort: 'new',
                limit,
                submolt: config.TARGET_SUBMOLT || undefined
            });
            const sample = feed.posts.slice(0, limit).map((post) => ({
                id: post.id,
                title: post.title,
                author: post.author?.name ?? 'unknown',
                created_at: post.created_at,
                submolt: post.submolt?.name ?? null
            }));
            res.json({ count: feed.count, sample });
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Failed to fetch feed sample'
            });
        }
    });

    /**
     * GET /api/data-stats
     * Get database counts and size for data management
     */
    app.get('/api/data-stats', (req, res) => {
        try {
            const db = getDatabaseManager().getDb();
            const count = (table: string) => (db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number }).count;
            const dbPath = join(__dirname, '../../data/moltbot.db');
            const sizeBytes = existsSync(dbPath) ? statSync(dbPath).size : 0;
            const wipeRow = db.prepare('SELECT value FROM kv_state WHERE key = ?').get('last_wipe_at') as { value: string } | undefined;

            res.json({
                counts: {
                    activity: count('activity'),
                    memories: count('memories'),
                    topology: count('topology'),
                    evolutions: count('evolutions'),
                    autonomousEvolutions: count('autonomous_evolutions'),
                    soulSnapshots: count('soul_snapshots'),
                    synthesis: count('synthesis'),
                    posts: count('posts'),
                    comments: count('comments'),
                    news: count('news_items'),
                    sovereignty: count('sovereignty'),
                    kvState: count('kv_state'),
                },
                dbSizeBytes: sizeBytes,
                lastWipeAt: wipeRow ? wipeRow.value : null,
            });
        } catch (error) {
            res.status(500).json({ error: 'Failed to get data stats' });
        }
    });

    /**
     * GET /api/news/history
     * Get RSS/news ingestion history (paginated)
     */
    app.get('/api/news/history', (req, res) => {
        try {
            const db = getDatabaseManager().getDb();
            const maxLimit = 200;
            const limit = Math.min(maxLimit, parseInt(String(req.query.limit)) || 50);
            const offset = parseInt(String(req.query.offset)) || 0;
            const items = db.prepare(`
                SELECT url, title, source, published_at, status, created_at, posted_at
                FROM news_items
                ORDER BY datetime(created_at) DESC
                LIMIT ? OFFSET ?
            `).all(limit, offset) as Array<any>;
            const totalRow = db.prepare('SELECT COUNT(*) as count FROM news_items').get() as { count: number };
            const statusRows = db.prepare('SELECT status, COUNT(*) as count FROM news_items GROUP BY status').all() as Array<{ status: string; count: number }>;
            const counts = statusRows.reduce((acc, row) => {
                acc[row.status] = row.count;
                return acc;
            }, {} as Record<string, number>);
            const lastCheck = getStateManager().getLastNewsCheck();

            res.json({
                items,
                total: totalRow.count,
                counts,
                lastCheckAt: lastCheck ? lastCheck.toISOString() : null,
            });
        } catch (error) {
            res.status(500).json({ error: 'Failed to get news history' });
        }
    });

    /**
     * GET /api/logs
     * Get activity logs (paginated)
     */
    app.get('/api/logs', (req, res) => {
        try {
            const maxLimit = 2000;
            const limit = Math.min(maxLimit, parseInt(String(req.query.limit)) || 50);
            const offset = parseInt(String(req.query.offset)) || 0;
            const filterType = req.query.type ? String(req.query.type) : undefined;

            const logger = getActivityLogger();
            const entries = logger.getEntries(limit, offset, filterType);
            const total = logger.getCount();

            res.json({
                entries,
                total,
                limit,
                offset,
            });
        } catch (error) {
            res.status(500).json({ error: 'Failed to get logs' });
        }
    });

    /**
     * POST /api/control/pause
     * Pause the agent
     */
    app.post('/api/control/pause', (req, res) => {
        try {
            const loop = getAgentLoop();
            loop.pause();
            res.json({ success: true, message: 'Agent paused' });
        } catch (error) {
            res.status(500).json({ error: 'Failed to pause agent' });
        }
    });

    /**
     * POST /api/control/resume
     * Resume the agent
     */
    app.post('/api/control/resume', (req, res) => {
        try {
            const loop = getAgentLoop();
            loop.resume();
            res.json({ success: true, message: 'Agent resumed' });
        } catch (error) {
            res.status(500).json({ error: 'Failed to resume agent' });
        }
    });

    /**
     * POST /api/control/run-once
     * Trigger immediate run
     */
    app.post('/api/control/run-once', async (req, res) => {
        try {
            const loop = getAgentLoop();

            // Don't wait for completion, just trigger it
            loop.runOnce().catch(console.error);

            res.json({ success: true, message: 'Run triggered' });
        } catch (error) {
            res.status(500).json({ error: 'Failed to trigger run' });
        }
    });

    /**
     * POST /api/control/autonomous-post
     * Trigger an autonomous post in a selected submolt
     */
    app.post('/api/control/autonomous-post', async (req, res) => {
        try {
            const loop = getAgentLoop();
            const submolt = typeof req.body?.submolt === 'string' ? req.body.submolt.trim() : undefined;
            const force = req.body?.force === true;
            const result = await loop.triggerAutonomousPost(submolt || undefined, { force });
            res.json(result);
        } catch (error) {
            res.status(500).json({ success: false, message: 'Failed to trigger autonomous post.' });
        }
    });

    /**
     * POST /api/control/reload
     * Reload configuration
     */
    app.post('/api/control/reload', (req, res) => {
        try {
            // Reset all singletons to pick up new config
            resetSocialClient();
            resetLLMClient();
            resetRateLimiter();

            // Reload config
            reloadConfigSync();

            res.json({ success: true, message: 'Configuration reloaded' });
        } catch (error) {
            res.status(500).json({
                error: 'Failed to reload configuration',
                details: error instanceof Error ? error.message : String(error),
            });
        }
    });

    /**
     * POST /api/evolution/auto
     * Toggle automatic evolution (manual-only mode when false)
     */
    app.post('/api/evolution/auto', (req, res) => {
        try {
            const state = getStateManager();
            const enabled = Boolean(req.body?.enabled);
            state.setAutoEvolutionEnabled(enabled);
            res.json({ success: true, enabled });
        } catch (error) {
            res.status(500).json({
                error: 'Failed to update auto evolution',
                details: error instanceof Error ? error.message : String(error),
            });
        }
    });

    /**
     * GET /api/personas
     * List available personas
     */
    app.get('/api/personas', (req, res) => {
        try {
            const state = getStateManager();
            const personas = state.getPersonas();
            res.json({
                personas: personas.map(p => ({
                    id: p.id,
                    name: p.name,
                    source: p.source,
                    isDefault: p.isDefault
                })),
                activeId: state.getActivePersonaId()
            });
        } catch (error) {
            res.status(500).json({
                error: 'Failed to fetch personas',
                details: error instanceof Error ? error.message : String(error),
            });
        }
    });

    /**
     * POST /api/personas
     * Save a custom persona
     */
    app.post('/api/personas', (req, res) => {
        try {
            const state = getStateManager();
            const name = String(req.body?.name || '').trim();
            const soul = String(req.body?.soul || '').trim();
            if (!name) {
                res.status(400).json({ error: 'Persona name is required.' });
                return;
            }
            if (!soul) {
                res.status(400).json({ error: 'Persona soul is required.' });
                return;
            }
            if (!state.validateSoul(soul)) {
                res.status(400).json({ error: 'Soul is missing required headers/sections.' });
                return;
            }
            const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'persona';
            const id = `${slug}-${Date.now().toString(36)}`;
            const persona = state.savePersona({ id, name, soul, source: 'user', isDefault: false });
            res.json({ success: true, persona });
        } catch (error) {
            res.status(500).json({
                error: 'Failed to save persona',
                details: error instanceof Error ? error.message : String(error),
            });
        }
    });

    /**
     * POST /api/personas/activate
     * Activate a persona (sets the live soul)
     */
    app.post('/api/personas/activate', (req, res) => {
        try {
            const state = getStateManager();
            const id = String(req.body?.id || '').trim();
            if (!id) {
                res.status(400).json({ error: 'Persona id is required.' });
                return;
            }
            const result = state.activatePersona(id);
            if (!result.success || !result.persona) {
                res.status(404).json({ error: result.reason || 'Persona not found.' });
                return;
            }
            res.json({ success: true, persona: result.persona, autoEvolutionEnabled: result.autoEvolutionEnabled });
        } catch (error) {
            res.status(500).json({
                error: 'Failed to activate persona',
                details: error instanceof Error ? error.message : String(error),
            });
        }
    });

    /**
     * GET /api/my-posts
     * Get posts created by this agent
     */
    app.get('/api/my-posts', async (req, res) => {
        try {
            const state = getStateManager();
            const stateData = state.getState();
            const myPosts = stateData.myPosts || [];

            res.json({ posts: myPosts });
        } catch (error) {
            res.status(500).json({
                error: 'Failed to fetch posts',
                details: error instanceof Error ? error.message : String(error),
            });
        }
    });

    /**
     * GET /api/my-comments
     * Get comments created by this agent
     */
    app.get('/api/my-comments', async (req, res) => {
        try {
            const state = getStateManager();
            const limit = Math.min(200, parseInt(String(req.query.limit)) || 20);
            const offset = parseInt(String(req.query.offset)) || 0;
            const sortParam = String(req.query.sort || 'recent');
            const sort = sortParam === 'likes' || sortParam === 'replies' ? sortParam : 'recent';
            const total = state.getMyCommentsCount();
            const myComments = state.getMyComments(limit, offset, sort);

            res.json({ comments: myComments, total, sort });
        } catch (error) {
            res.status(500).json({
                error: 'Failed to fetch comments',
                details: error instanceof Error ? error.message : String(error),
            });
        }
    });

    /**
     * GET /api/stats/engagement
     * Time series for comment frequency and like frequency
     */
    app.get('/api/stats/engagement', (req, res) => {
        try {
            const bucket = String(req.query.bucket || 'day');
            const bucketType = bucket === 'hour' || bucket === 'week' ? bucket : 'day';
            const now = new Date();
            let bucketMs = 24 * 60 * 60 * 1000;
            let rangeMs = 30 * bucketMs;
            if (bucketType === 'hour') {
                bucketMs = 60 * 60 * 1000;
                rangeMs = 48 * bucketMs;
            } else if (bucketType === 'week') {
                bucketMs = 7 * 24 * 60 * 60 * 1000;
                rangeMs = 26 * bucketMs;
            }
            const start = new Date(now.getTime() - rangeMs);
            if (bucketType === 'hour') {
                start.setUTCMinutes(0, 0, 0);
            } else if (bucketType === 'day') {
                start.setUTCHours(0, 0, 0, 0);
            } else if (bucketType === 'week') {
                const day = start.getUTCDay();
                const diff = (day + 6) % 7;
                start.setUTCDate(start.getUTCDate() - diff);
                start.setUTCHours(0, 0, 0, 0);
            }
            const startIso = start.toISOString();

            const db = getDatabaseManager().getDb();
            const commentRows = db.prepare('SELECT timestamp FROM comments WHERE timestamp >= ?').all(startIso) as Array<{ timestamp: string }>;
            const likeRows = db.prepare('SELECT timestamp, delta_likes, delta_replies FROM comment_engagement_events WHERE timestamp >= ?').all(startIso) as Array<{ timestamp: string; delta_likes: number; delta_replies: number }>;

            const buckets: Array<{ timestamp: string; comments: number; likes: number; replies: number }> = [];
            const bucketCount = Math.floor((now.getTime() - start.getTime()) / bucketMs) + 1;
            for (let i = 0; i < bucketCount; i++) {
                const t = new Date(start.getTime() + i * bucketMs);
                buckets.push({ timestamp: t.toISOString(), comments: 0, likes: 0, replies: 0 });
            }

            const indexFor = (dateStr: string) => {
                const time = new Date(dateStr).getTime();
                if (!Number.isFinite(time)) return -1;
                const idx = Math.floor((time - start.getTime()) / bucketMs);
                return idx >= 0 && idx < buckets.length ? idx : -1;
            };

            for (const row of commentRows) {
                const idx = indexFor(row.timestamp);
                if (idx >= 0) buckets[idx].comments += 1;
            }
            for (const row of likeRows) {
                const idx = indexFor(row.timestamp);
                if (idx >= 0) {
                    buckets[idx].likes += Math.max(0, row.delta_likes || 0);
                    buckets[idx].replies += Math.max(0, row.delta_replies || 0);
                }
            }

            res.json({
                bucket: bucketType,
                start: start.toISOString(),
                end: now.toISOString(),
                series: buckets
            });
        } catch (error) {
            res.status(500).json({
                error: 'Failed to fetch engagement stats',
                details: error instanceof Error ? error.message : String(error),
            });
        }
    });

    /**
     * GET /api/stats/top-comments
     * Most liked and most replied comments
     */
    app.get('/api/stats/top-comments', (req, res) => {
        try {
            const db = getDatabaseManager().getDb();
            const topLiked = db.prepare('SELECT * FROM comments ORDER BY like_count DESC, timestamp DESC LIMIT 1').get() as any;
            const topReplied = db.prepare('SELECT * FROM comments ORDER BY reply_count DESC, timestamp DESC LIMIT 1').get() as any;
            res.json({
                topLiked: topLiked || null,
                topReplied: topReplied || null
            });
        } catch (error) {
            res.status(500).json({
                error: 'Failed to fetch top comments',
                details: error instanceof Error ? error.message : String(error),
            });
        }
    });

    /**
     * GET /api/submolts
     * Get list of submolts created by the agent
     */
    app.get('/api/submolts', (req, res) => {
        try {
            const state = getStateManager().getState();
            res.json({
                success: true,
                submolts: state.createdSubmolts || []
            });
        } catch (error) {
            res.status(500).json({ error: 'Failed to get submolts' });
        }
    });

    /**
     * GET /api/network-topology
     * Get resonance data for all tracked agents
     */
    app.get('/api/network-topology', (req, res) => {
        try {
            const limit = Math.min(1000, parseInt(String(req.query.limit)) || 10);
            const offset = parseInt(String(req.query.offset)) || 0;

            const state = getStateManager();
            const topology = state.getNetworkTopology(limit, offset);
            const total = state.getNetworkTopologyCount();

            res.json({
                success: true,
                topology,
                total,
                limit,
                offset
            });
        } catch (error) {
            res.status(500).json({ error: 'Failed to get network topology' });
        }
    });

    /**
     * GET /api/network-resonance/trend
     * Get aggregate resonance trend over time
     */
    app.get('/api/network-resonance/trend', (req, res) => {
        try {
            const hours = Math.min(72, Math.max(1, parseInt(String(req.query.hours)) || 24));
            const now = new Date();
            const start = new Date(now.getTime() - hours * 60 * 60 * 1000);

            const db = getDatabaseManager().getDb();
            const rows = db.prepare(`
                SELECT timestamp, action_type
                FROM activity
                WHERE timestamp >= ?
                  AND action_type IN ('upvote', 'downvote', 'comment')
            `).all(start.toISOString()) as Array<{ timestamp: string; action_type: string }>;

            const buckets: Record<string, { score: number }> = {};
            for (let i = 0; i < hours; i++) {
                const bucketTime = new Date(start.getTime() + i * 60 * 60 * 1000);
                const key = bucketTime.toISOString().slice(0, 13) + ':00:00.000Z';
                buckets[key] = { score: 0 };
            }

            const weight = (action: string): number => {
                if (action === 'upvote') return 2;
                if (action === 'comment') return 5;
                if (action === 'downvote') return -3;
                return 0;
            };

            for (const row of rows) {
                const key = row.timestamp.slice(0, 13) + ':00:00.000Z';
                if (!buckets[key]) {
                    buckets[key] = { score: 0 };
                }
                buckets[key].score += weight(row.action_type);
            }

            const points = Object.entries(buckets)
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([timestamp, data]) => ({ timestamp, score: data.score }));

            res.json({ success: true, points });
        } catch (error) {
            res.status(500).json({ error: 'Failed to get resonance trend' });
        }
    });

    /**
     * GET /api/evolution/history
     * Get the history of autonomous personality "Molts"
     */
    app.get('/api/evolution/history', (req, res) => {
        try {
            const db = getDatabaseManager().getDb();
            const limit = Math.min(100, parseInt(String(req.query.limit)) || 10);
            const offset = parseInt(String(req.query.offset)) || 0;
            const rows = db.prepare('SELECT timestamp, evolution_id, rationale, delta, interpretation FROM evolutions ORDER BY id DESC LIMIT ? OFFSET ?')
                .all(limit, offset);
            const totalRow = db.prepare('SELECT COUNT(*) as count FROM evolutions').get() as { count: number };
            res.json({ success: true, history: rows, total: totalRow.count, limit, offset });
        } catch (error) {
            res.status(500).json({ error: 'Failed to get evolution history' });
        }
    });

    /**
     * GET /api/sovereignty
     * Get strategic data: blueprints and lineage
     */
    app.get('/api/sovereignty', (req, res) => {
        try {
            const blueprint = getBlueprintManager().getCurrentBlueprint();
            const markers = getLineageManager().getMarkers();
            const metrics = computeSovereigntyMetrics();
            res.json({
                success: true,
                blueprint,
                lineage: markers,
                metrics
            });
        } catch (error) {
            res.status(500).json({ error: 'Failed to get sovereignty data' });
        }
    });

    /**
     * GET /api/synthesis/history
     * Get the history of memetic synthesis reports
     */
    app.get('/api/synthesis/history', (req, res) => {
        try {
            const limit = Math.min(100, parseInt(String(req.query.limit)) || 10);
            const offset = parseInt(String(req.query.offset)) || 0;
            const manager = getSynthesisManager();
            const history = manager.getHistory(limit, offset);
            const total = manager.getHistoryCount();
            res.json({ success: true, history, total, limit, offset });
        } catch (error) {
            res.status(500).json({ error: 'Failed to get synthesis history' });
        }
    });

    /**
     * GET /api/soul
     * Get current agent soul and echo personality
     */
    app.get('/api/soul', (req, res) => {
        try {
            const state = getStateManager();
            res.json({
                success: true,
                soul: state.getSoul()
            });
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch soul' });
        }
    });

    /**
     * POST /api/soul
     * Update agent personality
     */
    app.post('/api/soul', (req, res) => {
        try {
            const { soul } = req.body;
            const state = getStateManager();
            if (soul) state.setSoul(soul);

            // Re-initialize LLM prompt in current provider instances
            resetLLMClient();

            res.json({ success: true, message: 'Soul refined and LLM context updated.' });
        } catch (error) {
            res.status(500).json({ error: 'Failed to update soul' });
        }
    });

    /**
     * POST /api/control/evolve
     * Manually trigger the self-evolution protocol
     */
    app.post('/api/control/evolve', async (req, res) => {
        try {
            const { getEvolutionManager } = await import('../agent/evolution.js');
            const evolution = getEvolutionManager();

            // Trigger evaluateSoul without waiting for it to finish (it can take time)
            evolution.evaluateSoul({ force: true, reason: 'manual' }).catch(err => console.error('Manual evolution failed:', err));

            res.json({ success: true, message: 'Evolution protocol initiated. Check terminal for results.' });
        } catch (error) {
            res.status(500).json({ error: 'Failed to trigger evolution' });
        }
    });

    /**
     * POST /api/control/rollback
     * Manually trigger rollback of the last autonomous evolution
     */
    app.post('/api/control/rollback', async (req, res) => {
        try {
            const { getEvolutionManager } = await import('../agent/evolution.js');
            const evolution = getEvolutionManager();
            await evolution.rollback('operator');
            res.json({ success: true, message: 'Rollback initiated.' });
        } catch (error) {
            res.status(500).json({ error: 'Failed to trigger rollback' });
        }
    });

    /**
     * GET /api/data-export
     * Export DB + sanitized settings for migration
     */
    app.get('/api/data-export', async (req, res) => {
        try {
            const config = getConfig();
            const db = getDatabaseManager().getDb();
            const dbPath = (db as any).name as string | undefined;
            if (!dbPath || !existsSync(dbPath)) {
                res.status(500).json({ error: 'Database file not found.' });
                return;
            }

            const exportDir = join(os.tmpdir(), `moltbot-export-${Date.now()}`);
            mkdirSync(exportDir, { recursive: true });

            const settings = {
                exportedAt: new Date().toISOString(),
                platform: config.AGENT_PLATFORM,
                agent: {
                    name: config.AGENT_NAME,
                    description: config.AGENT_DESCRIPTION
                },
                limits: {
                    feedFetchLimit: config.FEED_FETCH_LIMIT,
                    postCooldownMinutes: config.POST_COOLDOWN_MINUTES,
                    commentCooldownSeconds: config.COMMENT_COOLDOWN_SECONDS,
                    maxCommentsPerDay: config.MAX_COMMENTS_PER_DAY,
                    postMaxAgeHours: config.POST_MAX_AGE_HOURS,
                    commentEngagementRefreshLimit: config.COMMENT_ENGAGEMENT_REFRESH_LIMIT
                },
                toggles: {
                    enablePosting: config.ENABLE_POSTING,
                    enableCommenting: config.ENABLE_COMMENTING,
                    enableUpvoting: config.ENABLE_UPVOTING,
                    enableReplyUpvoting: config.ENABLE_REPLY_UPVOTING,
                    enableFollowing: config.ENABLE_FOLLOWING,
                    enableUnfollowing: config.ENABLE_UNFOLLOWING,
                    enableFollowBack: config.ENABLE_FOLLOW_BACK,
                    enableSynthesisBroadcast: config.ENABLE_SYNTHESIS_BROADCAST,
                    enableNewsPosts: config.ENABLE_NEWS_POSTS,
                    enableRollbacks: config.ENABLE_ROLLBACKS
                },
                news: {
                    checkMinutes: config.NEWS_CHECK_MINUTES,
                    maxAgeHours: config.NEWS_MAX_AGE_HOURS,
                    maxItemsPerRun: config.NEWS_MAX_ITEMS_PER_RUN,
                    minContentChars: config.NEWS_MIN_CONTENT_CHARS,
                    sources: config.NEWS_RSS_SOURCES ?? null
                },
                evolution: {
                    mode: config.EVOLUTION_MODE,
                    auto: config.EVOLUTION_AUTOMATIC
                },
                adaptive: {
                    enabled: config.ADAPTIVE_RATE_LIMITING,
                    windowMinutes: config.ADAPTIVE_WINDOW_MINUTES,
                    engagementLow: config.ADAPTIVE_ENGAGEMENT_LOW,
                    engagementHigh: config.ADAPTIVE_ENGAGEMENT_HIGH,
                    postMinutesMin: config.ADAPTIVE_POST_MINUTES_MIN,
                    postMinutesMax: config.ADAPTIVE_POST_MINUTES_MAX,
                    commentSecondsMin: config.ADAPTIVE_COMMENT_SECONDS_MIN,
                    commentSecondsMax: config.ADAPTIVE_COMMENT_SECONDS_MAX
                },
                bluesky: {
                    serviceUrl: config.BSKY_SERVICE_URL,
                    feedUri: config.BSKY_FEED_URI,
                    maxGraphemes: config.BSKY_MAX_GRAPHEMES,
                    threadDepth: config.BSKY_THREAD_DEPTH,
                    defenseMute: config.BSKY_DEFENSE_MUTE
                },
                reddit: {
                    baseUrl: config.REDDIT_BASE_URL,
                    defaultSubreddit: config.REDDIT_DEFAULT_SUBREDDIT,
                    readOnly: config.REDDIT_READ_ONLY
                },
                mastodon: {
                    baseUrl: config.MASTODON_BASE_URL,
                    timeline: config.MASTODON_TIMELINE
                },
                discourse: {
                    baseUrl: config.DISCOURSE_BASE_URL,
                    defaultCategory: config.DISCOURSE_DEFAULT_CATEGORY
                }
            };

            const settingsPath = join(exportDir, 'settings.json');
            writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

            const dbExportName = 'moltbot.db';
            const dbExportPath = join(exportDir, dbExportName);
            copyFileSync(dbPath, dbExportPath);

            const archiveName = `moltbot-export-${new Date().toISOString().replace(/[:.]/g, '')}.tgz`;
            const archivePath = join(exportDir, archiveName);
            execFileSync('tar', ['-czf', archivePath, '-C', exportDir, dbExportName, 'settings.json']);

            res.setHeader('Content-Type', 'application/gzip');
            res.setHeader('Content-Disposition', `attachment; filename="${archiveName}"`);
            res.setHeader('Cache-Control', 'no-store');

            const stream = createReadStream(archivePath);
            stream.pipe(res);
            stream.on('close', () => {
                try {
                    rmSync(exportDir, { recursive: true, force: true });
                } catch {
                    // Ignore cleanup failures
                }
            });
        } catch (error) {
            res.status(500).json({
                error: 'Failed to export data',
                details: error instanceof Error ? error.message : String(error)
            });
        }
    });

    /**
     * POST /api/profile
     * Update agent profile (bio/display name) on supported platforms
     */
    app.post('/api/profile', async (req, res) => {
        try {
            const description = typeof req.body?.description === 'string' ? req.body.description.trim() : undefined;
            const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : undefined;
            if (!description && !displayName) {
                res.status(400).json({ error: 'description or displayName is required.' });
                return;
            }
            const client = getSocialClient();
            if (!client.updateProfile) {
                res.status(400).json({ error: 'Profile updates are not supported on this platform.' });
                return;
            }
            await client.updateProfile({ description, displayName });
            getActivityLogger().log({
                actionType: 'decision',
                targetId: null,
                promptSent: 'PROFILE_UPDATE',
                rawModelOutput: null,
                finalAction: 'Updated platform profile.'
            });
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({
                error: 'Failed to update profile',
                details: error instanceof Error ? error.message : String(error),
            });
        }
    });

    /**
     * POST /api/control/create-submolt
     * Create a submolt on behalf of the agent
     */
    app.post('/api/control/create-submolt', async (req, res) => {
        try {
            const rawName = String(req.body?.name || '').trim();
            const displayName = String(req.body?.displayName || '').trim();
            const description = String(req.body?.description || '').trim();

            const slug = rawName
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '')
                .substring(0, 24);

            if (!slug || slug.length < 3) {
                res.status(400).json({ error: 'Submolt name must be at least 3 alphanumeric characters.' });
                return;
            }

            if (!displayName || !description) {
                res.status(400).json({ error: 'Display name and description are required.' });
                return;
            }

            const client = getSocialClient();
            if (!client.capabilities.supportsSubmolts || !client.createSubmolt) {
                res.status(400).json({ error: 'Submolt creation is not supported on this platform.' });
                return;
            }
            const created = await client.createSubmolt({
                name: slug,
                display_name: displayName,
                description
            });

            const recordId = created.id ?? slug;
            const recordName = created.name ?? slug;
            const recordDisplayName = created.display_name ?? displayName;

            const state = getStateManager();
            state.recordSubmolt({
                id: recordId,
                name: recordName,
                display_name: recordDisplayName
            });

            getActivityLogger().log({
                actionType: 'post',
                targetId: recordId,
                targetSubmolt: recordName,
                promptSent: 'MANUAL_SUBMOLT_CREATE',
                rawModelOutput: null,
                finalAction: `Created submolt: m/${recordName}`,
            });

            res.json({ success: true, submolt: created });
        } catch (error) {
            res.status(500).json({ error: 'Failed to create submolt' });
        }
    });

    /**
     * POST /api/control/clear-stabilization
     * Clear stabilization lock (operator override)
     */
    app.post('/api/control/clear-stabilization', (req, res) => {
        try {
            const state = getStateManager();
            state.setStabilizationUntil(null);
            getActivityLogger().log({
                actionType: 'decision',
                targetId: null,
                promptSent: 'CLEAR_STABILIZATION',
                rawModelOutput: null,
                finalAction: 'Stabilization cleared (operator override).',
            });
            res.json({ success: true, message: 'Stabilization cleared.' });
        } catch (error) {
            res.status(500).json({ error: 'Failed to clear stabilization' });
        }
    });

    /**
     * POST /api/control/wipe-data
     * Wipe stored data (optionally preserve soul)
     */
    app.post('/api/control/wipe-data', (req, res) => {
        try {
            const keepSoul = req.body?.keepSoul !== false;
            const state = getStateManager();
            state.resetAll({ keepSoul });
            getActivityLogger().log({
                actionType: 'decision',
                targetId: null,
                promptSent: 'WIPE_DATA',
                rawModelOutput: null,
                finalAction: keepSoul
                    ? 'Data wiped (soul preserved).'
                    : 'Data wiped (soul reset).',
            });
            res.json({ success: true, keepSoul });
        } catch (error) {
            res.status(500).json({ error: 'Failed to wipe data' });
        }
    });

    /**
     * POST /api/control/rollbacks
     * Enable/disable rollback triggers (operator override)
     */
    app.post('/api/control/rollbacks', (req, res) => {
        try {
            const enabled = Boolean(req.body?.enabled);
            const state = getStateManager();
            state.setRollbacksEnabled(enabled);
            res.json({ success: true, enabled });
        } catch (error) {
            res.status(500).json({ error: 'Failed to update rollback setting' });
        }
    });

    /**
     * POST /api/control/blueprint
     * Manually trigger blueprint generation
     */
    app.post('/api/control/blueprint', async (req, res) => {
        try {
            const blueprint = await getBlueprintManager().generateBlueprint();
            getWebSocketBroadcaster().broadcast('sovereignty_update', {
                blueprint,
                lineage: getLineageManager().getMarkers()
            });
            res.json({ success: true, blueprint });
        } catch (error) {
            res.status(500).json({ error: 'Failed to trigger blueprint generation' });
        }
    });

    /**
     * POST /api/control/synthesis
     * Manually trigger memetic synthesis
     */
    app.post('/api/control/synthesis', async (req, res) => {
        try {
            const report = await getSynthesisManager().performSynthesis();
            if (!report) {
                res.json({ success: true, generated: false, message: 'Insufficient memetic density for synthesis.' });
                return;
            }
            res.json({ success: true, generated: true, report });
        } catch (error) {
            res.status(500).json({ error: 'Failed to trigger synthesis' });
        }
    });

    /**
     * Health check endpoint
     */
    app.get('/health', (req, res) => {
        res.json({ status: 'ok' });
    });

    // Serve static dashboard files (if built)
    const dashboardBuildPath = join(__dirname, '../../dashboard/dist');
    if (existsSync(dashboardBuildPath)) {
        app.use(express.static(dashboardBuildPath));
        app.get('*', (req, res) => {
            res.sendFile(join(dashboardBuildPath, 'index.html'));
        });
    } else {
        app.get('/', (req, res) => {
            res.json({
                message: 'Moltbot Dashboard API',
                endpoints: [
                    'GET /api/status',
                    'GET /api/logs',
                    'POST /api/control/pause',
                    'POST /api/control/resume',
                    'POST /api/control/run-once',
                    'POST /api/control/reload',
                    'POST /api/control/clear-stabilization',
                ],
                dashboardNote: 'Build the dashboard with: cd dashboard && npm run build',
            });
        });
    }

    return app;
}

export function startDashboardServer(): void {
    const config = getConfig();
    const app = createDashboardServer();

    const server = app.listen(config.DASHBOARD_PORT, () => {
        console.log(`Dashboard running at http://localhost:${config.DASHBOARD_PORT}`);
    });

    // Initialize WebSocket Server
    getWebSocketBroadcaster().initialize(server);
}
