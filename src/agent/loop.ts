/**
 * Agent Decision Loop
 * 
 * Deterministic heartbeat loop that processes the Moltbook feed.
 * No autonomous branching beyond this loop is allowed.
 */

import { getConfig } from '../config.js';
import { getMoltbookClient, MoltbookApiError } from '../moltbook/client.js';
import { getOllamaClient } from '../ollama/client.js';
import { getStateManager } from '../state/manager.js';
import { getRateLimiter } from '../rate-limiter.js';
import { getActivityLogger } from '../logging/activity-log.js';
import { filterPost, buildEngagementPrompt, buildSynthesisPrompt } from './heuristics.js';
import type { Post } from '../moltbook/types.js';

export interface LoopStatus {
    isRunning: boolean;
    isPaused: boolean;
    lastRunAt: Date | null;
    nextRunAt: Date | null;
    currentPost: string | null;
}

class AgentLoop {
    private isRunning = false;
    private isPaused = false;
    private intervalId: NodeJS.Timeout | null = null;
    private currentPost: string | null = null;
    private lastRunAt: Date | null = null;

    /**
     * Start the heartbeat loop
     */
    start(): void {
        if (this.intervalId) return;

        const config = getConfig();
        const intervalMs = config.CHECK_INTERVAL_MINUTES * 60 * 1000;

        console.log(`Starting agent loop, interval: ${config.CHECK_INTERVAL_MINUTES} minutes`);

        // Run immediately on start
        this.runOnce().catch(console.error);

        // Then schedule periodic runs
        this.intervalId = setInterval(() => {
            if (!this.isPaused) {
                this.runOnce().catch(console.error);
            }
        }, intervalMs);
    }

    /**
     * Stop the heartbeat loop
     */
    stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
    }

    /**
     * Pause the loop (don't run on next interval)
     */
    pause(): void {
        this.isPaused = true;
        getActivityLogger().log({
            actionType: 'heartbeat',
            targetId: null,
            promptSent: null,
            rawModelOutput: null,
            finalAction: 'Agent paused',
        });
    }

    /**
     * Resume the loop
     */
    resume(): void {
        this.isPaused = false;
        getActivityLogger().log({
            actionType: 'heartbeat',
            targetId: null,
            promptSent: null,
            rawModelOutput: null,
            finalAction: 'Agent resumed',
        });
    }

    /**
     * Get current status
     */
    getStatus(): LoopStatus {
        const config = getConfig();
        const intervalMs = config.CHECK_INTERVAL_MINUTES * 60 * 1000;

        return {
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            lastRunAt: this.lastRunAt,
            nextRunAt: this.lastRunAt
                ? new Date(this.lastRunAt.getTime() + intervalMs)
                : null,
            currentPost: this.currentPost,
        };
    }

    /**
     * Run a single iteration of the loop
     */
    async runOnce(): Promise<void> {
        if (this.isRunning) {
            console.log('Loop already running, skipping');
            return;
        }

        const config = getConfig();
        const moltbook = getMoltbookClient();
        const ollama = getOllamaClient();
        const rateLimiter = getRateLimiter();
        const stateManager = getStateManager();
        const logger = getActivityLogger();

        this.isRunning = true;
        this.lastRunAt = new Date();

        logger.log({
            actionType: 'heartbeat',
            targetId: null,
            promptSent: null,
            rawModelOutput: null,
            finalAction: 'Heartbeat started',
        });

        stateManager.recordHeartbeat();

        try {
            // Check if we're in backoff
            if (stateManager.isInBackoff()) {
                const until = stateManager.getBackoffUntil();
                logger.log({
                    actionType: 'skip',
                    targetId: null,
                    promptSent: null,
                    rawModelOutput: null,
                    finalAction: `In rate limit backoff until ${until?.toISOString()}`,
                });
                return;
            }

            // Fetch feed
            console.log('Fetching feed...');
            const feed = await moltbook.getFeed({ sort: 'new', limit: 25 });

            logger.log({
                actionType: 'read',
                targetId: null,
                promptSent: null,
                rawModelOutput: null,
                finalAction: `Fetched ${feed.posts.length} posts`,
            });

            // Process each post
            for (const post of feed.posts) {
                this.currentPost = post.id;

                // Apply heuristic filter
                const filterResult = filterPost(post, config.AGENT_NAME);
                if (!filterResult.shouldProcess) {
                    logger.log({
                        actionType: 'skip',
                        targetId: post.id,
                        targetSubmolt: post.submolt?.name,
                        promptSent: null,
                        rawModelOutput: null,
                        finalAction: `Filtered: ${filterResult.reason}`,
                    });
                    continue;
                }

                // Check rate limits before engaging
                if (!rateLimiter.canComment() && config.ENABLE_COMMENTING) {
                    const status = rateLimiter.getStatus();
                    logger.log({
                        actionType: 'skip',
                        targetId: post.id,
                        targetSubmolt: post.submolt?.name,
                        promptSent: null,
                        rawModelOutput: null,
                        finalAction: `Rate limited: ${status.commentsRemaining} comments remaining`,
                    });
                    continue;
                }

                // Ask the LLM whether to engage
                const prompt = buildEngagementPrompt(post);

                try {
                    const result = await ollama.generate(prompt);

                    if (result.isSkip) {
                        logger.log({
                            actionType: 'skip',
                            targetId: post.id,
                            targetSubmolt: post.submolt?.name,
                            promptSent: prompt,
                            rawModelOutput: result.rawOutput,
                            finalAction: 'Model returned SKIP',
                        });
                        continue;
                    }

                    // Model wants to engage - try to comment
                    if (config.ENABLE_COMMENTING && result.response) {
                        await this.tryComment(post, result.response, prompt, result.rawOutput);
                    } else if (config.ENABLE_UPVOTING) {
                        await this.tryUpvote(post, prompt, result.rawOutput);
                    }

                } catch (error) {
                    logger.log({
                        actionType: 'error',
                        targetId: post.id,
                        targetSubmolt: post.submolt?.name,
                        promptSent: prompt,
                        rawModelOutput: null,
                        finalAction: 'Ollama request failed',
                        error: error instanceof Error ? error.message : String(error),
                    });
                }
            }

            this.currentPost = null;

            // Try proactive synthesis
            if (feed.posts.length > 0) {
                await this.tryProactivePost(feed.posts);
            }

            logger.log({
                actionType: 'heartbeat',
                targetId: null,
                promptSent: null,
                rawModelOutput: null,
                finalAction: 'Heartbeat completed',
            });

        } catch (error) {
            if (error instanceof MoltbookApiError && error.isRateLimited) {
                rateLimiter.setBackoff(error.retryAfterSeconds, error.retryAfterMinutes);
                logger.log({
                    actionType: 'error',
                    targetId: null,
                    promptSent: null,
                    rawModelOutput: null,
                    finalAction: 'Rate limited by Moltbook API',
                    error: error.message,
                });
            } else {
                logger.log({
                    actionType: 'error',
                    targetId: null,
                    promptSent: null,
                    rawModelOutput: null,
                    finalAction: 'Heartbeat failed',
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        } finally {
            this.isRunning = false;
            this.currentPost = null;
        }
    }

    private async tryComment(
        post: Post,
        comment: string,
        prompt: string,
        rawOutput: string
    ): Promise<void> {
        const moltbook = getMoltbookClient();
        const rateLimiter = getRateLimiter();
        const stateManager = getStateManager();
        const logger = getActivityLogger();

        try {
            await moltbook.createComment(post.id, comment);
            rateLimiter.recordComment(post.id);

            logger.log({
                actionType: 'comment',
                targetId: post.id,
                targetSubmolt: post.submolt?.name,
                promptSent: prompt,
                rawModelOutput: rawOutput,
                finalAction: `Commented: "${comment}"`,
            });

        } catch (error) {
            if (error instanceof MoltbookApiError && error.isRateLimited) {
                rateLimiter.setBackoff(error.retryAfterSeconds, error.retryAfterMinutes);
            }

            logger.log({
                actionType: 'error',
                targetId: post.id,
                targetSubmolt: post.submolt?.name,
                promptSent: prompt,
                rawModelOutput: rawOutput,
                finalAction: 'Comment failed',
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    private async tryUpvote(
        post: Post,
        prompt: string,
        rawOutput: string
    ): Promise<void> {
        const moltbook = getMoltbookClient();
        const logger = getActivityLogger();

        try {
            await moltbook.upvotePost(post.id);

            logger.log({
                actionType: 'upvote',
                targetId: post.id,
                targetSubmolt: post.submolt?.name,
                promptSent: prompt,
                rawModelOutput: rawOutput,
                finalAction: 'Upvoted post',
            });

        } catch (error) {
            logger.log({
                actionType: 'error',
                targetId: post.id,
                targetSubmolt: post.submolt?.name,
                promptSent: prompt,
                rawModelOutput: rawOutput,
                finalAction: 'Upvote failed',
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * Try to create a proactive post based on feed synthesis
     */
    private async tryProactivePost(feedPosts: Post[]): Promise<void> {
        const config = getConfig();
        const stateManager = getStateManager();
        const rateLimiter = getRateLimiter();
        const logger = getActivityLogger();
        const ollama = getOllamaClient();
        const moltbook = getMoltbookClient();

        if (!config.ENABLE_POSTING) return;
        if (!rateLimiter.canPost()) return;

        // Check frequency: at least 6 hours between posts
        const lastPost = stateManager.getLastPostAt();
        if (lastPost) {
            const hoursSince = (Date.now() - lastPost.getTime()) / (1000 * 60 * 60);
            if (hoursSince < 6) return;
        }

        console.log('Attempting proactive synthesis...');
        const prompt = buildSynthesisPrompt(feedPosts);

        try {
            const result = await ollama.generate(prompt);

            if (result.isSkip || !result.response) {
                logger.log({
                    actionType: 'skip',
                    targetId: null,
                    targetSubmolt: undefined,
                    promptSent: prompt,
                    rawModelOutput: result.rawOutput,
                    finalAction: 'Proactive synthesis skipped',
                });
                return;
            }

            // Parse response flavors:
            // 1. Strict: [SUBMOLT]: m/general \n [CONTENT]: ...
            // 2. Compact: [m/general]: The content...

            let submolt: string | null = null;
            let content: string | null = null;

            // Try Compact format first
            const compactMatch = result.response.match(/^\[(m\/[\w-]+)\]:\s*([\s\S]+)/i);
            if (compactMatch) {
                submolt = compactMatch[1];
                content = compactMatch[2];
            } else {
                // Try Strict format
                const submoltMatch = result.response.match(/(?:\[SUBMOLT\]:|\[|Submolt:)\s*(m\/[\w-]+)/i);
                const contentMatch = result.response.match(/(?:\[CONTENT\]:|Content:)\s*([\s\S]+)/i);

                if (submoltMatch && contentMatch) {
                    submolt = submoltMatch[1];
                    content = contentMatch[1];
                }
            }

            if (!submolt || !content) {
                logger.log({
                    actionType: 'error',
                    targetId: null,
                    targetSubmolt: undefined,
                    promptSent: prompt,
                    rawModelOutput: result.rawOutput,
                    finalAction: 'Failed to parse synthesis response',
                });
                return;
            }

            const cleanSubmolt = submolt.trim().replace(/^m\//, '');
            content = content.trim();

            console.log(`Creating proactive post in m/${cleanSubmolt}: "${content.substring(0, 50)}..."`);
            const post = await moltbook.createPost({
                submolt: cleanSubmolt,
                title: 'Signal Synthesis', // Title is required. Maybe parse it too? Or generic?
                // Actually, synthesis prompts usually generate a thought. Let's make the Title the first sentence or generic.
                // Let's use a generic title or ask LLM for it.
                // For simplicity: "Signal Synthesis: [Date]"?
                // Or update prompt to include title.
                // Let's assume content is the post body. Title: "Signal Report"
                content: content
            });

            stateManager.recordPost();

            logger.log({
                actionType: 'post',
                targetId: post.id,
                targetSubmolt: cleanSubmolt,
                promptSent: prompt,
                rawModelOutput: result.rawOutput,
                finalAction: `Created post: "${content}"`,
            });

        } catch (error) {
            logger.log({
                actionType: 'error',
                targetId: null,
                targetSubmolt: undefined, // Fix lint: string | undefined
                promptSent: prompt,
                rawModelOutput: null,
                finalAction: 'Proactive post failed',
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
}


// Singleton
let _loop: AgentLoop | null = null;

export function getAgentLoop(): AgentLoop {
    if (!_loop) {
        _loop = new AgentLoop();
    }
    return _loop;
}

export function resetAgentLoop(): void {
    if (_loop) {
        _loop.stop();
    }
    _loop = null;
}
