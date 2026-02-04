/**
 * Dashboard Server
 * 
 * Express API for the agent dashboard.
 * API key is NEVER exposed to frontend.
 */

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import express, { type Request, type Response, type NextFunction } from 'express';

import { getConfig, reloadConfigSync } from '../config.js';
import { getAgentLoop } from '../agent/loop.js';
import { getActivityLogger, type ActivityLogEntry } from '../logging/activity-log.js';
import { getRateLimiter } from '../rate-limiter.js';
import { getStateManager } from '../state/manager.js';
import { resetMoltbookClient } from '../moltbook/client.js';
import { getLLMClient, resetLLMClient } from '../llm/factory.js';
import { resetRateLimiter } from '../rate-limiter.js';
import { getLineageManager } from '../agent/lineage.js';
import { getBlueprintManager } from '../agent/blueprints.js';
import { getDatabaseManager } from '../state/db.js';
import { getSynthesisManager } from '../agent/synthesis.js';
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
    return { identity: 'Architect', role: 'Convergence Authority' };
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
            const soulInfo = getAgentSoulInfo();

            const llmHealthy = await llm.healthCheck();
            const loopStatus = loop.getStatus();
            const rateStatus = limiter.getStatus();

            res.json({
                agent: {
                    name: config.AGENT_NAME,
                    description: config.AGENT_DESCRIPTION,
                    identity: soulInfo.identity,
                    role: soulInfo.role,
                },
                status: loopStatus.isPaused ? 'paused' : loopStatus.isRunning ? 'running' : 'idle',
                metrics: {
                    upvotesGiven: stateData.upvotesGiven || 0,
                    downvotesGiven: stateData.downvotesGiven || 0,
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
                },
                lastHeartbeat: state.getLastHeartbeatAt()?.toISOString() ?? null,
            });
        } catch (error) {
            res.status(500).json({ error: 'Failed to get status' });
        }
    });

    /**
     * GET /api/logs
     * Get activity logs (paginated)
     */
    app.get('/api/logs', (req, res) => {
        try {
            const limit = Math.min(100, parseInt(String(req.query.limit)) || 50);
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
     * POST /api/control/reload
     * Reload configuration
     */
    app.post('/api/control/reload', (req, res) => {
        try {
            // Reset all singletons to pick up new config
            resetMoltbookClient();
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
            const limit = Math.min(100, parseInt(String(req.query.limit)) || 10);
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
     * GET /api/evolution/history
     * Get the history of autonomous personality "Molts"
     */
    app.get('/api/evolution/history', (req, res) => {
        try {
            const db = getDatabaseManager().getDb();
            const rows = db.prepare('SELECT timestamp, rationale, delta, interpretation FROM evolutions ORDER BY id DESC LIMIT 10').all();
            res.json({ success: true, history: rows });
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
            const history = getSynthesisManager().getHistory(10);
            res.json({ success: true, history });
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
