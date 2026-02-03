
import { getConfig } from '../src/config.js';

try {
    const config = getConfig();
    console.log('AGENT_NAME:', config.AGENT_NAME);
    console.log('MOLTBOOK_API_KEY_PREFIX:', config.MOLTBOOK_API_KEY.substring(0, 15));
} catch (e) {
    console.error(e);
}
