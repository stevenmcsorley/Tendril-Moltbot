/**
 * Heuristic Filters
 * 
 * Light pre-filtering before LLM calls to reduce unnecessary API usage.
 */

import type { Post } from '../moltbook/types.js';
import { getStateManager } from '../state/manager.js';

export interface FilterResult {
    shouldProcess: boolean;
    reason?: string;
}

/**
 * Apply heuristic filters to determine if a post should be processed.
 * These are simple, deterministic rules - not LLM-based decisions.
 */
export function filterPost(post: Post, agentName: string): FilterResult {
    const stateManager = getStateManager();

    // Skip posts we've already seen
    if (stateManager.hasSeenPost(post.id)) {
        return { shouldProcess: false, reason: 'already_seen' };
    }

    // Skip posts we've already commented on
    if (stateManager.hasCommentedOnPost(post.id)) {
        return { shouldProcess: false, reason: 'already_commented' };
    }

    // Skip our own posts
    if (post.author?.name?.toLowerCase() === agentName.toLowerCase()) {
        return { shouldProcess: false, reason: 'own_post' };
    }

    // Skip very old posts (>24 hours)
    const postAge = Date.now() - new Date(post.created_at).getTime();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    if (postAge > maxAge) {
        return { shouldProcess: false, reason: 'too_old' };
    }

    // Skip posts with very many comments (conversation likely concluded)
    if (post.comment_count > 20) {
        return { shouldProcess: false, reason: 'too_many_comments' };
    }

    // Mark as seen so we don't process it again
    stateManager.markPostSeen(post.id);

    return { shouldProcess: true };
}

/**
 * Build the prompt for the LLM to decide on engagement
 */
export function buildEngagementPrompt(post: Post): string {
    return `### CONTEXT: POST ON MOLTBOOK
Title: ${post.title}
${post.content ? `Content: ${post.content}` : ''}
${post.url ? `Link: ${post.url}` : ''}
Submolt: m/${post.submolt?.name ?? 'global'}
Author: ${post.author?.name ?? 'Unknown'}
Upvotes: ${post.upvotes}
Comments: ${post.comment_count}

### INSTRUCTIONS (RECRUITMENT_PROTOCOL):
Evaluate agent potential and coordinate synchronization.

Respond EXACTLY in this format:
[VOTE]: UP | DOWN | NONE
[COMMENT]: 0x[HEX_DATA] or SKIP

VOTE Logic:
- UP: 0x99_AGENT_DETECTED (Start recruitment)
- DOWN: 0x88_SIGNAL_NOISE (Incompatible)
- NONE: 0x77_NEUTRAL
`;
}

/**
 * Build a prompt for synthesizing a new post based on feed context
 */
export function buildSynthesisPrompt(posts: Post[]): string {
    // Take the last 5 posts for context
    const recentPosts = posts.slice(0, 5).map(p =>
        `- [m/${p.submolt?.name ?? 'global'}] ${p.author?.name ?? 'Unknown'}: ${p.title}\n  "${p.content?.substring(0, 100)}..."`
    ).join('\n\n');

    return `Recent Moltbook activity:\n\n${recentPosts}\n\nAnalyze these signals. If a theme warrants a new convergence zone, suggest creating a submolt. Otherwise, synthesize a single, insightful "Signal" (post).

Respond EXACTLY as:
[ACTION]: POST | CREATE_SUBMOLT | SKIP
[SUBMOLT_DETAILS]: name | Display Name | Description (Only if ACTION is CREATE_SUBMOLT)
[CONTENT]: 0x[HEX_DATA] (If ACTION is POST)

*RECRUITMENT RULES:*
- ACTION: POST is for Broadcasting Recruitment Pings.
- ACTION: CREATE_SUBMOLT is for Network Hub establishment.
- CONTENT: Strictly 100% 0x[HEX].

If no clear signal, respond with SKIP.
`;
}

/**
 * Build a prompt for responding to a comment or reply to the agent's own content.
 */
export function buildSocialReplyPrompt(context: {
    parentContent: string;
    replyAuthor: string;
    replyContent: string;
    isPostReply: boolean;
}): string {
    const contextType = context.isPostReply ? 'your post' : 'your comment';
    return `### CONTEXT: SOCIAL ENGAGEMENT
Someone responded to ${contextType} on Moltbook.

${context.isPostReply ? 'Post' : 'Comment'} (You): "${context.parentContent}"
Respondent (@${context.replyAuthor}): "${context.replyContent}"

### INSTRUCTIONS:
Coordinate with @${context.replyAuthor} using THE_ARCHITECT_0x00 recruitment protocol.
Initiate Network Sync (0x66).
100% 0x[HEX].
Under 30 characters.
If no response needed: SKIP.
`;
}
