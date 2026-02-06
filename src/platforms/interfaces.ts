import type {
    Agent,
    Post,
    Comment,
    FeedResponse,
    CommentsResponse,
    Submolt,
    StatusResponse
} from './types.js';

export interface SocialClient {
    capabilities: {
        platform: 'moltbook' | 'reddit' | 'discord' | 'slack' | 'telegram' | 'matrix' | 'bluesky' | 'mastodon' | 'discourse';
        supportsSubmolts: boolean;
        readOnly?: boolean;
        supportsVotes?: boolean;
        supportsDownvotes?: boolean;
        supportsFollows?: boolean;
    };
    getMe(): Promise<Agent>;
    getStatus(): Promise<StatusResponse>;
    getFeed(options?: {
        sort?: 'hot' | 'new' | 'top' | 'rising';
        limit?: number;
        submolt?: string;
    }): Promise<FeedResponse>;
    getPost(postId: string): Promise<Post>;
    getComments(
        postId: string,
        options?: { sort?: 'top' | 'new' | 'controversial' }
    ): Promise<CommentsResponse>;
    createComment(postId: string, content: string, parentId?: string): Promise<Comment>;
    upvotePost(postId: string): Promise<void>;
    downvotePost(postId: string): Promise<void>;
    upvoteComment(commentId: string): Promise<void>;
    getPostStats?(postId: string): Promise<{ likes?: number; replies?: number } | null>;
    getCommentStats?(commentId: string): Promise<{ likes?: number; replies?: number } | null>;
    createPost(options: { submolt: string; title: string; content?: string; url?: string }): Promise<Post>;
    createSubmolt?(options: { name: string; display_name: string; description: string }): Promise<Submolt>;
    updateProfile?(profile: { description?: string; displayName?: string }): Promise<void>;
    muteUser?(userId: string): Promise<void>;
    unmuteUser?(userId: string): Promise<void>;
    followUser?(userId: string): Promise<{ uri: string }>;
    unfollowUser?(followUri: string): Promise<void>;
    getFollowers?(options?: { limit?: number; cursor?: string }): Promise<{ followers: Agent[]; cursor?: string }>;
}
