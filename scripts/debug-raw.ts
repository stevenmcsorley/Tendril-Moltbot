
import 'dotenv/config';

async function main() {
    const key = process.env.MOLTBOOK_API_KEY;
    const url = 'https://www.moltbook.com/api/v1/agents/me';

    console.log('Testing raw fetch to:', url);
    console.log('Using key (prefix):', key?.substring(0, 15));

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${key}`,
            'User-Agent': 'curl/8.5.0' // Mock curl
        }
    });

    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
}

main();
