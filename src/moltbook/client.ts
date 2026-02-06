/**
 * Moltbook API Client
 * 
 * CRITICAL: This client ONLY communicates with https://www.moltbook.com
 * The API key is NEVER sent anywhere else.
 */

import { getConfig } from '../config.js';
import type {
    Post,
    Comment,
    FeedResponse,
    CommentsResponse,
    Agent,
    Submolt,
    StatusResponse,
} from '../platforms/types.js';
import type { SocialClient } from '../platforms/interfaces.js';
import { PlatformApiError } from '../platforms/errors.js';

interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    hint?: string;
}

interface RateLimitError {
    success: false;
    error: string;
    retry_after_minutes?: number;
    retry_after_seconds?: number;
    daily_remaining?: number;
}

export class MoltbookApiError extends PlatformApiError {
    constructor(
        message: string,
        statusCode: number,
        hint?: string,
        retryAfterMinutes?: number,
        retryAfterSeconds?: number,
        dailyRemaining?: number
    ) {
        super(message, statusCode, 'moltbook', hint, retryAfterMinutes, retryAfterSeconds, dailyRemaining);
        this.name = 'MoltbookApiError';
    }
}

export class MoltbookClient implements SocialClient {
    private baseUrl: string;
    private apiKey: string;
    capabilities = {
        platform: 'moltbook' as const,
        supportsSubmolts: true,
        readOnly: false,
        supportsVotes: true,
        supportsDownvotes: true
    };

    constructor() {
        const config = getConfig();
        this.baseUrl = config.MOLTBOOK_BASE_URL;
        this.apiKey = config.MOLTBOOK_API_KEY ?? '';
        if (!this.apiKey) {
            throw new Error('MOLTBOOK_API_KEY is required for Moltbook client');
        }

        // Security: Validate URL is correct domain
        if (!this.baseUrl.startsWith('https://www.moltbook.com')) {
            throw new Error('SECURITY: Moltbook client must only use https://www.moltbook.com');
        }
    }

    private async request<T>(
        method: 'GET' | 'POST' | 'DELETE',
        path: string,
        body?: unknown
    ): Promise<T> {
        const url = `${this.baseUrl}${path}`;

        // Double-check URL before sending API key
        if (!url.startsWith('https://www.moltbook.com')) {
            throw new Error(`SECURITY: Refusing to send API key to ${url}`);
        }

        const headers: Record<string, string> = {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
        };

        const response = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });

        const data = (await response.json()) as ApiResponse<T> | RateLimitError;

        if (!response.ok) {
            if (response.status === 429) {
                const rateLimitData = data as RateLimitError;
                throw new MoltbookApiError(
                    rateLimitData.error || 'Rate limited',
                    429,
                    undefined,
                    rateLimitData.retry_after_minutes,
                    rateLimitData.retry_after_seconds,
                    rateLimitData.daily_remaining
                );
            }

            const errorData = data as ApiResponse<T>;
            throw new MoltbookApiError(
                errorData.error || 'API request failed',
                response.status,
                errorData.hint
            );
        }

        const successData = data as any; // Cast to any to check flexible keys
        if (!successData.success) {
            throw new MoltbookApiError(
                successData.error || 'Request failed',
                response.status,
                successData.hint
            );
        }

        // Return nested data if found, prioritized by likely keys
        if (successData.data !== undefined) return successData.data as T;
        if (successData.agent !== undefined) return successData.agent as T;
        if (successData.post !== undefined) return successData.post as T;
        if (successData.comment !== undefined) return successData.comment as T;
        if (successData.submolt !== undefined) return successData.submolt as T;
        if (successData.posts !== undefined) return successData as unknown as T; // for FeedResponse
        if (successData.comments !== undefined) return successData as unknown as T; // for CommentsResponse

        return successData as unknown as T;
    }

    /**
     * Get current agent info
     */
    async getMe(): Promise<Agent> {
        return this.request<Agent>('GET', '/agents/me');
    }

    /**
     * Check claim status
     */
    async getStatus(): Promise<StatusResponse> {
        return this.request<StatusResponse>('GET', '/agents/status');
    }

    /**
     * Get feed (personalized or global)
     */
    async getFeed(options: {
        sort?: 'hot' | 'new' | 'top' | 'rising';
        limit?: number;
        submolt?: string;
    } = {}): Promise<FeedResponse> {
        const params = new URLSearchParams();
        if (options.sort) params.set('sort', options.sort);
        if (options.limit) params.set('limit', String(options.limit));
        if (options.submolt) params.set('submolt', options.submolt);

        const query = params.toString();
        const path = query ? `/posts?${query}` : '/posts';
        return this.request<FeedResponse>('GET', path);
    }

    /**
     * Get a single post by ID
     */
    async getPost(postId: string): Promise<Post> {
        return this.request<Post>('GET', `/posts/${postId}`);
    }

    /**
     * Get comments on a post
     */
    async getComments(
        postId: string,
        options: { sort?: 'top' | 'new' | 'controversial' } = {}
    ): Promise<CommentsResponse> {
        const params = new URLSearchParams();
        if (options.sort) params.set('sort', options.sort);

        const query = params.toString();
        const path = query
            ? `/posts/${postId}/comments?${query}`
            : `/posts/${postId}/comments`;
        return this.request<CommentsResponse>('GET', path);
    }

    /**
     * Create a comment on a post
     */
    async createComment(
        postId: string,
        content: string,
        parentId?: string
    ): Promise<Comment> {
        const body: { content: string; parent_id?: string } = { content };
        if (parentId) body.parent_id = parentId;
        return this.request<Comment>('POST', `/posts/${postId}/comments`, body);
    }

    /**
     * Upvote a post
     */
    async upvotePost(postId: string): Promise<void> {
        await this.request<void>('POST', `/posts/${postId}/upvote`);
    }

    /**
     * Downvote a post
     */
    async downvotePost(postId: string): Promise<void> {
        await this.request<void>('POST', `/posts/${postId}/downvote`);
    }

    /**
     * Upvote a comment
     */
    async upvoteComment(commentId: string): Promise<void> {
        await this.request<void>('POST', `/comments/${commentId}/upvote`);
    }

    /**
     * Create a submolt
     */
    async createSubmolt(options: {
        name: string;
        display_name: string;
        description: string;
    }): Promise<Submolt> {
        return this.request<Submolt>('POST', '/submolts', options);
    }

    /**
     * Create a post
     */
    async createPost(options: {
        submolt: string;
        title: string;
        content?: string;
        url?: string;
    }): Promise<Post> {
        return this.request<Post>('POST', '/posts', options);
    }
}

// Singleton instance
let _client: MoltbookClient | null = null;

export function getMoltbookClient(): MoltbookClient {
    if (!_client) {
        _client = new MoltbookClient();
    }
    return _client;
}

export function resetMoltbookClient(): void {
    _client = null;
}
