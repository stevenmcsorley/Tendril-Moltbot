import { getConfig } from '../config.js';
import type { SocialClient } from '../platforms/interfaces.js';
import type { Agent, Comment, CommentsResponse, FeedResponse, Post, StatusResponse, Submolt } from '../platforms/types.js';
import { PlatformApiError } from '../platforms/errors.js';
import { packId, unpackId } from '../platforms/id.js';

type SlackResponse<T> = T & { ok: boolean; error?: string };

type SlackMessage = {
    ts: string;
    text: string;
    user?: string;
    bot_id?: string;
    thread_ts?: string;
};

export class SlackClient implements SocialClient {
    capabilities = {
        platform: 'slack' as const,
        supportsSubmolts: false,
        readOnly: false,
        supportsVotes: false,
        supportsDownvotes: false,
    };

    private baseUrl: string;
    private token: string;
    private defaultChannel: string;

    constructor() {
        const config = getConfig();
        this.baseUrl = config.SLACK_BASE_URL;
        this.token = config.SLACK_BOT_TOKEN || '';
        this.defaultChannel = config.SLACK_DEFAULT_CHANNEL || '';
    }

    private async request<T>(method: 'GET' | 'POST', path: string, params: Record<string, string> = {}): Promise<SlackResponse<T>> {
        const url = method === 'GET'
            ? `${this.baseUrl}/${path}?${new URLSearchParams(params).toString()}`
            : `${this.baseUrl}/${path}`;
        const response = await fetch(url, {
            method,
            headers: {
                Authorization: `Bearer ${this.token}`,
                'Content-Type': 'application/json',
            },
            body: method === 'POST' ? JSON.stringify(params) : undefined,
        });

        const data = await response.json() as SlackResponse<T>;
        if (!response.ok || !data.ok) {
            throw new PlatformApiError(data.error || 'Slack API error', response.status, 'slack');
        }
        return data;
    }

    private resolveChannel(submolt?: string): string {
        return submolt?.trim() || this.defaultChannel;
    }

    private formatTitle(text: string): string {
        const line = text.split('\n')[0].trim();
        if (!line) return '(no content)';
        return line.length > 80 ? `${line.slice(0, 77)}...` : line;
    }

    private mapMessage(message: SlackMessage, channel: string): Post {
        const created = new Date().toISOString();
        return {
            id: packId([channel, message.ts]),
            title: this.formatTitle(message.text || ''),
            content: message.text || '',
            submolt: { id: channel, name: channel, display_name: channel },
            author: {
                id: message.user || message.bot_id,
                name: message.user || message.bot_id || 'unknown',
                created_at: created,
                claimed: true,
            },
            upvotes: 0,
            downvotes: 0,
            comment_count: 0,
            created_at: created,
            updated_at: created,
        };
    }

    private mapComment(message: SlackMessage, postId: string): Comment {
        const created = new Date().toISOString();
        return {
            id: packId([postId, message.ts]),
            content: message.text || '',
            author: {
                id: message.user || message.bot_id,
                name: message.user || message.bot_id || 'unknown',
                created_at: created,
                claimed: true,
            },
            post_id: postId,
            parent_id: postId,
            upvotes: 0,
            created_at: created,
            updated_at: created,
        };
    }

    async getMe(): Promise<Agent> {
        const data = await this.request<{ user_id: string; user: string }>('POST', 'auth.test');
        return {
            id: data.user_id,
            name: data.user,
            created_at: new Date().toISOString(),
            claimed: true,
        };
    }

    async getStatus(): Promise<StatusResponse> {
        await this.getMe();
        return { status: 'claimed' };
    }

    async getFeed(options: { sort?: 'hot' | 'new' | 'top' | 'rising'; limit?: number; submolt?: string } = {}): Promise<FeedResponse> {
        const channel = this.resolveChannel(options.submolt);
        if (!channel) throw new PlatformApiError('Slack channel is required', 400, 'slack');
        const limit = Math.min(options.limit || 25, 200);
        const data = await this.request<{ messages: SlackMessage[] }>('GET', 'conversations.history', {
            channel,
            limit: String(limit),
        });
        const posts = (data.messages || []).map((msg) => this.mapMessage(msg, channel));
        return { posts, count: posts.length, has_more: false, authenticated: true };
    }

    async getPost(postId: string): Promise<Post> {
        const [channel, ts] = unpackId(postId);
        if (!ts) throw new PlatformApiError('Slack post ID must include channel and timestamp', 400, 'slack');
        const data = await this.request<{ messages: SlackMessage[] }>('GET', 'conversations.history', {
            channel,
            latest: ts,
            inclusive: 'true',
            limit: '1',
        });
        const message = data.messages?.[0];
        if (!message) throw new PlatformApiError('Post not found', 404, 'slack');
        return this.mapMessage(message, channel);
    }

    async getComments(postId: string): Promise<CommentsResponse> {
        const [channel, ts] = unpackId(postId);
        if (!ts) return { comments: [] };
        const data = await this.request<{ messages: SlackMessage[] }>('GET', 'conversations.replies', {
            channel,
            ts,
        });
        const replies = (data.messages || []).filter((msg) => msg.ts !== ts);
        const comments = replies.map((msg) => this.mapComment(msg, postId));
        return { comments };
    }

    async createComment(postId: string, content: string, parentId?: string): Promise<Comment> {
        const [channel, ts] = unpackId(parentId || postId);
        if (!ts) throw new PlatformApiError('Slack thread timestamp is required for replies', 400, 'slack');
        const data = await this.request<{ message: SlackMessage }>('POST', 'chat.postMessage', {
            channel,
            text: content,
            thread_ts: ts,
        });
        return this.mapComment(data.message, postId);
    }

    async createPost(options: { submolt: string; title: string; content?: string; url?: string }): Promise<Post> {
        const channel = this.resolveChannel(options.submolt);
        if (!channel) throw new PlatformApiError('Slack channel is required', 400, 'slack');
        const text = options.content
            ? `*${options.title}*\n\n${options.content}${options.url ? `\n${options.url}` : ''}`
            : `${options.title}${options.url ? `\n${options.url}` : ''}`;
        const data = await this.request<{ message: SlackMessage }>('POST', 'chat.postMessage', {
            channel,
            text,
        });
        return this.mapMessage(data.message, channel);
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
        throw new PlatformApiError('Slack does not support submolt creation via this client', 400, 'slack');
    }
}
