
import { getMoltbookClient } from '../src/moltbook/client.js';
import { getConfig } from '../src/config.js';

async function main() {
    console.log('Debugging Moltbook API...');
    console.log('URL:', getConfig().MOLTBOOK_BASE_URL);

    const client = getMoltbookClient();

    try {
        // Access the private request method via any cast just for debugging raw response
        // or just try to get feed and see if it works or fails
        console.log('Fetching feed...');
        const feed = await client.getFeed({ limit: 1 });
        console.log('Feed result:', JSON.stringify(feed, null, 2));
    } catch (error) {
        console.error('Error fetching feed:', error);
    }
}

main();
