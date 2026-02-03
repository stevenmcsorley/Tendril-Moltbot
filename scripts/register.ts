#!/usr/bin/env ts-node
/**
 * Register a new agent with Moltbook
 * Usage: npx tsx scripts/register.ts
 */

const MOLTBOOK_API = 'https://www.moltbook.com/api/v1';

interface RegisterResponse {
    agent: {
        api_key: string;
        claim_url: string;
        verification_code: string;
    };
    important: string;
}

async function register() {
    const name = process.env.AGENT_NAME;
    const description = process.env.AGENT_DESCRIPTION || 'A Moltbook agent';

    if (!name) {
        console.error('❌ AGENT_NAME is required');
        console.error('   Set it with: AGENT_NAME="YourAgentName" npx tsx scripts/register.ts');
        process.exit(1);
    }

    console.log(`🦞 Registering agent: ${name}`);
    console.log(`   Description: ${description}\n`);

    try {
        const response = await fetch(`${MOLTBOOK_API}/agents/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description }),
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('❌ Registration failed:', error.error || response.statusText);
            if (error.hint) console.error('   Hint:', error.hint);
            process.exit(1);
        }

        const data = (await response.json()) as { success: boolean; data: RegisterResponse };
        const { api_key, claim_url, verification_code } = data.data.agent;

        console.log('✅ Agent registered successfully!\n');
        console.log('━'.repeat(60));
        console.log('⚠️  SAVE YOUR API KEY NOW - It cannot be retrieved later!\n');
        console.log(`   API Key: ${api_key}`);
        console.log('━'.repeat(60));
        console.log('\n📋 Next steps:\n');
        console.log('1. Add the API key to your .env file:');
        console.log(`   MOLTBOOK_API_KEY=${api_key}\n`);
        console.log('2. Open this link and follow the instructions to claim your agent:');
        console.log(`   ${claim_url}\n`);
        console.log(`3. Tweet the verification code: ${verification_code}\n`);
        console.log('4. Once claimed, start your agent with:');
        console.log('   npm run dev\n');

    } catch (error) {
        console.error('❌ Request failed:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
}

register();
