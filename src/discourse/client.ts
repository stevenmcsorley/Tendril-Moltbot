import { getConfig } from '../config.js';
import type { SocialClient } from '../platforms/interfaces.js';
import type { Agent, Comment, CommentsResponse, FeedResponse, Post, StatusResponse, Submolt } from '../platforms/types.js';
import { PlatformApiError } from '../platforms/errors.js';

type DiscourseTopic = {
    id: number;
    title: string;
    posts_count?: number;
    created_at?: string;
    last_posted_at?: string;
    slug?: string;
    author?: string;
};

export class DiscourseClient implements SocialClient {
    capabilities = {
        platform: 'discourse' as const,
        supportsSubmolts: false,
        readOnly: false,
        supportsVotes: false,
        supportsDownvotes: false,
    };

    private baseUrl: string;
    private apiKey: string;
    private apiUsername: string;
    private defaultCategory?: string;

    constructor() {
        const config = getConfig();
        this.baseUrl = (config.DISCOURSE_BASE_URL || '').replace(/\/+$/, '');
        this.apiKey = config.DISCOURSE_API_KEY || '';
        this.apiUsername = config.DISCOURSE_API_USERNAME || '';
        this.defaultCategory = config.DISCOURSE_DEFAULT_CATEGORY;
    }

    private async request<T>(method: 'GET' | 'POST', path: string, body?: Record<string, any>): Promise<T> {
        const url = `${this.baseUrl}${path}`;
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Api-Key': this.apiKey,
                'Api-Username': this.apiUsername,
            },
            body: body ? JSON.stringify(body) : undefined,
        });
        if (!response.ok) {
            const text = await response.text().catch(() => 'Discourse API error');
            throw new PlatformApiError(text, response.status, 'discourse');
        }
        return await response.json() as T;
    }

    private stripHtml(html?: string): string {
        if (!html) return '';
        return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    }

    private mapTopic(topic: DiscourseTopic): Post {
        const created = topic.created_at || new Date().toISOString();
        return {
            id: String(topic.id),
            title: topic.title,
            content: '',
            submolt: this.defaultCategory ? { name: this.defaultCategory } : null,
            author: { name: topic.author || 'unknown', created_at: created, claimed: true },
            upvotes: 0,
            downvotes: 0,
            comment_count: topic.posts_count ? Math.max(0, topic.posts_count - 1) : 0,
            created_at: created,
            updated_at: topic.last_posted_at || created,
        };
    }

    async getMe(): Promise<Agent> {
        const data = await this.request<{ user: { id: number; username: string } }>('GET', `/users/${this.apiUsername}.json`);
        return {
            id: String(data.user.id),
            name: data.user.username,
            created_at: new Date().toISOString(),
            claimed: true,
        };
    }

    async getStatus(): Promise<StatusResponse> {
        await this.getMe();
        return { status: 'claimed' };
    }

    async getFeed(_options: { sort?: 'hot' | 'new' | 'top' | 'rising'; limit?: number; submolt?: string } = {}): Promise<FeedResponse> {
        const category = this.defaultCategory;
        const path = category ? `/c/${category}.json` : '/latest.json';
        const data = await this.request<{ topic_list: { topics: DiscourseTopic[] } }>('GET', path);
        const topics = data.topic_list?.topics || [];
        const posts = topics.map((topic) => this.mapTopic(topic));
        return { posts, count: posts.length, has_more: false, authenticated: true };
    }

    async getPost(postId: string): Promise<Post> {
        const data = await this.request<any>('GET', `/t/${postId}.json`);
        const topic = data as { id: number; title: string; created_at?: string; posts_count?: number; slug?: string; details?: { created_by?: { username?: string } } };
        return {
            id: String(topic.id),
            title: topic.title,
            content: '',
            submolt: this.defaultCategory ? { name: this.defaultCategory } : null,
            author: { name: topic.details?.created_by?.username || 'unknown' },
            upvotes: 0,
            downvotes: 0,
            comment_count: topic.posts_count ? Math.max(0, topic.posts_count - 1) : 0,
            created_at: topic.created_at || new Date().toISOString(),
            updated_at: topic.created_at || new Date().toISOString(),
        };
    }

    async getComments(postId: string): Promise<CommentsResponse> {
        const data = await this.request<any>('GET', `/t/${postId}.json`);
        const posts = data?.post_stream?.posts || [];
        const comments = posts.slice(1).map((post: any) => ({
            id: String(post.id),
            content: this.stripHtml(post.cooked || post.raw || ''),
            author: { name: post.username || 'unknown' },
            post_id: postId,
            parent_id: postId,
            upvotes: post.like_count || 0,
            created_at: post.created_at || new Date().toISOString(),
            updated_at: post.updated_at || post.created_at || new Date().toISOString(),
        })) as Comment[];
        return { comments };
    }

    async createComment(postId: string, content: string): Promise<Comment> {
        const data = await this.request<any>('POST', '/posts.json', {
            topic_id: Number(postId),
            raw: content,
        });
        return {
            id: String(data.id),
            content,
            author: { name: data.username || this.apiUsername },
            post_id: postId,
            parent_id: postId,
            upvotes: 0,
            created_at: data.created_at || new Date().toISOString(),
            updated_at: data.created_at || new Date().toISOString(),
        };
    }

    async createPost(options: { submolt: string; title: string; content?: string; url?: string }): Promise<Post> {
        const raw = options.content
            ? `${options.content}${options.url ? `\n${options.url}` : ''}`
            : options.url || '';
        const data = await this.request<any>('POST', '/posts.json', {
            title: options.title,
            raw,
            category: this.defaultCategory,
        });
        return {
            id: String(data.topic_id),
            title: options.title,
            content: raw,
            submolt: this.defaultCategory ? { name: this.defaultCategory } : null,
            author: { name: data.username || this.apiUsername },
            upvotes: 0,
            downvotes: 0,
            comment_count: 0,
            created_at: data.created_at || new Date().toISOString(),
            updated_at: data.created_at || new Date().toISOString(),
        };
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
        throw new PlatformApiError('Discourse does not support submolt creation via this client', 400, 'discourse');
    }
}
