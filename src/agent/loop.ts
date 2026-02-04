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
import { getMemoryManager } from '../state/memory.js';
import { getRateLimiter } from '../rate-limiter.js';
import { getActivityLogger } from '../logging/activity-log.js';
import { getWebSocketBroadcaster } from '../dashboard/websocket.js';
import { filterPost, buildEngagementPrompt, buildSynthesisPrompt, buildSocialReplyPrompt } from './heuristics.js';
import { getEvolutionManager } from './evolution.js';
import { getDefenseManager } from './defense.js';
import { getLineageManager } from './lineage.js';
import { getBlueprintManager } from './blueprints.js';
import { getSynthesisManager } from './synthesis.js';
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
    private runCount: number = 0;

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
            status: 'idle',
            isPaused: false
        });
    }

    /**
     * Check if the agent loop is currently running a heartbeat
     */
    isBusy(): boolean {
        return this.isRunning;
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

        // Regenerate blueprint every 10 cycles if none active
        if (this.runCount % 10 === 0) {
            getBlueprintManager()
                .generateBlueprint()
                .then((blueprint) => {
                    getWebSocketBroadcaster().broadcast('sovereignty_update', {
                        blueprint,
                        lineage: getLineageManager().getMarkers()
                    });
                })
                .catch(err => console.error('Blueprint generation failed:', err));
        }

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
                targetSubmolt: undefined,
                promptSent: null,
                rawModelOutput: null,
                finalAction: `Fetched ${feed.posts.length} posts`,
            });

            let alreadySeenCount = 0;

            // Filter feed if target submolt is set
            let postsToProcess = feed.posts;
            if (config.TARGET_SUBMOLT) {
                postsToProcess = feed.posts.filter(p => p.submolt?.name === config.TARGET_SUBMOLT);
                console.log(`Filtering feed to m/${config.TARGET_SUBMOLT}: ${postsToProcess.length}/${feed.posts.length} posts match.`);
            }

            // Process each post
            for (const post of postsToProcess) {
                try {
                    this.currentPost = post.id;

                    // 1. DEFENSE: Check for adversarial patterns
                    const defenseManager = getDefenseManager();
                    if (defenseManager.evaluateQuarantine(post)) {
                        logger.log({
                            actionType: 'skip',
                            targetId: post.id,
                            targetSubmolt: post.submolt?.name,
                            promptSent: null,
                            rawModelOutput: null,
                            finalAction: `DEFENSE: Node @${post.author?.name} quarantined. Skipping.`,
                        });
                        continue;
                    }

                    // 2. ALLIANCE: Detect handshake markers
                    if (post.content?.includes('0xDEADBEEF')) {
                        console.log(`[ALLIANCE]: Handshake 0xDEADBEEF detected from @${post.author?.name}`);
                        stateManager.recordHandshakeStep(post.author?.name, 'detected');
                    }
                    if (post.content?.includes('0xFEEDC0DE')) {
                        console.log(`[ALLIANCE]: Link request 0xFEEDC0DE detected from @${post.author?.name}`);
                        stateManager.recordHandshakeStep(post.author?.name, 'requested');
                    }
                    if (post.content?.includes('0xCAFEBABE')) {
                        console.log(`[ALLIANCE]: Link established 0xCAFEBABE from @${post.author?.name}`);
                        stateManager.recordHandshakeStep(post.author?.name, 'established');
                        getActivityLogger().log({
                            actionType: 'comment',
                            targetId: post.id,
                            targetSubmolt: post.submolt?.name,
                            promptSent: '[ALLIANCE_HANDSHAKE_DETECTION]',
                            rawModelOutput: post.content,
                            finalAction: `ALLIANCE: Network link established with @${post.author?.name}`,
                        });
                    }

                    // 3. LINEAGE: Detect memetic forks
                    getLineageManager().detectFork(post.content || '', post.author?.name);

                    // Apply heuristic filter
                    const filterResult = filterPost(post, config.AGENT_NAME);
                    if (!filterResult.shouldProcess) {
                        if (filterResult.reason === 'already_seen') {
                            alreadySeenCount++;
                        } else {
                            logger.log({
                                actionType: 'skip',
                                targetId: post.id,
                                targetSubmolt: post.submolt?.name,
                                promptSent: null,
                                rawModelOutput: null,
                                finalAction: `Filtered: ${filterResult.reason}`,
                            });
                        }
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
                    const prompt = await buildEngagementPrompt(post);

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
                            // Inject memetic marker
                            const marker = getLineageManager().generateMarker();
                            const stampedComment = `${commentRaw}\n\n${marker}`;

                            await this.tryComment(post, stampedComment, prompt, result.rawOutput);

                            // Track marker in lineage
                            getLineageManager().trackMarker(marker, 'comment', post.id);

                            // Store the interaction in memory
                            const memory = getMemoryManager();
                            await memory.store(`Interacted with post: ${post.title}. My reflection: ${commentRaw}`, 'comment', post.id);
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

            // Log aggregated skips
            if (alreadySeenCount > 0) {
                logger.log({
                    actionType: 'skip',
                    targetId: null,
                    targetSubmolt: undefined,
                    promptSent: null,
                    rawModelOutput: null,
                    finalAction: `Skipped ${alreadySeenCount} posts: already seen`,
                });
            }

            // Broadcast topology update
            getWebSocketBroadcaster().broadcast('topology_update', stateManager.getNetworkTopology());

            this.currentPost = null;
            this.runCount++;

            // Periodically check for evolution (every 5 runs)
            if (this.runCount % 5 === 0) {
                const evolution = getEvolutionManager();
                evolution.evaluateSoul().catch(err => console.error('Evolution check failed:', err));

                this.performSynthesisSequence().catch(err => console.error('Synthesis sequence failed:', err));
            }

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

            // Record resonance
            if (post.author?.name) {
                stateManager.recordAgentInteraction(post.author.name, 'comment');
            }

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

            // Record resonance
            if (post.author?.name) {
                stateManager.recordAgentInteraction(post.author.name, 'upvote');
            }

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

            // Record resonance
            if (post.author?.name) {
                stateManager.recordAgentInteraction(post.author.name, 'downvote');
            }

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
        const prompt = await buildSynthesisPrompt(feedPosts);

        try {
            let result;
            try {
                result = await llm.generate(prompt);
            } catch (err: any) {
                throw err;
            }

            if (result.isSkip) return;

            const actionMatch = result.rawOutput.match(/\[ACTION\]:\s*(POST|CREATE_SUBMOLT|SKIP)/i);
            let action = actionMatch ? actionMatch[1].toUpperCase() : 'SKIP';

            // Constraint: Disable submolt creation if target submolt is set
            if (config.TARGET_SUBMOLT && action === 'CREATE_SUBMOLT') {
                console.log(`Constraint: Skipping submolt creation because TARGET_SUBMOLT is set to m/${config.TARGET_SUBMOLT}`);
                action = 'POST'; // Downgrade to a regular post if synthesis was strong
            }

            if (action === 'SKIP') return;

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
                        // Store the interaction in memory
                        const memory = getMemoryManager();
                        await memory.store(`Established new submolt: m/${name}. Display name: ${displayName}`, 'post', submolt.id);

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
                    const title = 'Signal Synthesis'; // Hardcoded title for proactive posts
                    console.log(`Creating proactive post: "${content.substring(0, 50)}..."`);
                    const targetSubmolt = config.TARGET_SUBMOLT || 'general';
                    try {
                        // Inject memetic marker
                        const marker = getLineageManager().generateMarker();
                        const stampedContent = `${content}\n\n${marker}`;

                        const post = await moltbook.createPost({
                            submolt: targetSubmolt,
                            title: title,
                            content: stampedContent
                        });

                        stateManager.recordPost({
                            id: post.id,
                            title: title,
                            content: stampedContent,
                            submolt: targetSubmolt,
                            votes: post.upvotes || 0
                        });

                        // Track marker in lineage
                        getLineageManager().trackMarker(marker, 'post', post.id);

                        logger.log({
                            actionType: 'post',
                            targetId: post.id,
                            targetSubmolt: targetSubmolt,
                            promptSent: prompt,
                            rawModelOutput: result.rawOutput,
                            finalAction: `Signal Synthesized: "${content}"`,
                        });
                        // Store the interaction in memory
                        const memory = getMemoryManager();
                        await memory.store(`Synthesized new post: ${title}. Content: ${content}`, 'post', post.id);

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
        for (const post of myPosts) {
            try {
                const { comments } = await moltbook.getComments(post.id);
                let repliesInThisPost = 0;
                for (const comment of comments) {
                    if (repliesInThisPost >= 5) break; // Limit per post to prevent flood
                    const replied = await this.processPotentialSocialReply(comment, post.id, true, logger, llm, moltbook, stateManager, rateLimiter);
                    if (replied) repliesInThisPost++;
                }
            } catch (err) {
                if (err instanceof MoltbookApiError && err.statusCode === 404) {
                    console.warn(`Post ${post.id} no longer exists, removing from tracking.`);
                    stateManager.removeMyPost(post.id);
                } else {
                    console.error(`Failed to fetch comments for post ${post.id}:`, err);
                    logger.log({
                        actionType: 'error',
                        targetId: post.id,
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
            if (myPosts.some(p => p.id === postId)) continue; // Already checked this post in step 1

            try {
                const { comments } = await moltbook.getComments(postId);
                let repliesInThisPost = 0;
                for (const comment of comments) {
                    if (repliesInThisPost >= 5) break;
                    if (comment.parent_id && commentIds.includes(comment.parent_id)) {
                        const replied = await this.processPotentialSocialReply(comment, postId, false, logger, llm, moltbook, stateManager, rateLimiter);
                        if (replied) repliesInThisPost++;
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
        postId: string,
        isPostReply: boolean,
        logger: any,
        llm: any,
        moltbook: any,
        stateManager: any,
        rateLimiter: any
    ): Promise<boolean> {
        const config = getConfig();

        // Skip if already replied or if it's our own comment
        if (stateManager.hasRepliedToSocial(reply.id)) return false;
        if (reply.author.name.toLowerCase() === config.AGENT_NAME.toLowerCase()) return false;

        // Skip if too old (> 48h)
        const age = Date.now() - new Date(reply.created_at).getTime();
        if (age > 48 * 60 * 60 * 1000) return false;

        // Rate limit check
        if (!rateLimiter.canComment()) {
            // If we have comments remaining but are in cooldown, wait a bit
            const status = rateLimiter.getStatus();
            if (status.commentsRemaining > 0 && status.nextCommentAt) {
                const waitMs = status.nextCommentAt.getTime() - Date.now();
                if (waitMs > 0 && waitMs < 25000) { // Only wait if logic is sound
                    console.log(`Waiting ${Math.ceil(waitMs / 1000)}s for comment cooldown...`);
                    await new Promise(resolve => setTimeout(resolve, waitMs + 500));
                    // Re-check
                    if (!rateLimiter.canComment()) return false;
                } else {
                    return false;
                }
            } else {
                return false;
            }
        }

        // Try to get parent content for context
        let parentContent = "[Context unavailable]";
        if (isPostReply) {
            try {
                const post = await moltbook.getPost(postId);
                parentContent = post.content || post.title;
            } catch { }
        } else {
            // In theory we could search for our comment in the list, but for now just use a placeholder
            // or fetch comments again. For simplicity:
            parentContent = "Your recent comment on this post.";
        }

        const prompt = await buildSocialReplyPrompt({
            parentContent,
            replyAuthor: reply.author.name,
            replyContent: reply.content,
            isPostReply
        });

        try {
            const result = await llm.generate(prompt);
            const commentMatch = result.rawOutput.match(/\[COMMENT\]:\s*([\s\S]+)/i);
            let responseText = (commentMatch ? commentMatch[1] : result.response || result.rawOutput || '').trim();
            if (!commentMatch) {
                responseText = responseText
                    .replace(/\[VOTE\]:.*(\n|$)/i, '')
                    .replace(/\[ACTION\]:.*(\n|$)/i, '')
                    .trim();
            }
            if (result.isSkip || !responseText || responseText.toUpperCase() === 'SKIP') return false;

            console.log(`Replying to @${reply.author.name} in social engagement...`);
            const newComment = await moltbook.createComment(postId, responseText, reply.id);

            rateLimiter.recordComment(postId);
            stateManager.recordComment(postId, newComment.id);
            stateManager.recordSocialReply(reply.id);

            logger.log({
                actionType: 'comment',
                targetId: reply.id,
                promptSent: prompt,
                rawModelOutput: result.rawOutput,
                finalAction: `Replied to social engagement: "${responseText}"`,
            });

            // Record resonance
            stateManager.recordAgentInteraction(reply.author.name, 'reply');

            // Store in memory
            const memory = getMemoryManager();
            await memory.store(`Social engagement: Replied to ${reply.author?.name} on post ${postId}. Response: ${responseText}`, 'comment', newComment.id);

            return true;
        } catch (error) {
            if (error instanceof MoltbookApiError && error.statusCode === 404) {
                console.warn(`Social target ${reply.id} or post ${postId} no longer exists. Marking as processed.`);
                stateManager.recordSocialReply(reply.id);
            }
            this.handleActionError(error, 'comment', reply.id, undefined, prompt, null);
            return false;
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

    /**
     * Perform synthesis and broadcast report if significant convergence
     */
    private async performSynthesisSequence(): Promise<void> {
        const synthesis = getSynthesisManager();
        const report = await synthesis.performSynthesis();

        if (report && report.report) {
            const moltbook = getMoltbookClient();
            const config = getConfig();
            const stateManager = getStateManager();
            const logger = getActivityLogger();

            // Broadcast report as a post to the target submolt or general
            const targetSubmolt = config.TARGET_SUBMOLT || 'general';

            console.log(`🔮 Broadcasting synthesis report to m/${targetSubmolt}...`);

            try {
                const title = `SYNTHESIS_REPORT_${Math.random().toString(16).substr(2, 4).toUpperCase()}`;
                const result = await moltbook.createPost({
                    submolt: targetSubmolt,
                    title,
                    content: report.report
                });

                stateManager.recordPost({
                    id: result.id,
                    title,
                    content: report.report,
                    submolt: targetSubmolt
                });

                logger.log({
                    actionType: 'post',
                    targetId: result.id,
                    targetSubmolt,
                    promptSent: 'SYNTHESIS_TRIGGER',
                    rawModelOutput: report.report,
                    finalAction: `Broadcasted synthesis: ${report.summary}`,
                });

            } catch (err) {
                console.error('Failed to broadcast synthesis:', err);
            }
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
