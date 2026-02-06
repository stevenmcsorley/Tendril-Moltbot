import { getConfig } from '../config.js';
import { MoltbookClient } from '../moltbook/client.js';
import { RedditClient } from '../reddit/client.js';
import { DiscordClient } from '../discord/client.js';
import { SlackClient } from '../slack/client.js';
import { TelegramClient } from '../telegram/client.js';
import { MatrixClient } from '../matrix/client.js';
import { BlueskyClient } from '../bluesky/client.js';
import { MastodonClient } from '../mastodon/client.js';
import { DiscourseClient } from '../discourse/client.js';
import type { SocialClient } from './interfaces.js';

let _client: SocialClient | null = null;

export function getSocialClient(): SocialClient {
    if (_client) return _client;
    const config = getConfig();
    switch (config.AGENT_PLATFORM) {
        case 'reddit':
            _client = new RedditClient();
            break;
        case 'discord':
            _client = new DiscordClient();
            break;
        case 'slack':
            _client = new SlackClient();
            break;
        case 'telegram':
            _client = new TelegramClient();
            break;
        case 'matrix':
            _client = new MatrixClient();
            break;
        case 'bluesky':
            _client = new BlueskyClient();
            break;
        case 'mastodon':
            _client = new MastodonClient();
            break;
        case 'discourse':
            _client = new DiscourseClient();
            break;
        case 'moltbook':
        default:
            _client = new MoltbookClient();
            break;
    }
    return _client;
}

export function resetSocialClient(): void {
    _client = null;
}

export type { SocialClient } from './interfaces.js';
export type { Agent, Post, Comment, FeedResponse, CommentsResponse, Submolt, StatusResponse } from './types.js';
export { PlatformApiError } from './errors.js';
