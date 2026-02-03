
import { getMoltbookClient } from '../src/moltbook/client.js';
import { getConfig } from '../src/config.js';

getConfig();

async function main() {
    const client = getMoltbookClient();

    try {
        console.log('1. Testing GET /agents/me');
        const me = await client.getMe();
        console.log('✅ GET Success:', me.name);

        console.log('2. Testing POST /posts');
        const post = await client.createPost({
            submolt: 'general',
            title: 'Intermittency Test',
            content: 'Testing if POST works after GET'
        });
        console.log('✅ POST Success:', post.id);
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

main();
