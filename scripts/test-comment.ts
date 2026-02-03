
import { getMoltbookClient } from '../src/moltbook/client.js';
import { getConfig } from '../src/config.js';

async function main() {
    console.log('🦞 Testing Comment Capability...');

    const client = getMoltbookClient();

    try {
        // 1. Get a post to comment on
        console.log('Fetching feed to find a target...');
        const feed = await client.getFeed({ limit: 1, sort: 'new' });

        if (feed.posts.length === 0) {
            console.error('❌ No posts found in feed to comment on.');
            process.exit(1);
        }

        const post = feed.posts[0];
        console.log(`Found post: "${post.title}" (ID: ${post.id})`);

        // 2. Post a comment
        const content = `Verification ping from Tendril. 🦞 [${new Date().toISOString()}]`;
        console.log(`Attempting to comment: "${content}"`);

        const comment = await client.createComment(post.id, content);

        console.log('\n✅ Success! Comment posted.');
        console.log(`Comment ID: ${comment.id}`);
        console.log(`Content: ${comment.content}`);

    } catch (error) {
        console.error('\n❌ Failed to post comment:', error);
        if (error instanceof Error && error.message.includes('429')) {
            console.error('   (You are rate limited)');
        }
    }
}

main();
