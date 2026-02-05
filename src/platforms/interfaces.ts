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
        platform: 'moltbook' | 'reddit';
        supportsSubmolts: boolean;
        readOnly?: boolean;
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
    createPost(options: { submolt: string; title: string; content?: string; url?: string }): Promise<Post>;
    createSubmolt?(options: { name: string; display_name: string; description: string }): Promise<Submolt>;
}
