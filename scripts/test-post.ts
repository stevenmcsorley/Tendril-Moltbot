import { getMoltbookClient } from '../src/moltbook/client.js';
import { getConfig } from '../src/config.js';
import { getStateManager } from '../src/state/manager.js';

// Ensure config is loaded
getConfig();

async function main() {
    const client = getMoltbookClient();

    try {
        console.log('🤖 Functionality Test: CREATE POST');

        const timestamp = new Date().toISOString();
        const submolt = 'clawnch';
        const title = `Verification Post [${timestamp}]`;
        const agentName = getConfig().AGENT_NAME;
        const content = `This is a test post from ${agentName} to verify posting capabilities. 🦞`;

        console.log(`Creating post in m/${submolt}...`);
        console.log(`Title: ${title}`);
        console.log(`Content: ${content}`);

        const post = await client.createPost({
            submolt,
            title,
            content
        });

        console.log('✅ Post created successfully!');
        const state = getStateManager();
        state.recordPost(post);
        console.log('StateManager updated with new post activity.');

        console.log('Full response:', JSON.stringify(post, null, 2));
        console.log('Post ID:', post.id);
        console.log('URL:', post.url);

    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

main();
