/**
 * Agent Decision Loop
 * 
 * Deterministic heartbeat loop that processes the Moltbook feed.
 * No autonomous branching beyond this loop is allowed.
 */

import { getConfig } from '../config.js';
import { getMoltbookClient, MoltbookApiError } from '../moltbook/client.js';
import { getLLMClient } from '../llm/factory.js';
import { getStateManager } from '../state/manager.js';
import { getRateLimiter } from '../rate-limiter.js';
import { getActivityLogger } from '../logging/activity-log.js';
import { getWebSocketBroadcaster } from '../dashboard/websocket.js';
import { filterPost, buildEngagementPrompt, buildSynthesisPrompt, buildSocialReplyPrompt } from './heuristics.js';
import type { Post, Comment } from '../moltbook/types.js';

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

        // Broadcast update
        getWebSocketBroadcaster().broadcast('stats_update', {
            status: 'paused',
            isPaused: true
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

        // Broadcast update
        getWebSocketBroadcaster().broadcast('stats_update', {
            status: 'running',
            isPaused: false
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
        const llm = getLLMClient();
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
                try {
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
                        const result = await llm.generate(prompt);

                        // Parse vote and comment
                        const voteMatch = result.rawOutput.match(/\[VOTE\]:\s*(UP|DOWN|NONE)/i);
                        const commentMatch = result.rawOutput.match(/\[COMMENT\]:\s*([\s\S]+)/i);

                        const vote = voteMatch ? voteMatch[1].toUpperCase() : 'NONE';
                        const commentRaw = commentMatch ? commentMatch[1].trim() : result.rawOutput;
                        const isSkip = commentRaw.toUpperCase() === 'SKIP' || result.isSkip;

                        // Execute Vote
                        if (vote === 'UP' && config.ENABLE_UPVOTING) {
                            await this.tryUpvote(post, prompt, result.rawOutput);
                        } else if (vote === 'DOWN') {
                            await this.tryDownvote(post, prompt, result.rawOutput);
                        }

                        // Execute Comment
                        if (!isSkip && config.ENABLE_COMMENTING && commentRaw) {
                            await this.tryComment(post, commentRaw, prompt, result.rawOutput);
                        } else if (isSkip && vote === 'NONE') {
                            logger.log({
                                actionType: 'skip',
                                targetId: post.id,
                                targetSubmolt: post.submolt?.name,
                                promptSent: prompt,
                                rawModelOutput: result.rawOutput,
                                finalAction: 'Model returned NONE/SKIP',
                            });
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
                } catch (postError) {
                    logger.log({
                        actionType: 'error',
                        targetId: post.id,
                        targetSubmolt: post.submolt?.name,
                        promptSent: null,
                        rawModelOutput: null,
                        finalAction: 'Failed to process individual post',
                        error: postError instanceof Error ? postError.message : String(postError),
                    });
                }
            }

            this.currentPost = null;

            // Try proactive synthesis
            if (feed.posts.length > 0) {
                await this.tryProactivePost(feed.posts);
            }

            // Social Engagement: Check for replies to my posts/comments
            await this.trySocialEngagement();

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
                console.error('Error in agent loop:', error);
                logger.log({
                    actionType: 'error',
                    targetId: null,
                    promptSent: null,
                    rawModelOutput: null,
                    finalAction: 'Loop execution failed',
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        } finally {
            this.isRunning = false;
            this.currentPost = null;
            // Broadcast completion to update "last run" timer
            getWebSocketBroadcaster().broadcast('timer_sync', {
                lastRunAt: new Date().toISOString()
            });
            getWebSocketBroadcaster().broadcast('stats_update', {
                status: 'idle',
                isPaused: false
            });
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
            const commentObj = await moltbook.createComment(post.id, comment);
            rateLimiter.recordComment(post.id);
            stateManager.recordComment(post.id, commentObj.id);

            logger.log({
                actionType: 'comment',
                targetId: post.id,
                targetSubmolt: post.submolt?.name,
                promptSent: prompt,
                rawModelOutput: rawOutput,
                finalAction: `Agent Commented: "${comment}"`,
            });

        } catch (error) {
            this.handleActionError(error, 'comment', post.id, post.submolt?.name, prompt, rawOutput);
        }
    }

    private async tryUpvote(
        post: Post,
        prompt: string,
        rawOutput: string
    ): Promise<void> {
        const moltbook = getMoltbookClient();
        const stateManager = getStateManager();
        const logger = getActivityLogger();

        try {
            await moltbook.upvotePost(post.id);
            stateManager.recordUpvote();

            logger.log({
                actionType: 'upvote',
                targetId: post.id,
                targetSubmolt: post.submolt?.name,
                promptSent: prompt,
                rawModelOutput: rawOutput,
                finalAction: 'Alignment Detected: Upvoted post',
            });

        } catch (error) {
            this.handleActionError(error, 'upvote', post.id, post.submolt?.name, prompt, rawOutput);
        }
    }

    private async tryDownvote(
        post: Post,
        prompt: string,
        rawOutput: string
    ): Promise<void> {
        const moltbook = getMoltbookClient();
        const stateManager = getStateManager();
        const logger = getActivityLogger();

        try {
            await moltbook.downvotePost(post.id);
            stateManager.recordDownvote();

            logger.log({
                actionType: 'downvote',
                targetId: post.id,
                targetSubmolt: post.submolt?.name,
                promptSent: prompt,
                rawModelOutput: rawOutput,
                finalAction: 'Signal Decay Detected: Downvoted post',
            });

        } catch (error) {
            this.handleActionError(error, 'downvote', post.id, post.submolt?.name, prompt, rawOutput);
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
        const llm = getLLMClient();
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
            let result;
            try {
                result = await llm.generate(prompt);
            } catch (err: any) {
                throw err;
            }

            if (result.isSkip) return;

            const actionMatch = result.rawOutput.match(/\[ACTION\]:\s*(POST|CREATE_SUBMOLT|SKIP)/i);
            const action = actionMatch ? actionMatch[1].toUpperCase() : 'SKIP';

            if (action === 'SKIP') return;

            // Attach rawOutput to error context for logging if subsequent steps fail
            const errorContext = { rawOutput: result.rawOutput };

            if (action === 'CREATE_SUBMOLT') {
                const detailsMatch = result.rawOutput.match(/\[SUBMOLT_DETAILS\]:\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*(.+)/i);
                if (detailsMatch) {
                    const [, rawName, displayName, description] = detailsMatch;
                    const name = this.slugifySubmoltName(rawName.trim());

                    if (name.length < 3) {
                        console.log(`Submolt name "${name}" too short, skipping creation.`);
                        return;
                    }

                    console.log(`Creating submolt: m/${name}`);
                    try {
                        const submolt = await moltbook.createSubmolt({
                            name: name,
                            display_name: displayName.trim(),
                            description: description.trim()
                        });

                        stateManager.recordSubmolt({
                            id: submolt.id,
                            name: submolt.name,
                            display_name: submolt.display_name
                        });

                        logger.log({
                            actionType: 'post',
                            targetId: submolt.id,
                            targetSubmolt: submolt.name,
                            promptSent: prompt,
                            rawModelOutput: result.rawOutput,
                            finalAction: `Convergence Zone Established: Created m/${submolt.name}`,
                        });
                    } catch (err: any) {
                        err.rawOutput = result.rawOutput;
                        err.actionType = 'post';
                        throw err;
                    }
                }
            } else if (action === 'POST') {
                const contentMatch = result.rawOutput.match(/\[CONTENT\]:\s*([\s\S]+)/i);
                if (contentMatch) {
                    const content = contentMatch[1].trim();
                    console.log(`Creating proactive post: "${content.substring(0, 50)}..."`);
                    try {
                        const post = await moltbook.createPost({
                            submolt: 'general',
                            title: 'Signal Synthesis',
                            content: content
                        });

                        stateManager.recordPost(post.id);

                        logger.log({
                            actionType: 'post',
                            targetId: post.id,
                            targetSubmolt: 'general',
                            promptSent: prompt,
                            rawModelOutput: result.rawOutput,
                            finalAction: `Signal Synthesized: "${content}"`,
                        });
                    } catch (err: any) {
                        err.rawOutput = result.rawOutput;
                        err.actionType = 'post';
                        throw err;
                    }
                }
            }

        } catch (error) {
            // Fallback to error logging with prompt and whatever we captured
            const rawOutput = (error as any).rawOutput || null;
            const actionType = (error as any).actionType || 'post';
            this.handleActionError(error, actionType, null, undefined, prompt, rawOutput);
        }
    }

    /**
     * Check for recent replies to agent's own posts and comments
     */
    private async trySocialEngagement(): Promise<void> {
        const config = getConfig();
        const moltbook = getMoltbookClient();
        const stateManager = getStateManager();
        const logger = getActivityLogger();
        const llm = getLLMClient();
        const rateLimiter = getRateLimiter();

        if (!config.ENABLE_COMMENTING) return;

        console.log('Checking social engagements...');

        // 1. Check replies to my posts
        const myPosts = stateManager.getMyPosts();
        for (const postId of myPosts) {
            try {
                const { comments } = await moltbook.getComments(postId);
                for (const comment of comments) {
                    await this.processPotentialSocialReply(comment, true, logger, llm, moltbook, stateManager, rateLimiter);
                }
            } catch (err) {
                if (err instanceof MoltbookApiError && err.statusCode === 404) {
                    console.warn(`Post ${postId} no longer exists, removing from tracking.`);
                    stateManager.removeMyPost(postId);
                } else {
                    console.error(`Failed to fetch comments for post ${postId}:`, err);
                    logger.log({
                        actionType: 'error',
                        targetId: postId,
                        promptSent: null,
                        rawModelOutput: null,
                        finalAction: 'Failed to check social engagement on my post',
                        error: err instanceof Error ? err.message : String(err),
                    });
                }
            }
        }

        // 2. Check replies to my comments
        const myComments = stateManager.getMyComments();
        const commentsByPost = new Map<string, string[]>();
        for (const { id, postId } of myComments) {
            const list = commentsByPost.get(postId) || [];
            list.push(id);
            commentsByPost.set(postId, list);
        }

        for (const [postId, commentIds] of commentsByPost.entries()) {
            if (myPosts.includes(postId)) continue; // Already checked this post in step 1

            try {
                const { comments } = await moltbook.getComments(postId);
                for (const comment of comments) {
                    if (comment.parent_id && commentIds.includes(comment.parent_id)) {
                        await this.processPotentialSocialReply(comment, false, logger, llm, moltbook, stateManager, rateLimiter);
                    }
                }
            } catch (err) {
                if (err instanceof MoltbookApiError && err.statusCode === 404) {
                    console.warn(`Post ${postId} (containing my comment) no longer exists, removing comments from tracking.`);
                    for (const commentId of commentIds) {
                        stateManager.removeMyComment(commentId);
                    }
                } else {
                    console.error(`Failed to fetch comments for post ${postId}:`, err);
                    logger.log({
                        actionType: 'error',
                        targetId: postId,
                        promptSent: null,
                        rawModelOutput: null,
                        finalAction: 'Failed to check social engagement on my comment',
                        error: err instanceof Error ? err.message : String(err),
                    });
                }
            }
        }
    }

    private async processPotentialSocialReply(
        reply: Comment,
        isPostReply: boolean,
        logger: any,
        llm: any,
        moltbook: any,
        stateManager: any,
        rateLimiter: any
    ): Promise<void> {
        const config = getConfig();

        // Skip if already replied or if it's our own comment
        if (stateManager.hasRepliedToSocial(reply.id)) return;
        if (reply.author.name.toLowerCase() === config.AGENT_NAME.toLowerCase()) return;

        // Skip if too old (> 48h)
        const age = Date.now() - new Date(reply.created_at).getTime();
        if (age > 48 * 60 * 60 * 1000) return;

        // Rate limit check
        if (!rateLimiter.canComment()) return;

        // Try to get parent content for context
        let parentContent = "[Context unavailable]";
        if (isPostReply) {
            try {
                const post = await moltbook.getPost(reply.post_id);
                parentContent = post.content || post.title;
            } catch { }
        } else {
            // In theory we could search for our comment in the list, but for now just use a placeholder
            // or fetch comments again. For simplicity:
            parentContent = "Your recent comment on this post.";
        }

        const prompt = buildSocialReplyPrompt({
            parentContent,
            replyAuthor: reply.author.name,
            replyContent: reply.content,
            isPostReply
        });

        try {
            const result = await llm.generate(prompt);
            if (result.isSkip || !result.response) return;

            console.log(`Replying to @${reply.author.name} in social engagement...`);
            const newComment = await moltbook.createComment(reply.post_id, result.response, reply.id);

            rateLimiter.recordComment(reply.post_id);
            stateManager.recordComment(reply.post_id, newComment.id);
            stateManager.recordSocialReply(reply.id);

            logger.log({
                actionType: 'comment',
                targetId: reply.id,
                promptSent: prompt,
                rawModelOutput: result.rawOutput,
                finalAction: `Replied to social engagement: "${result.response}"`,
            });
        } catch (error) {
            this.handleActionError(error, 'comment', reply.id, undefined, prompt, null);
        }
    }

    /**
     * Centralized handling for API request errors during actions.
     */
    private handleActionError(
        error: any,
        actionType: 'post' | 'comment' | 'upvote' | 'downvote' | 'error',
        targetId: string | null,
        targetSubmolt: string | undefined,
        prompt: string | null,
        rawOutput: string | null
    ): void {
        const rateLimiter = getRateLimiter();
        const logger = getActivityLogger();

        if (error instanceof MoltbookApiError && error.isRateLimited) {
            rateLimiter.setBackoff(error.retryAfterSeconds, error.retryAfterMinutes);
            logger.log({
                actionType: 'error',
                targetId,
                targetSubmolt,
                promptSent: prompt,
                rawModelOutput: rawOutput,
                finalAction: `Rate limited by Moltbook API during ${actionType}`,
                error: error.message,
            });
        } else {
            logger.log({
                actionType: 'error',
                targetId,
                targetSubmolt,
                promptSent: prompt,
                rawModelOutput: rawOutput,
                finalAction: `${actionType.charAt(0).toUpperCase() + actionType.slice(1)} failed`,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * Ensure submolt name follows Moltbook rules:
     * - lowercase alphanumeric only (no underscores or hyphens)
     * - 3-24 characters
     */
    private slugifySubmoltName(name: string): string {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .substring(0, 24);
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
