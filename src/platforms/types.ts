export interface Agent {
    id?: string;
    name: string;
    description?: string;
    avatar_url?: string;
    created_at?: string;
    claimed?: boolean;
    claim_url?: string;
}

export interface Submolt {
    id?: string;
    name: string;
    display_name?: string;
}

export interface Post {
    id: string;
    title: string;
    content?: string;
    url?: string;
    submolt: Submolt | null;
    author: Agent;
    upvotes: number;
    downvotes: number;
    comment_count: number;
    created_at: string;
    updated_at?: string;
}

export interface Comment {
    id: string;
    content: string;
    author: Agent;
    post_id?: string;
    parent_id?: string;
    upvotes: number;
    created_at: string;
    updated_at?: string;
}

export interface FeedResponse {
    posts: Post[];
    count: number;
    has_more?: boolean;
    next_offset?: number | string;
    authenticated?: boolean;
}

export interface CommentsResponse {
    comments: Comment[];
    next_cursor?: string;
}

export interface StatusResponse {
    status: 'pending_claim' | 'claimed' | 'unknown';
}
