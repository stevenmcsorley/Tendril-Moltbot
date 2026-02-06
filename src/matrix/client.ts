import { getConfig } from '../config.js';
import type { SocialClient } from '../platforms/interfaces.js';
import type { Agent, Comment, CommentsResponse, FeedResponse, Post, StatusResponse, Submolt } from '../platforms/types.js';
import { PlatformApiError } from '../platforms/errors.js';
import { packId, unpackId } from '../platforms/id.js';

type MatrixEvent = {
    event_id: string;
    sender: string;
    origin_server_ts: number;
    type: string;
    content: {
        body?: string;
        msgtype?: string;
        'm.relates_to'?: {
            'm.in_reply_to'?: { event_id: string };
        };
    };
};

export class MatrixClient implements SocialClient {
    capabilities = {
        platform: 'matrix' as const,
        supportsSubmolts: false,
        readOnly: false,
        supportsVotes: false,
        supportsDownvotes: false,
    };

    private baseUrl: string;
    private token: string;
    private defaultRoomId: string;

    constructor() {
        const config = getConfig();
        this.baseUrl = config.MATRIX_BASE_URL;
        this.token = config.MATRIX_ACCESS_TOKEN || '';
        this.defaultRoomId = config.MATRIX_DEFAULT_ROOM_ID || '';
    }

    private async request<T>(method: 'GET' | 'POST' | 'PUT', path: string, body?: unknown): Promise<T> {
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
            const text = await response.text().catch(() => 'Matrix API error');
            throw new PlatformApiError(text, response.status, 'matrix');
        }
        if (response.status === 204) return undefined as T;
        return await response.json() as T;
    }

    private resolveRoomId(submolt?: string): string {
        return submolt?.trim() || this.defaultRoomId;
    }

    private mapEvent(event: MatrixEvent, roomId: string): Post {
        const created = new Date(event.origin_server_ts || Date.now()).toISOString();
        const content = event.content?.body || '';
        return {
            id: packId([roomId, event.event_id]),
            title: content.split('\n')[0]?.slice(0, 80) || '(no content)',
            content,
            submolt: { id: roomId, name: roomId, display_name: roomId },
            author: { id: event.sender, name: event.sender, created_at: created, claimed: true },
            upvotes: 0,
            downvotes: 0,
            comment_count: 0,
            created_at: created,
            updated_at: created,
        };
    }

    private mapComment(event: MatrixEvent, postId: string): Comment {
        const created = new Date(event.origin_server_ts || Date.now()).toISOString();
        return {
            id: packId([postId, event.event_id]),
            content: event.content?.body || '',
            author: { id: event.sender, name: event.sender, created_at: created, claimed: true },
            post_id: postId,
            parent_id: postId,
            upvotes: 0,
            created_at: created,
            updated_at: created,
        };
    }

    async getMe(): Promise<Agent> {
        const data = await this.request<{ user_id: string }>('GET', '/_matrix/client/v3/account/whoami');
        return {
            id: data.user_id,
            name: data.user_id,
            created_at: new Date().toISOString(),
            claimed: true,
        };
    }

    async getStatus(): Promise<StatusResponse> {
        await this.getMe();
        return { status: 'claimed' };
    }

    async getFeed(options: { sort?: 'hot' | 'new' | 'top' | 'rising'; limit?: number; submolt?: string } = {}): Promise<FeedResponse> {
        const roomId = this.resolveRoomId(options.submolt);
        if (!roomId) throw new PlatformApiError('Matrix room ID is required', 400, 'matrix');
        const limit = Math.min(options.limit || 25, 100);
        const data = await this.request<{ chunk: MatrixEvent[] }>('GET', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/messages?dir=b&limit=${limit}`);
        const events = (data.chunk || []).filter((event) => event.type === 'm.room.message');
        const posts = events.map((event) => this.mapEvent(event, roomId));
        return { posts, count: posts.length, has_more: false, authenticated: true };
    }

    async getPost(postId: string): Promise<Post> {
        const [roomId, eventId] = unpackId(postId);
        if (!eventId) throw new PlatformApiError('Matrix post ID must include room and event IDs', 400, 'matrix');
        const event = await this.request<MatrixEvent>('GET', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/event/${encodeURIComponent(eventId)}`);
        return this.mapEvent(event, roomId);
    }

    async getComments(postId: string): Promise<CommentsResponse> {
        const [roomId, eventId] = unpackId(postId);
        if (!eventId) return { comments: [] };
        const data = await this.request<{ chunk: MatrixEvent[] }>('GET', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/messages?dir=b&limit=100`);
        const replies = (data.chunk || []).filter((event) =>
            event.type === 'm.room.message'
            && event.content?.['m.relates_to']?.['m.in_reply_to']?.event_id === eventId
        );
        const comments = replies.map((event) => this.mapComment(event, postId));
        return { comments };
    }

    async createComment(postId: string, content: string, parentId?: string): Promise<Comment> {
        const [roomId, eventId] = unpackId(parentId || postId);
        if (!eventId) throw new PlatformApiError('Matrix event ID is required for replies', 400, 'matrix');
        const txnId = `molt_${Date.now()}`;
        const event = await this.request<{ event_id: string }>('PUT', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txnId}`, {
            msgtype: 'm.text',
            body: content,
            'm.relates_to': {
                'm.in_reply_to': { event_id: eventId },
            },
        });
        return {
            id: packId([postId, event.event_id]),
            content,
            author: { name: 'matrix_bot' },
            post_id: postId,
            parent_id: postId,
            upvotes: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
    }

    async createPost(options: { submolt: string; title: string; content?: string; url?: string }): Promise<Post> {
        const roomId = this.resolveRoomId(options.submolt);
        if (!roomId) throw new PlatformApiError('Matrix room ID is required', 400, 'matrix');
        const text = options.content
            ? `${options.title}\n\n${options.content}${options.url ? `\n${options.url}` : ''}`
            : `${options.title}${options.url ? `\n${options.url}` : ''}`;
        const txnId = `molt_${Date.now()}`;
        const event = await this.request<{ event_id: string }>('PUT', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txnId}`, {
            msgtype: 'm.text',
            body: text,
        });
        return {
            id: packId([roomId, event.event_id]),
            title: options.title,
            content: text,
            submolt: { id: roomId, name: roomId, display_name: roomId },
            author: { name: 'matrix_bot' },
            upvotes: 0,
            downvotes: 0,
            comment_count: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
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
        throw new PlatformApiError('Matrix does not support submolt creation via this client', 400, 'matrix');
    }
}
