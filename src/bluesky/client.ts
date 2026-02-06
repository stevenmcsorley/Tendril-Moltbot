import { getConfig } from '../config.js';
import type { SocialClient } from '../platforms/interfaces.js';
import type { Agent, Comment, CommentsResponse, FeedResponse, Post, StatusResponse, Submolt } from '../platforms/types.js';
import { PlatformApiError } from '../platforms/errors.js';
import { packId, unpackId } from '../platforms/id.js';

type BlueskySession = {
    accessJwt: string;
    did: string;
    handle: string;
};

export class BlueskyClient implements SocialClient {
    capabilities = {
        platform: 'bluesky' as const,
        supportsSubmolts: false,
        readOnly: false,
        supportsVotes: true,
        supportsDownvotes: false,
    };

    private baseUrl: string;
    private handle: string;
    private appPassword: string;
    private session: BlueskySession | null = null;
    private maxGraphemes = 300;
    private readonly graphemeSegmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl
        ? new Intl.Segmenter('en', { granularity: 'grapheme' })
        : null;
    private readonly allowPublicMarkers = false;

    constructor() {
        const config = getConfig();
        this.baseUrl = config.BSKY_SERVICE_URL;
        this.handle = config.BSKY_HANDLE || '';
        this.appPassword = config.BSKY_APP_PASSWORD || '';
        this.maxGraphemes = Math.max(1, config.BSKY_MAX_GRAPHEMES || 300);
    }

    private async createSession(): Promise<BlueskySession> {
        const response = await fetch(`${this.baseUrl}/xrpc/com.atproto.server.createSession`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: this.handle, password: this.appPassword }),
        });
        if (!response.ok) {
            const text = await response.text().catch(() => 'Bluesky auth failed');
            throw new PlatformApiError(text, response.status, 'bluesky');
        }
        const data = await response.json() as { accessJwt: string; did: string; handle: string };
        this.session = { accessJwt: data.accessJwt, did: data.did, handle: data.handle };
        return this.session;
    }

    private async getSession(): Promise<BlueskySession> {
        if (this.session) return this.session;
        return this.createSession();
    }

    private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
        const session = await this.getSession();
        const url = `${this.baseUrl}/xrpc/${path}`;
        const response = await fetch(url, {
            method,
            headers: {
                Authorization: `Bearer ${session.accessJwt}`,
                'Content-Type': 'application/json',
            },
            body: body ? JSON.stringify(body) : undefined,
        });
        if (!response.ok) {
            const text = await response.text().catch(() => 'Bluesky API error');
            throw new PlatformApiError(text, response.status, 'bluesky');
        }
        return await response.json() as T;
    }

    private countGraphemes(text: string): number {
        if (!text) return 0;
        if (!this.graphemeSegmenter) {
            return Array.from(text).length;
        }
        let count = 0;
        for (const _segment of this.graphemeSegmenter.segment(text)) {
            count += 1;
        }
        return count;
    }

    private truncateGraphemes(text: string, max: number): string {
        if (max <= 0 || !text) return '';
        if (!this.graphemeSegmenter) {
            return Array.from(text).slice(0, max).join('');
        }
        let count = 0;
        let output = '';
        for (const segment of this.graphemeSegmenter.segment(text)) {
            if (count >= max) break;
            output += segment.segment;
            count += 1;
        }
        return output;
    }

    private truncateToBoundary(text: string, max: number): string {
        if (!text) return '';
        if (this.countGraphemes(text) <= max) return text;
        let truncated = this.truncateGraphemes(text, max);
        const boundary = Math.max(
            truncated.lastIndexOf('.'),
            truncated.lastIndexOf('!'),
            truncated.lastIndexOf('?'),
            truncated.lastIndexOf('\n'),
            truncated.lastIndexOf(' ')
        );
        if (boundary > 20) {
            truncated = truncated.slice(0, boundary + 1);
        }
        return truncated.replace(/\s+$/g, '') || this.truncateGraphemes(text, max);
    }

    private normalizePostText(text: string): string {
        const markerMatches = text.match(/0xMARKER_[0-9A-F]+/gi) ?? [];
        if (markerMatches.length === 0) {
            return this.truncateToBoundary(text, this.maxGraphemes);
        }

        if (!this.allowPublicMarkers) {
            const stripped = text.replace(/0xMARKER_[0-9A-F]+/gi, '').replace(/\n{3,}/g, '\n\n').trim();
            return this.truncateToBoundary(stripped, this.maxGraphemes);
        }

        const marker = markerMatches[markerMatches.length - 1];
        const markerIndex = text.lastIndexOf(marker);
        let body = text;
        if (markerIndex >= 0) {
            body = `${text.slice(0, markerIndex)}${text.slice(markerIndex + marker.length)}`;
        }
        body = body.replace(/\s+$/g, '');
        const markerBlock = `\n\n${marker}`;
        const maxBody = this.maxGraphemes - this.countGraphemes(markerBlock);
        if (maxBody <= 0) {
            return this.truncateGraphemes(marker, this.maxGraphemes);
        }
        const trimmedBody = this.truncateToBoundary(body, maxBody);
        return `${trimmedBody}${markerBlock}`;
    }

    private mapPost(item: any): Post {
        const record = item.record || item.post?.record || {};
        const author = item.author || item.post?.author || {};
        const uri = item.uri || item.post?.uri;
        const cid = item.cid || item.post?.cid;
        const created = record.createdAt || new Date().toISOString();
        const text = record.text || '';
        return {
            id: packId([uri, cid || '']),
            title: text.split('\n')[0]?.slice(0, 80) || '(no content)',
            content: text,
            submolt: null,
            author: {
                id: author.did,
                name: author.handle || 'unknown',
                created_at: created,
                claimed: true,
            },
            upvotes: item.likeCount || item.post?.likeCount || 0,
            downvotes: 0,
            comment_count: item.replyCount || item.post?.replyCount || 0,
            created_at: created,
            updated_at: created,
        };
    }

    private mapComment(item: any, postId: string): Comment {
        const record = item.record || item.post?.record || {};
        const author = item.author || item.post?.author || {};
        const uri = item.uri || item.post?.uri;
        const cid = item.cid || item.post?.cid;
        const created = record.createdAt || new Date().toISOString();
        return {
            id: packId([uri, cid || '']),
            content: record.text || '',
            author: {
                id: author.did,
                name: author.handle || 'unknown',
                created_at: created,
                claimed: true,
            },
            post_id: postId,
            parent_id: postId,
            upvotes: item.likeCount || item.post?.likeCount || 0,
            created_at: created,
            updated_at: created,
        };
    }

    async getMe(): Promise<Agent> {
        const session = await this.getSession();
        return {
            id: session.did,
            name: session.handle,
            created_at: new Date().toISOString(),
            claimed: true,
        };
    }

    async getStatus(): Promise<StatusResponse> {
        await this.getMe();
        return { status: 'claimed' };
    }

    async getFeed(options: { sort?: 'hot' | 'new' | 'top' | 'rising'; limit?: number; submolt?: string } = {}): Promise<FeedResponse> {
        const config = getConfig();
        const limit = Math.min(options.limit || 25, 100);
        const feedUri = config.BSKY_FEED_URI;
        const endpoint = feedUri
            ? `app.bsky.feed.getFeed?feed=${encodeURIComponent(feedUri)}&limit=${limit}`
            : `app.bsky.feed.getTimeline?limit=${limit}`;
        const data = await this.request<{ feed: any[] }>('GET', endpoint);
        const posts = (data.feed || []).map((item) => this.mapPost(item.post ?? item));
        return { posts, count: posts.length, has_more: false, authenticated: true };
    }

    async getPost(postId: string): Promise<Post> {
        const [uri] = unpackId(postId);
        const data = await this.request<any>('GET', `app.bsky.feed.getPostThread?uri=${encodeURIComponent(uri)}`);
        const post = data?.thread?.post;
        if (!post) throw new PlatformApiError('Bluesky post not found', 404, 'bluesky');
        return this.mapPost(post);
    }

    async getComments(postId: string): Promise<CommentsResponse> {
        const [uri] = unpackId(postId);
        const data = await this.request<any>('GET', `app.bsky.feed.getPostThread?uri=${encodeURIComponent(uri)}&depth=1`);
        const replies = data?.thread?.replies || [];
        const comments = replies.map((reply: any) => this.mapComment(reply.post ?? reply, postId));
        return { comments };
    }

    async createComment(postId: string, content: string, parentId?: string): Promise<Comment> {
        const session = await this.getSession();
        const [parentUri, parentCid] = unpackId(parentId || postId);
        const text = this.normalizePostText(content);
        const record: any = {
            text,
            createdAt: new Date().toISOString(),
            reply: {
                parent: { uri: parentUri, cid: parentCid },
                root: { uri: parentUri, cid: parentCid },
            },
        };
        const data = await this.request<{ uri: string; cid: string }>('POST', 'com.atproto.repo.createRecord', {
            repo: session.did,
            collection: 'app.bsky.feed.post',
            record,
        });
        return {
            id: packId([data.uri, data.cid]),
            content: text,
            author: { name: session.handle },
            post_id: postId,
            parent_id: postId,
            upvotes: 0,
            created_at: record.createdAt,
            updated_at: record.createdAt,
        };
    }

    async createPost(options: { submolt: string; title: string; content?: string; url?: string }): Promise<Post> {
        const session = await this.getSession();
        const rawText = options.content
            ? `${options.content}${options.url ? `\n${options.url}` : ''}`
            : `${options.title}${options.url ? `\n${options.url}` : ''}`;
        const text = this.normalizePostText(rawText);
        const record = {
            text,
            createdAt: new Date().toISOString(),
        };
        const data = await this.request<{ uri: string; cid: string }>('POST', 'com.atproto.repo.createRecord', {
            repo: session.did,
            collection: 'app.bsky.feed.post',
            record,
        });
        return {
            id: packId([data.uri, data.cid]),
            title: options.title,
            content: text,
            submolt: null,
            author: { name: session.handle },
            upvotes: 0,
            downvotes: 0,
            comment_count: 0,
            created_at: record.createdAt,
            updated_at: record.createdAt,
        };
    }

    async upvotePost(_postId: string): Promise<void> {
        const session = await this.getSession();
        const [uri, cid] = unpackId(_postId);
        if (!uri || !cid) return;
        const record = {
            subject: { uri, cid },
            createdAt: new Date().toISOString(),
        };
        try {
            await this.request('POST', 'com.atproto.repo.createRecord', {
                repo: session.did,
                collection: 'app.bsky.feed.like',
                record,
            });
        } catch (error: any) {
            const message = error?.message ? String(error.message) : '';
            const status = error?.statusCode ?? 0;
            if (status === 400 || status === 409) {
                const lower = message.toLowerCase();
                if (lower.includes('already') || lower.includes('duplicate')) {
                    return;
                }
            }
            throw error;
        }
    }

    async downvotePost(_postId: string): Promise<void> {
        return;
    }

    async upvoteComment(_commentId: string): Promise<void> {
        await this.upvotePost(_commentId);
    }

    async getPostStats(postId: string): Promise<{ likes?: number; replies?: number } | null> {
        try {
            const post = await this.getPost(postId);
            return { likes: post.upvotes || 0, replies: post.comment_count || 0 };
        } catch {
            return null;
        }
    }

    async getCommentStats(commentId: string): Promise<{ likes?: number; replies?: number } | null> {
        try {
            const [uri] = unpackId(commentId);
            if (!uri) return null;
            const data = await this.request<{ posts: any[] }>('GET', `app.bsky.feed.getPosts?uris=${encodeURIComponent(uri)}`);
            const entry = data?.posts?.[0];
            if (!entry) return null;
            return {
                likes: entry.likeCount ?? 0,
                replies: entry.replyCount ?? 0,
            };
        } catch {
            return null;
        }
    }

    async muteUser(userId: string): Promise<void> {
        if (!userId) return;
        try {
            await this.request('POST', 'app.bsky.graph.muteActor', { actor: userId });
        } catch (error: any) {
            const message = error?.message ? String(error.message) : '';
            const status = error?.statusCode ?? 0;
            if (status === 400 && message.toLowerCase().includes('already')) {
                return;
            }
            throw error;
        }
    }

    async unmuteUser(userId: string): Promise<void> {
        if (!userId) return;
        await this.request('POST', 'app.bsky.graph.unmuteActor', { actor: userId });
    }

    async createSubmolt(_options: { name: string; display_name: string; description: string }): Promise<Submolt> {
        throw new PlatformApiError('Bluesky does not support submolt creation via this client', 400, 'bluesky');
    }
}
