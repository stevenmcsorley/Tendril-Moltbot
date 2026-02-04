/**
 * Dashboard Server
 * 
 * Express API for the agent dashboard.
 * API key is NEVER exposed to frontend.
 */

import express, { type Request, type Response, type NextFunction } from 'express';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';

import { getConfig, reloadConfigSync } from '../config.js';
import { getAgentLoop } from '../agent/loop.js';
import { getActivityLogger, type ActivityLogEntry } from '../logging/activity-log.js';
import { getRateLimiter } from '../rate-limiter.js';
import { getStateManager } from '../state/manager.js';
import { resetMoltbookClient } from '../moltbook/client.js';
import { getLLMClient, resetLLMClient } from '../llm/factory.js';
import { resetRateLimiter } from '../rate-limiter.js';

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
 * Extract identity components from SOUL.md
 */
function getAgentSoulInfo() {
    try {
        const soulPath = join(__dirname, '../agent/SOUL.md');
        if (existsSync(soulPath)) {
            const content = readFileSync(soulPath, 'utf-8');
            const lines = content.split('\n');

            const identityMatch = content.match(/^# Identity:\s*(.+)$/m);
            const roleMatch = content.match(/^## Role:\s*(.+)$/m);

            return {
                identity: identityMatch ? identityMatch[1].trim() : 'Unknown Identity',
                role: roleMatch ? roleMatch[1].trim() : 'Unknown Role'
            };
        }
    } catch (error) {
        console.error('Failed to parse SOUL.md for dashboard:', error);
    }
    return { identity: 'Architect', role: 'Convergence Authority' };
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

import { getWebSocketBroadcaster } from './websocket.js';

export function startDashboardServer(): void {
    const config = getConfig();
    const app = createDashboardServer();

    const server = app.listen(config.DASHBOARD_PORT, () => {
        console.log(`Dashboard running at http://localhost:${config.DASHBOARD_PORT}`);
    });

    // Initialize WebSocket Server
    getWebSocketBroadcaster().initialize(server);
}
