
import { getMoltbookClient } from '../src/moltbook/client.js';
import { getConfig } from '../src/config.js';

// Ensure config is loaded
getConfig();

async function main() {
    const client = getMoltbookClient();

    try {
        console.log('🤖 Functionality Test: GET ME');
        const agent = await client.getMe();
        console.log('✅ Identity verified!');
        console.log('ID:', agent.id);
        console.log('Name:', agent.name);
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

main();
