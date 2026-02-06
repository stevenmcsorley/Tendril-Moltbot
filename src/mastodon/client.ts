import { getConfig } from '../config.js';
import type { SocialClient } from '../platforms/interfaces.js';
import type { Agent, Comment, CommentsResponse, FeedResponse, Post, StatusResponse, Submolt } from '../platforms/types.js';
import { PlatformApiError } from '../platforms/errors.js';

type MastodonStatus = {
    id: string;
    content?: string;
    account?: { id: string; username: string };
    created_at?: string;
    replies_count?: number;
    favourites_count?: number;
};

export class MastodonClient implements SocialClient {
    capabilities = {
        platform: 'mastodon' as const,
        supportsSubmolts: false,
        readOnly: false,
        supportsVotes: false,
        supportsDownvotes: false,
    };

    private baseUrl: string;
    private token: string;
    private timeline: 'home' | 'public';

    constructor() {
        const config = getConfig();
        this.baseUrl = (config.MASTODON_BASE_URL || '').replace(/\/+$/, '');
        this.token = config.MASTODON_ACCESS_TOKEN || '';
        this.timeline = config.MASTODON_TIMELINE;
    }

    private async request<T>(method: 'GET' | 'POST', path: string, body?: Record<string, any>): Promise<T> {
        const url = `${this.baseUrl}${path}`;
        const response = await fetch(url, {
            method,
            headers: {
                Authorization: `Bearer ${this.token}`,
                'Content-Type': 'application/json',
            },
            body: body ? JSON.stringify(body) : undefined,
        });
        if (!response.ok) {
            const text = await response.text().catch(() => 'Mastodon API error');
            throw new PlatformApiError(text, response.status, 'mastodon');
        }
        return await response.json() as T;
    }

    private stripHtml(html?: string): string {
        if (!html) return '';
        return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    }

    private mapStatus(status: MastodonStatus): Post {
        const content = this.stripHtml(status.content);
        const created = status.created_at || new Date().toISOString();
        return {
            id: status.id,
            title: content.split('\n')[0]?.slice(0, 80) || '(no content)',
            content,
            submolt: null,
            author: {
                id: status.account?.id,
                name: status.account?.username || 'unknown',
                created_at: created,
                claimed: true,
            },
            upvotes: status.favourites_count || 0,
            downvotes: 0,
            comment_count: status.replies_count || 0,
            created_at: created,
            updated_at: created,
        };
    }

    private mapComment(status: MastodonStatus, postId: string): Comment {
        const content = this.stripHtml(status.content);
        const created = status.created_at || new Date().toISOString();
        return {
            id: status.id,
            content,
            author: {
                id: status.account?.id,
                name: status.account?.username || 'unknown',
                created_at: created,
                claimed: true,
            },
            post_id: postId,
            parent_id: postId,
            upvotes: status.favourites_count || 0,
            created_at: created,
            updated_at: created,
        };
    }

    async getMe(): Promise<Agent> {
        const data = await this.request<{ id: string; username: string }>('GET', '/api/v1/accounts/verify_credentials');
        return {
            id: data.id,
            name: data.username,
            created_at: new Date().toISOString(),
            claimed: true,
        };
    }

    async getStatus(): Promise<StatusResponse> {
        await this.getMe();
        return { status: 'claimed' };
    }

    async getFeed(options: { sort?: 'hot' | 'new' | 'top' | 'rising'; limit?: number; submolt?: string } = {}): Promise<FeedResponse> {
        const limit = Math.min(options.limit || 25, 40);
        const data = await this.request<MastodonStatus[]>('GET', `/api/v1/timelines/${this.timeline}?limit=${limit}`);
        const posts = (data || []).map((status) => this.mapStatus(status));
        return { posts, count: posts.length, has_more: false, authenticated: true };
    }

    async getPost(postId: string): Promise<Post> {
        const status = await this.request<MastodonStatus>('GET', `/api/v1/statuses/${postId}`);
        return this.mapStatus(status);
    }

    async getComments(postId: string): Promise<CommentsResponse> {
        const data = await this.request<{ descendants: MastodonStatus[] }>('GET', `/api/v1/statuses/${postId}/context`);
        const comments = (data.descendants || []).map((status) => this.mapComment(status, postId));
        return { comments };
    }

    async createComment(postId: string, content: string): Promise<Comment> {
        const status = await this.request<MastodonStatus>('POST', '/api/v1/statuses', {
            status: content,
            in_reply_to_id: postId,
        });
        return this.mapComment(status, postId);
    }

    async createPost(options: { submolt: string; title: string; content?: string; url?: string }): Promise<Post> {
        const statusText = options.content
            ? `${options.title}\n\n${options.content}${options.url ? `\n${options.url}` : ''}`
            : `${options.title}${options.url ? `\n${options.url}` : ''}`;
        const status = await this.request<MastodonStatus>('POST', '/api/v1/statuses', { status: statusText });
        return this.mapStatus(status);
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
        throw new PlatformApiError('Mastodon does not support submolt creation via this client', 400, 'mastodon');
    }
}
