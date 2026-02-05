/**
 * Moltbot - Ultra-Slim Moltbook Agent
 * 
 * Entry point for the agent.
 */

import { getConfig } from './config.js';
import { startDashboardServer } from './dashboard/server.js';
import { getAgentLoop } from './agent/loop.js';
import { getActivityLogger } from './logging/activity-log.js';
import { getSocialClient } from './platforms/index.js';
import { getLLMClient } from './llm/factory.js';

import { getDialogueLoop } from './agent/dialogue.js';

async function main(): Promise<void> {
    console.log('🦞 Moltbot starting...');

    // Load and validate config
    let config;
    try {
        config = getConfig();
        const llm = getLLMClient();
        console.log(`Agent: ${config.AGENT_NAME}`);
        console.log(`Provider: ${llm.getProvider()}`);
        console.log(`Model: ${llm.getModel()}`);
        console.log(`Check interval: ${config.CHECK_INTERVAL_MINUTES} minutes`);
    } catch (error) {
        console.error('Configuration error:', error instanceof Error ? error.message : error);
        process.exit(1);
    }

    // Check LLM availability
    const llm = getLLMClient();
    const provider = llm.getProvider();
    const llmHealthy = await llm.healthCheck();
    if (!llmHealthy) {
        console.warn(`⚠️  ${provider} is not available. Agent will fail to generate responses.`);
        if (provider === 'ollama') {
            console.warn(`    Ensure Ollama is running at ${config.OLLAMA_BASE_URL}`);
        }
    } else {
        console.log(`✓ ${provider} connected`);
    }

    // Verify platform connectivity (with retry for platform stability)
    const client = getSocialClient();
    let me = null;
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
        try {
            me = await client.getMe();
            console.log(`✓ ${config.AGENT_PLATFORM} connected as @${me.name}`);
            break;
        } catch (error) {
            attempts++;
            const msg = error instanceof Error ? error.message : String(error);
            if (attempts >= maxAttempts) {
                console.error('❌ Platform API connection failed after multiple attempts.');
                console.error(`Final Error: ${msg}`);
                process.exit(1);
            }
            console.warn(`⚠️  ${config.AGENT_PLATFORM} connection attempt ${attempts} failed: ${msg}. Retrying in 10s...`);
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
    }

    // Start terminal log stream (Capture all startup logs)
    const { initializeTerminalStream } = await import('./logging/terminal-stream.js');
    initializeTerminalStream();

    // Start dashboard server
    startDashboardServer();

    // Start agent loop
    const loop = getAgentLoop();
    loop.start();
    console.log('✓ Agent loop started');

    // Dialogue loop disabled (too heavy for local dev)
    // const dialogue = getDialogueLoop();
    // dialogue.start();

    // Log startup
    const logger = getActivityLogger();
    logger.log({
        actionType: 'heartbeat',
        targetId: null,
        promptSent: null,
        rawModelOutput: null,
        finalAction: 'Agent started',
    });

    // Graceful shutdown
    const shutdown = (): void => {
        console.log('\n🦞 Moltbot shutting down...');

        loop.stop();

        logger.log({
            actionType: 'heartbeat',
            targetId: null,
            promptSent: null,
            rawModelOutput: null,
            finalAction: 'Agent stopped',
        });

        console.log('Goodbye!');
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    console.log('\n🦞 Moltbot is running');
    console.log(`   Dashboard: http://localhost:${config.DASHBOARD_PORT}`);
    console.log('   Press Ctrl+C to stop\n');
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
