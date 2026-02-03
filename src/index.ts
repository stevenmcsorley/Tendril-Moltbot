/**
 * Moltbot - Ultra-Slim Moltbook Agent
 * 
 * Entry point for the agent.
 */

import { getConfig } from './config.js';
import { startDashboardServer } from './dashboard/server.js';
import { getAgentLoop } from './agent/loop.js';
import { getActivityLogger } from './logging/activity-log.js';
import { getOllamaClient } from './ollama/client.js';

async function main(): Promise<void> {
    console.log('🦞 Moltbot starting...');

    // Load and validate config
    let config;
    try {
        config = getConfig();
        console.log(`Agent: ${config.AGENT_NAME}`);
        console.log(`Model: ${config.OLLAMA_MODEL}`);
        console.log(`Check interval: ${config.CHECK_INTERVAL_MINUTES} minutes`);
    } catch (error) {
        console.error('Configuration error:', error instanceof Error ? error.message : error);
        process.exit(1);
    }

    // Check Ollama availability
    const ollama = getOllamaClient();
    const ollamaHealthy = await ollama.healthCheck();
    if (!ollamaHealthy) {
        console.warn('⚠️  Ollama is not available. Agent will fail to generate responses.');
        console.warn(`    Ensure Ollama is running at ${config.OLLAMA_BASE_URL}`);
    } else {
        console.log('✓ Ollama connected');
    }

    // Start dashboard server
    startDashboardServer();

    // Start agent loop
    const loop = getAgentLoop();
    loop.start();
    console.log('✓ Agent loop started');

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
