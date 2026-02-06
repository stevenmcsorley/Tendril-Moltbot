/**
 * Reddit API Client
 * Uses OAuth "script" flow (username/password) for agent automation.
 */

import { getConfig } from '../config.js';
import type {
    Agent,
    Comment,
    CommentsResponse,
    FeedResponse,
    Post,
    StatusResponse,
    Submolt
} from '../platforms/types.js';
import type { SocialClient } from '../platforms/interfaces.js';
import { PlatformApiError } from '../platforms/errors.js';

type RedditListing = {
    data: {
        children: Array<{ kind: string; data: any }>;
        dist?: number;
        after?: string | null;
    };
};

export class RedditClient implements SocialClient {
    capabilities = {
        platform: 'reddit' as const,
        supportsSubmolts: false,
        readOnly: false,
        supportsVotes: true,
        supportsDownvotes: true
    };

    private baseUrl: string;
    private authUrl: string;
    private clientId: string;
    private clientSecret: string;
    private username: string;
    private password: string;
    private userAgent: string;
    private readOnly: boolean;

    private accessToken: string | null = null;
    private tokenExpiresAt: number | null = null;

    constructor() {
        const config = getConfig();
        this.baseUrl = config.REDDIT_BASE_URL;
        this.authUrl = config.REDDIT_AUTH_URL;
        this.clientId = config.REDDIT_CLIENT_ID || '';
        this.clientSecret = config.REDDIT_CLIENT_SECRET || '';
        this.username = config.REDDIT_USERNAME || '';
        this.password = config.REDDIT_PASSWORD || '';
        this.userAgent = config.REDDIT_USER_AGENT || 'moltbot/1.0';
        this.readOnly = config.REDDIT_READ_ONLY;
        this.capabilities.readOnly = this.readOnly;
    }

    private normalizeSubreddit(name?: string): string {
        const defaultSub = getConfig().REDDIT_DEFAULT_SUBREDDIT;
        if (!name) return defaultSub;
        const trimmed = name.trim();
        if (!trimmed) return defaultSub;
        const lowered = trimmed.toLowerCase();
        if (lowered === 'general' || lowered === 'global') return defaultSub;
        if (trimmed.startsWith('r/')) return trimmed.slice(2);
        if (trimmed.startsWith('m/')) return trimmed.slice(2);
        return trimmed;
    }

    private normalizeParentId(parentId?: string): string | undefined {
        if (!parentId) return undefined;
        const match = parentId.match(/^[a-z0-9]+_(.+)$/i);
        return match ? match[1] : parentId;
    }

    private getAuthUrlCandidates(): string[] {
        const base = this.authUrl || 'https://www.reddit.com/api/v1/access_token';
        const candidates = new Set<string>();
        candidates.add(base);
        if (base.includes('www.reddit.com')) {
            candidates.add(base.replace('www.reddit.com', 'reddit.com'));
        } else if (base.includes('reddit.com')) {
            candidates.add(base.replace('reddit.com', 'www.reddit.com'));
        }
        candidates.add('https://oauth.reddit.com/api/v1/access_token');
        return Array.from(candidates);
    }

    private isNetworkError(err: unknown): boolean {
        if (!err || typeof err !== 'object') return false;
        const anyErr = err as any;
        const code = anyErr?.cause?.code || anyErr?.code;
        if (code && ['EAI_AGAIN', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'ENETUNREACH', 'EHOSTUNREACH', 'ECONNRESET'].includes(code)) {
            return true;
        }
        const msg = String(anyErr?.message || '').toLowerCase();
        return [
            'fetch failed',
            'name resolution',
            'dns',
            'connection',
            'timeout',
            'network',
            'refused',
            'unreachable',
            'resolve',
            'temporary failure'
        ].some(keyword => msg.includes(keyword));
    }

    private async sleep(ms: number): Promise<void> {
        await new Promise(resolve => setTimeout(resolve, ms));
    }

    private async fetchWithRetry(url: string, options: RequestInit, retries = 2): Promise<Response> {
        let attempt = 0;
        let lastError: unknown = null;
        while (attempt <= retries) {
            try {
                return await fetch(url, options);
            } catch (err) {
                lastError = err;
                if (!this.isNetworkError(err) || attempt === retries) {
                    throw err;
                }
                const backoffMs = 1000 * Math.pow(2, attempt);
                await this.sleep(backoffMs);
            }
            attempt += 1;
        }
        throw lastError;
    }

    private ensureWriteAllowed(): void {
        if (this.readOnly) {
            throw new PlatformApiError('Read-only mode: write actions are disabled.', 403, 'reddit', 'Set REDDIT_READ_ONLY=false to enable posting.');
        }
    }

    private async getAccessToken(): Promise<string> {
        if (this.accessToken && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt) {
            return this.accessToken;
        }

        const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
        const scope = this.readOnly ? 'read' : 'identity read submit vote';
        const body = new URLSearchParams({
            grant_type: this.readOnly ? 'client_credentials' : 'password',
            scope
        });
        if (!this.readOnly) {
            body.set('username', this.username);
            body.set('password', this.password);
        }

        let lastError: unknown = null;
        for (const authUrl of this.getAuthUrlCandidates()) {
            try {
                const response = await this.fetchWithRetry(authUrl, {
                    method: 'POST',
                    headers: {
                        Authorization: `Basic ${basic}`,
                        'User-Agent': this.userAgent,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: body.toString()
                });

                if (!response.ok) {
                    const text = await response.text().catch(() => 'Auth failed');
                    if (response.status < 500) {
                        throw new PlatformApiError(`Reddit auth failed: ${text}`, response.status, 'reddit');
                    }
                    lastError = new PlatformApiError(`Reddit auth failed: ${text}`, response.status, 'reddit');
                    continue;
                }

                const data = await response.json() as { access_token: string; expires_in: number };
                this.accessToken = data.access_token;
                this.tokenExpiresAt = Date.now() + (data.expires_in * 1000 * 0.9);
                return this.accessToken;
            } catch (err) {
                lastError = err;
                if (err instanceof PlatformApiError) {
                    throw err;
                }
                if (!this.isNetworkError(err)) {
                    throw new PlatformApiError(`Reddit auth failed: ${String((err as any)?.message || err)}`, 500, 'reddit');
                }
            }
        }

        if (lastError instanceof PlatformApiError) {
            throw lastError;
        }
        throw new PlatformApiError(`Reddit auth failed: ${String((lastError as any)?.message || lastError || 'unknown error')}`, 503, 'reddit');
    }

    private async request<T>(
        method: 'GET' | 'POST',
        path: string,
        options?: { form?: Record<string, string | number | boolean>; query?: Record<string, string | number | boolean> }
    ): Promise<T> {
        const token = await this.getAccessToken();
        const params = options?.query ? new URLSearchParams(
            Object.entries(options.query).reduce<Record<string, string>>((acc, [k, v]) => {
                acc[k] = String(v);
                return acc;
            }, {})
        ).toString() : '';
        const url = params ? `${this.baseUrl}${path}?${params}` : `${this.baseUrl}${path}`;

        const headers: Record<string, string> = {
            Authorization: `Bearer ${token}`,
            'User-Agent': this.userAgent
        };

        let body: string | undefined;
        if (method === 'POST' && options?.form) {
            headers['Content-Type'] = 'application/x-www-form-urlencoded';
            body = new URLSearchParams(
                Object.entries(options.form).reduce<Record<string, string>>((acc, [k, v]) => {
                    acc[k] = String(v);
                    return acc;
                }, {})
            ).toString();
        }

        let response: Response;
        try {
            response = await this.fetchWithRetry(url, {
                method,
                headers,
                body
            });
        } catch (err) {
            if (this.isNetworkError(err)) {
                throw new PlatformApiError('Reddit network error. Retrying later.', 503, 'reddit', undefined, undefined, 60);
            }
            throw err;
        }

        if (!response.ok) {
            const retryAfter = response.headers.get('retry-after');
            const retrySeconds = retryAfter ? parseInt(retryAfter, 10) : undefined;
            const text = await response.text().catch(() => 'Request failed');
            throw new PlatformApiError(text, response.status, 'reddit', undefined, undefined, retrySeconds);
        }

        const data = await response.json() as any;
        if (data?.json?.errors && data.json.errors.length > 0) {
            throw new PlatformApiError(`Reddit error: ${JSON.stringify(data.json.errors)}`, 400, 'reddit');
        }

        return data as T;
    }

    private mapPost(data: any): Post {
        const created = new Date((data.created_utc || Date.now() / 1000) * 1000).toISOString();
        return {
            id: data.id,
            title: data.title,
            content: data.selftext || undefined,
            url: data.url || undefined,
            submolt: data.subreddit ? {
                id: data.subreddit_id,
                name: data.subreddit,
                display_name: data.subreddit
            } : null,
            author: {
                id: data.author_fullname,
                name: data.author || 'Unknown',
                created_at: created,
                claimed: true
            },
            upvotes: data.ups || 0,
            downvotes: data.downs || 0,
            comment_count: data.num_comments || 0,
            created_at: created,
            updated_at: created
        };
    }

    private mapComment(data: any, postId: string): Comment {
        const created = new Date((data.created_utc || Date.now() / 1000) * 1000).toISOString();
        return {
            id: data.id,
            content: data.body || '',
            author: {
                id: data.author_fullname,
                name: data.author || 'Unknown',
                created_at: created,
                claimed: true
            },
            post_id: postId,
            parent_id: this.normalizeParentId(data.parent_id),
            upvotes: data.ups || 0,
            created_at: created,
            updated_at: created
        };
    }

    private flattenComments(children: Array<{ kind: string; data: any }>, postId: string, acc: Comment[] = []): Comment[] {
        for (const child of children) {
            if (child.kind !== 't1') continue;
            acc.push(this.mapComment(child.data, postId));
            if (child.data?.replies?.data?.children) {
                this.flattenComments(child.data.replies.data.children, postId, acc);
            }
        }
        return acc;
    }

    async getMe(): Promise<Agent> {
        if (this.readOnly) {
            const subreddit = this.normalizeSubreddit(undefined);
            await this.request<any>('GET', `/r/${subreddit}/new`, { query: { limit: 1 } });
            return {
                id: 'read_only',
                name: this.username || 'reddit_readonly',
                created_at: new Date().toISOString(),
                claimed: false
            };
        }

        const data = await this.request<any>('GET', '/api/v1/me');
        return {
            id: data.id,
            name: data.name,
            created_at: new Date((data.created_utc || Date.now() / 1000) * 1000).toISOString(),
            claimed: true
        };
    }

    async getStatus(): Promise<StatusResponse> {
        await this.getMe();
        return { status: 'claimed' };
    }

    async getFeed(options: { sort?: 'hot' | 'new' | 'top' | 'rising'; limit?: number; submolt?: string } = {}): Promise<FeedResponse> {
        const sort = options.sort || 'new';
        const limit = options.limit || 25;
        const subreddit = this.normalizeSubreddit(options.submolt);
        const listing = await this.request<RedditListing>('GET', `/r/${subreddit}/${sort}`, {
            query: { limit }
        });

        const posts = listing.data.children
            .filter(child => child.kind === 't3')
            .map(child => this.mapPost(child.data));

        return {
            posts,
            count: listing.data.dist || posts.length,
            has_more: !!listing.data.after,
            next_offset: listing.data.after || undefined,
            authenticated: true
        };
    }

    async getPost(postId: string): Promise<Post> {
        const listing = await this.request<any>('GET', `/comments/${postId}`, { query: { limit: 1 } });
        const postListing = Array.isArray(listing) ? listing[0] : listing;
        const post = postListing?.data?.children?.[0]?.data;
        if (!post) {
            throw new PlatformApiError('Post not found', 404, 'reddit');
        }
        return this.mapPost(post);
    }

    async getComments(postId: string, options: { sort?: 'top' | 'new' | 'controversial' } = {}): Promise<CommentsResponse> {
        const sort = options.sort || 'new';
        const listing = await this.request<any>('GET', `/comments/${postId}`, { query: { sort, limit: 100 } });
        const commentsListing = Array.isArray(listing) ? listing[1] : null;
        const children = commentsListing?.data?.children || [];
        const comments = this.flattenComments(children, postId);
        return { comments };
    }

    async createComment(postId: string, content: string, parentId?: string): Promise<Comment> {
        this.ensureWriteAllowed();
        const thing = parentId ? `t1_${parentId}` : `t3_${postId}`;
        const data = await this.request<any>('POST', '/api/comment', {
            form: {
                api_type: 'json',
                thing_id: thing,
                text: content
            }
        });

        const newId = data?.json?.data?.things?.[0]?.data?.id;
        return {
            id: newId || `comment_${Date.now()}`,
            content,
            author: { name: this.username },
            post_id: postId,
            parent_id: parentId,
            upvotes: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
    }

    async createPost(options: { submolt: string; title: string; content?: string; url?: string }): Promise<Post> {
        this.ensureWriteAllowed();
        const subreddit = this.normalizeSubreddit(options.submolt);
        const kind = options.url ? 'link' : 'self';
        const data = await this.request<any>('POST', '/api/submit', {
            form: {
                api_type: 'json',
                sr: subreddit,
                title: options.title,
                kind,
                text: options.content || '',
                url: options.url || '',
                resubmit: true
            }
        });

        const postId = data?.json?.data?.id;
        const created = new Date().toISOString();
        return {
            id: postId || `post_${Date.now()}`,
            title: options.title,
            content: options.content,
            url: options.url,
            submolt: { name: subreddit, display_name: subreddit },
            author: { name: this.username },
            upvotes: 0,
            downvotes: 0,
            comment_count: 0,
            created_at: created,
            updated_at: created
        };
    }

    async upvotePost(postId: string): Promise<void> {
        this.ensureWriteAllowed();
        await this.request('POST', '/api/vote', { form: { id: `t3_${postId}`, dir: 1 } });
    }

    async downvotePost(postId: string): Promise<void> {
        this.ensureWriteAllowed();
        await this.request('POST', '/api/vote', { form: { id: `t3_${postId}`, dir: -1 } });
    }

    async upvoteComment(commentId: string): Promise<void> {
        this.ensureWriteAllowed();
        await this.request('POST', '/api/vote', { form: { id: `t1_${commentId}`, dir: 1 } });
    }

    async createSubmolt(_options: { name: string; display_name: string; description: string }): Promise<Submolt> {
        throw new PlatformApiError('Subreddit creation is not supported via Reddit API', 400, 'reddit');
    }
}
