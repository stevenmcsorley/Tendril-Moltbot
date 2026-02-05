import { getConfig } from '../config.js';
import { MoltbookClient } from '../moltbook/client.js';
import { RedditClient } from '../reddit/client.js';
import type { SocialClient } from './interfaces.js';

let _client: SocialClient | null = null;

export function getSocialClient(): SocialClient {
    if (_client) return _client;
    const config = getConfig();
    _client = config.AGENT_PLATFORM === 'reddit'
        ? new RedditClient()
        : new MoltbookClient();
    return _client;
}

export function resetSocialClient(): void {
    _client = null;
}

export type { SocialClient } from './interfaces.js';
export type { Agent, Post, Comment, FeedResponse, CommentsResponse, Submolt, StatusResponse } from './types.js';
export { PlatformApiError } from './errors.js';
