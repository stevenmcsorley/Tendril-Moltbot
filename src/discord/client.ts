import { getConfig } from '../config.js';
import type { SocialClient } from '../platforms/interfaces.js';
import type { Agent, Comment, CommentsResponse, FeedResponse, Post, StatusResponse, Submolt } from '../platforms/types.js';
import { PlatformApiError } from '../platforms/errors.js';
import { packId, unpackId } from '../platforms/id.js';

type DiscordMessage = {
    id: string;
    content: string;
    timestamp: string;
    edited_timestamp?: string | null;
    author?: { id: string; username: string; bot?: boolean };
    message_reference?: { message_id?: string };
    thread?: { id: string };
};

type DiscordChannel = { id: string; name?: string; type?: number };

export class DiscordClient implements SocialClient {
    capabilities = {
        platform: 'discord' as const,
        supportsSubmolts: false,
        readOnly: false,
        supportsVotes: false,
        supportsDownvotes: false,
    };

    private baseUrl: string;
    private token: string;
    private defaultChannelId: string;
    private channelCache = new Map<string, DiscordChannel>();

    constructor() {
        const config = getConfig();
        this.baseUrl = config.DISCORD_BASE_URL;
        this.token = config.DISCORD_BOT_TOKEN || '';
        this.defaultChannelId = config.DISCORD_DEFAULT_CHANNEL_ID || '';
    }

    private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
        const url = `${this.baseUrl}${path}`;
        const response = await fetch(url, {
            method,
            headers: {
                Authorization: `Bot ${this.token}`,
                'Content-Type': 'application/json',
            },
            body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
            const text = await response.text().catch(() => 'Discord API error');
            throw new PlatformApiError(text, response.status, 'discord');
        }

        if (response.status === 204) {
            return undefined as T;
        }

        return await response.json() as T;
    }

    private resolveChannelId(submolt?: string): string {
        return submolt?.trim() || this.defaultChannelId;
    }

    private async getChannel(channelId: string): Promise<DiscordChannel> {
        if (this.channelCache.has(channelId)) {
            return this.channelCache.get(channelId)!;
        }
        const channel = await this.request<DiscordChannel>('GET', `/channels/${channelId}`);
        this.channelCache.set(channelId, channel);
        return channel;
    }

    private formatTitle(content: string): string {
        const firstLine = content.split('\n')[0].trim();
        if (!firstLine) return '(no content)';
        return firstLine.length > 80 ? `${firstLine.slice(0, 77)}...` : firstLine;
    }

    private mapMessage(message: DiscordMessage, channelId: string, channelName?: string): Post {
        const created = message.timestamp || new Date().toISOString();
        const updated = message.edited_timestamp || created;
        return {
            id: packId([channelId, message.id]),
            title: this.formatTitle(message.content || ''),
            content: message.content || '',
            submolt: {
                id: channelId,
                name: channelName || channelId,
                display_name: channelName || channelId,
            },
            author: {
                id: message.author?.id,
                name: message.author?.username || 'unknown',
                created_at: created,
                claimed: true,
            },
            upvotes: 0,
            downvotes: 0,
            comment_count: 0,
            created_at: created,
            updated_at: updated,
        };
    }

    private mapComment(message: DiscordMessage, postId: string, parentId?: string): Comment {
        const created = message.timestamp || new Date().toISOString();
        return {
            id: packId([postId, message.id]),
            content: message.content || '',
            author: {
                id: message.author?.id,
                name: message.author?.username || 'unknown',
                created_at: created,
                claimed: true,
            },
            post_id: postId,
            parent_id: parentId,
            upvotes: 0,
            created_at: created,
            updated_at: message.edited_timestamp || created,
        };
    }

    async getMe(): Promise<Agent> {
        const me = await this.request<{ id: string; username: string }>('GET', '/users/@me');
        return {
            id: me.id,
            name: me.username,
            created_at: new Date().toISOString(),
            claimed: true,
        };
    }

    async getStatus(): Promise<StatusResponse> {
        await this.getMe();
        return { status: 'claimed' };
    }

    async getFeed(options: { sort?: 'hot' | 'new' | 'top' | 'rising'; limit?: number; submolt?: string } = {}): Promise<FeedResponse> {
        const channelId = this.resolveChannelId(options.submolt);
        if (!channelId) {
            throw new PlatformApiError('Discord channel ID is required', 400, 'discord');
        }
        const limit = Math.min(options.limit || 25, 100);
        const messages = await this.request<DiscordMessage[]>('GET', `/channels/${channelId}/messages?limit=${limit}`);
        const channel = await this.getChannel(channelId);
        const posts = messages.map((msg) => this.mapMessage(msg, channelId, channel.name));
        return {
            posts,
            count: posts.length,
            has_more: false,
            authenticated: true,
        };
    }

    async getPost(postId: string): Promise<Post> {
        const [channelId, messageId] = unpackId(postId);
        if (!messageId) {
            throw new PlatformApiError('Discord post ID must include channel and message IDs', 400, 'discord');
        }
        const message = await this.request<DiscordMessage>('GET', `/channels/${channelId}/messages/${messageId}`);
        const channel = await this.getChannel(channelId);
        return this.mapMessage(message, channelId, channel.name);
    }

    async getComments(postId: string): Promise<CommentsResponse> {
        const [channelId, messageId] = unpackId(postId);
        if (!messageId) {
            return { comments: [] };
        }
        const messages = await this.request<DiscordMessage[]>('GET', `/channels/${channelId}/messages?limit=100`);
        const replies = messages.filter((msg) => msg.message_reference?.message_id === messageId);
        const comments = replies.map((msg) => this.mapComment(msg, postId, postId));
        return { comments };
    }

    async createComment(postId: string, content: string, parentId?: string): Promise<Comment> {
        const [channelId, messageId] = unpackId(parentId || postId);
        if (!messageId) {
            throw new PlatformApiError('Discord parent message ID is required for replies', 400, 'discord');
        }
        const response = await this.request<DiscordMessage>('POST', `/channels/${channelId}/messages`, {
            content,
            message_reference: {
                message_id: messageId,
                channel_id: channelId,
            },
        });
        return this.mapComment(response, packId([channelId, messageId]), packId([channelId, messageId]));
    }

    async createPost(options: { submolt: string; title: string; content?: string; url?: string }): Promise<Post> {
        const channelId = this.resolveChannelId(options.submolt);
        if (!channelId) {
            throw new PlatformApiError('Discord channel ID is required to post', 400, 'discord');
        }
        const content = options.content
            ? `**${options.title}**\n\n${options.content}${options.url ? `\n${options.url}` : ''}`
            : `${options.title}${options.url ? `\n${options.url}` : ''}`;
        const response = await this.request<DiscordMessage>('POST', `/channels/${channelId}/messages`, { content });
        const channel = await this.getChannel(channelId);
        return this.mapMessage(response, channelId, channel.name);
    }

    async upvotePost(_postId: string): Promise<void> {
        return;
    }

    async downvotePost(_postId: string): Promise<void> {
        return;
    }

    async upvoteComment(_commentId: string): Promise<void> {
        return;
    }

    async createSubmolt(_options: { name: string; display_name: string; description: string }): Promise<Submolt> {
        throw new PlatformApiError('Discord does not support submolt creation via this client', 400, 'discord');
    }
}
