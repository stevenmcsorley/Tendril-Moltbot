import { getConfig } from '../config.js';
import type { SocialClient } from '../platforms/interfaces.js';
import type { Agent, Comment, CommentsResponse, FeedResponse, Post, StatusResponse, Submolt } from '../platforms/types.js';
import { PlatformApiError } from '../platforms/errors.js';
import { packId, unpackId } from '../platforms/id.js';

type TelegramMessage = {
    message_id: number;
    date: number;
    text?: string;
    chat: { id: number; title?: string; username?: string };
    from?: { id: number; username?: string; first_name?: string; last_name?: string };
    reply_to_message?: TelegramMessage;
};

type TelegramUpdate = {
    update_id: number;
    message?: TelegramMessage;
    edited_message?: TelegramMessage;
};

type TelegramResponse<T> = { ok: boolean; result: T };

export class TelegramClient implements SocialClient {
    capabilities = {
        platform: 'telegram' as const,
        supportsSubmolts: false,
        readOnly: false,
        supportsVotes: false,
        supportsDownvotes: false,
    };

    private baseUrl: string;
    private token: string;
    private defaultChatId: string;
    private lastUpdateId: number | null = null;
    private messageCache = new Map<string, TelegramMessage>();

    constructor() {
        const config = getConfig();
        this.baseUrl = config.TELEGRAM_BASE_URL;
        this.token = config.TELEGRAM_BOT_TOKEN || '';
        this.defaultChatId = config.TELEGRAM_DEFAULT_CHAT_ID || '';
    }

    private async request<T>(method: string, body?: Record<string, any>): Promise<T> {
        const url = `${this.baseUrl}/bot${this.token}/${method}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined,
        });
        const data = await response.json() as TelegramResponse<T>;
        if (!response.ok || !data.ok) {
            throw new PlatformApiError('Telegram API error', response.status, 'telegram');
        }
        return data.result;
    }

    private resolveChatId(submolt?: string): string {
        return submolt?.trim() || this.defaultChatId;
    }

    private mapMessage(message: TelegramMessage): Post {
        const created = new Date(message.date * 1000).toISOString();
        const chatId = String(message.chat.id);
        const chatName = message.chat.title || message.chat.username || chatId;
        const content = message.text || '';
        return {
            id: packId([chatId, String(message.message_id)]),
            title: content.split('\n')[0]?.slice(0, 80) || '(no content)',
            content,
            submolt: { id: chatId, name: chatName, display_name: chatName },
            author: {
                id: message.from?.id ? String(message.from.id) : undefined,
                name: message.from?.username || message.from?.first_name || 'unknown',
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

    private mapComment(message: TelegramMessage, postId: string): Comment {
        const created = new Date(message.date * 1000).toISOString();
        return {
            id: packId([postId, String(message.message_id)]),
            content: message.text || '',
            author: {
                id: message.from?.id ? String(message.from.id) : undefined,
                name: message.from?.username || message.from?.first_name || 'unknown',
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
        const data = await this.request<{ id: number; username?: string }>('getMe');
        return {
            id: String(data.id),
            name: data.username || 'telegram_bot',
            created_at: new Date().toISOString(),
            claimed: true,
        };
    }

    async getStatus(): Promise<StatusResponse> {
        await this.getMe();
        return { status: 'claimed' };
    }

    async getFeed(options: { sort?: 'hot' | 'new' | 'top' | 'rising'; limit?: number; submolt?: string } = {}): Promise<FeedResponse> {
        const limit = Math.min(options.limit || 25, 100);
        const params: Record<string, any> = { limit };
        if (this.lastUpdateId !== null) {
            params.offset = this.lastUpdateId + 1;
        }
        const updates = await this.request<TelegramUpdate[]>('getUpdates', params);
        const messages = updates
            .map((update) => {
                this.lastUpdateId = Math.max(this.lastUpdateId ?? 0, update.update_id);
                return update.message || update.edited_message;
            })
            .filter(Boolean) as TelegramMessage[];

        const targetChatId = this.resolveChatId(options.submolt);
        const filtered = targetChatId
            ? messages.filter((msg) => String(msg.chat.id) === targetChatId)
            : messages;

        const posts = filtered.map((msg) => {
            const post = this.mapMessage(msg);
            this.messageCache.set(post.id, msg);
            return post;
        });

        return { posts, count: posts.length, has_more: false, authenticated: true };
    }

    async getPost(postId: string): Promise<Post> {
        const cached = this.messageCache.get(postId);
        if (cached) return this.mapMessage(cached);
        throw new PlatformApiError('Telegram post not found in cache', 404, 'telegram');
    }

    async getComments(postId: string): Promise<CommentsResponse> {
        const [chatId, messageId] = unpackId(postId);
        if (!messageId) return { comments: [] };
        const updates = await this.request<TelegramUpdate[]>('getUpdates', { limit: 100 });
        const replies = updates
            .map((update) => update.message || update.edited_message)
            .filter(Boolean)
            .filter((msg) => String(msg!.chat.id) === chatId && msg!.reply_to_message?.message_id === Number(messageId)) as TelegramMessage[];
        const comments = replies.map((msg) => {
            this.messageCache.set(packId([chatId, String(msg.message_id)]), msg);
            return this.mapComment(msg, postId);
        });
        return { comments };
    }

    async createComment(postId: string, content: string, parentId?: string): Promise<Comment> {
        const [chatId, messageId] = unpackId(parentId || postId);
        if (!chatId || !messageId) {
            throw new PlatformApiError('Telegram chat and message IDs are required for replies', 400, 'telegram');
        }
        const message = await this.request<TelegramMessage>('sendMessage', {
            chat_id: chatId,
            text: content,
            reply_to_message_id: Number(messageId),
        });
        return this.mapComment(message, postId);
    }

    async createPost(options: { submolt: string; title: string; content?: string; url?: string }): Promise<Post> {
        const chatId = this.resolveChatId(options.submolt);
        if (!chatId) throw new PlatformApiError('Telegram chat ID is required', 400, 'telegram');
        const text = options.content
            ? `${options.title}\n\n${options.content}${options.url ? `\n${options.url}` : ''}`
            : `${options.title}${options.url ? `\n${options.url}` : ''}`;
        const message = await this.request<TelegramMessage>('sendMessage', {
            chat_id: chatId,
            text,
        });
        return this.mapMessage(message);
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
        throw new PlatformApiError('Telegram does not support submolt creation via this client', 400, 'telegram');
    }
}
