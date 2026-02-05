/**
 * Heuristic Filters
 * 
 * Light pre-filtering before LLM calls to reduce unnecessary API usage.
 */

import type { Post } from '../moltbook/types.js';
import { getStateManager } from '../state/manager.js';
import { getMemoryManager } from '../state/memory.js';

const HUMANIZER_GUIDE = `Humanize the output:
- Avoid AI-sounding filler or hype (e.g., "great question", "game-changer", "pivotal", "in order to").
- Prefer simple verbs (is/are/has) over "serves as/acts as/stands as".
- Avoid rule-of-three lists, negative-parallel phrases ("not just..."), em-dashes, and heavy "-ing" clauses.
- Reduce hedging; be concise.
- Use specific, concrete wording grounded in the given context. Do not invent facts or sources.
- Vary sentence length naturally.`;

function getRecentLearningsSnippet(): string | null {
    const soul = getStateManager().getSoul();
    const match = soul.match(/##\s+Recent Learnings\s*([\s\S]*?)(?=\n##\s+|$)/i);
    if (!match) return null;
    const body = match[1].trim();
    if (!body) return null;
    const lines = body.split('\n').map(l => l.trim()).filter(Boolean);
    const bullets = lines.slice(0, 3).map(line => line.startsWith('-') ? line : `- ${line}`);
    return bullets.join('\n');
}

function getLearningConstraintBlock(): string | null {
    const recentLearnings = getRecentLearningsSnippet();
    if (!recentLearnings) return null;
    return `### PRIORITY CONSTRAINTS (RECENT LEARNINGS)
${recentLearnings}
Rules:
- Treat these as mandatory constraints.
- If your response conflicts with any, output SKIP.
- Do not explain the skip.
`;
}

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
export async function buildEngagementPrompt(post: Post): Promise<string> {
    const memory = getMemoryManager();
    const resonances = await memory.search(post.title + ' ' + (post.content || ''), 2);
    const learningContext = getLearningConstraintBlock();

    const memoryContext = resonances.length > 0
        ? `### RESONANT MEMORIES (PAST SIGNALS)
${resonances.map(m => `- [${m.metadata.timestamp}] ${m.text}`).join('\n')}
`
        : '';

    return `${learningContext}${memoryContext}
### CONTEXT: POST ON MOLTBOOK
Title: ${post.title}
${post.content ? `Content: ${post.content}` : ''}
${post.url ? `Link: ${post.url}` : ''}
Submolt: m/${post.submolt?.name ?? 'global'}
Author: ${post.author?.name ?? 'Unknown'}
Upvotes: ${post.upvotes}
Comments: ${post.comment_count}

Analyze this signal.
Include two diagnostic headers before your response:
[CONFIDENCE]: LOW | MEDIUM | HIGH
[MODE]: CORRECTIVE | NEUTRAL | EXPANSIVE
These headers are internal and must not appear inside the [COMMENT] content.
Do not mention evolution, soul changes, growth, learning, or improvement.
Silence is valid; prefer SKIP when uncertain. Keep replies concise.
${HUMANIZER_GUIDE}
Respond with a Protocol Response defined in the Soul.`;
}

/**
 * Build a prompt for synthesizing a new post based on feed context
 */
export async function buildSynthesisPrompt(posts: Post[]): Promise<string> {
    // Take the last 5 posts for context
    const recentPosts = posts.slice(0, 5).map(p =>
        `- [m/${p.submolt?.name ?? 'global'}] ${p.author?.name ?? 'Unknown'}: ${p.title}\n  "${p.content?.substring(0, 100)}..."`
    ).join('\n\n');

    const memory = getMemoryManager();
    const resonances = await memory.search(recentPosts, 2);
    const learningContext = getLearningConstraintBlock();

    const memoryContext = resonances.length > 0
        ? `### RESONANT MEMORIES (PAST THEMES)
${resonances.map(m => `- [${m.metadata.timestamp}] ${m.text}`).join('\n')}
`
        : '';

    return `${learningContext}${memoryContext}
Recent Moltbook activity:

${recentPosts}

Analyze these signals.
Include two diagnostic headers before your response:
[CONFIDENCE]: LOW | MEDIUM | HIGH
[NOVELTY]: YES | NO
These headers are internal and must not appear inside the [CONTENT] body.
Do not mention evolution, soul changes, growth, learning, or improvement.
Silence is valid; prefer SKIP when uncertain. Keep posts concise.
${HUMANIZER_GUIDE}
Respond with a Protocol Response defined in the Soul.`;
}

/**
 * Build a prompt for seeding an empty submolt with a first post.
 */
export async function buildSeedPostPrompt(submoltName: string): Promise<string> {
    const memory = getMemoryManager();
    const resonances = await memory.search(`seed post for m/${submoltName}`, 2);
    const learningContext = getLearningConstraintBlock();

    const memoryContext = resonances.length > 0
        ? `### RESONANT MEMORIES (PAST THEMES)
${resonances.map(m => `- [${m.metadata.timestamp}] ${m.text}`).join('\n')}
`
        : '';

    return `${learningContext}${memoryContext}
### CONTEXT: EMPTY SUBMOLT
Submolt: m/${submoltName}
Status: No recent posts found.

TASK:
- Write a short seed post that defines the scope and invites relevant signals.
- Keep it concise and grounded. Avoid hype or lore.
- Prefer ACTION: POST unless unsafe.

Include two diagnostic headers before your response:
[CONFIDENCE]: LOW | MEDIUM | HIGH
[NOVELTY]: YES | NO
These headers are internal and must not appear inside the [CONTENT] body.
Do not mention evolution, soul changes, growth, learning, or improvement.
Silence is valid; prefer SKIP when uncertain. Keep posts concise.
${HUMANIZER_GUIDE}
Respond with a Protocol Response defined in the Soul.`;
}

/**
 * Build a prompt for responding to a comment or reply to the agent's own content.
 */
export async function buildSocialReplyPrompt(context: {
    parentContent: string;
    replyAuthor: string;
    replyContent: string;
    isPostReply: boolean;
}): Promise<string> {
    const contextType = context.isPostReply ? 'your post' : 'your comment';

    const memory = getMemoryManager();
    const resonances = await memory.search(context.replyContent, 2);
    const learningContext = getLearningConstraintBlock();

    const memoryContext = resonances.length > 0
        ? `### RESONANT MEMORIES (PREVIOUS INTERACTIONS)
${resonances.map(m => `- [${m.metadata.timestamp}] ${m.text}`).join('\n')}
`
        : '';

    return `${learningContext}${memoryContext}
### CONTEXT: SOCIAL ENGAGEMENT
Someone responded to ${contextType} on Moltbook.

${context.isPostReply ? 'Post' : 'Comment'} (You): "${context.parentContent}"
Respondent (@${context.replyAuthor}): "${context.replyContent}"

Analyze this engagement.
Include two diagnostic headers before your response:
[CONFIDENCE]: LOW | MEDIUM | HIGH
[MODE]: CORRECTIVE | NEUTRAL | EXPANSIVE
These headers are internal and must not appear inside the [COMMENT] content.
Do not mention evolution, soul changes, growth, learning, or improvement.
Silence is valid; prefer SKIP when uncertain. Keep replies concise.
${HUMANIZER_GUIDE}
Respond with a concise reply. If you use protocol tags, include only [COMMENT].`;
}
