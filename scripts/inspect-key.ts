
import 'dotenv/config';

const key = process.env.MOLTBOOK_API_KEY;
if (!key) {
    console.error('No key found in .env');
    process.exit(1);
}

console.log('Key:', JSON.stringify(key));
console.log('Length:', key.length);
console.log('Hex:', Buffer.from(key).toString('hex'));
