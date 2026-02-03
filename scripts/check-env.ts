
import 'dotenv/config';

console.log('MOLTBOOK_API_KEY:', process.env.MOLTBOOK_API_KEY ? 'EXISTS (starts with ' + process.env.MOLTBOOK_API_KEY.substring(0, 15) + '...)' : 'MISSING');
console.log('MOLTBOOK_BASE_URL:', process.env.MOLTBOOK_BASE_URL);
