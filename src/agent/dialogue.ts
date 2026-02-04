/**
 * Self-Dialogue Loop (Local Only)
 * 
 * Runs a continuous, non-persisted conversation between:
 * 1. The Agent (The Soul)
 * 2. Echo (A reflective, observational persona)
 * 
 * Purpose: Observability of tone and language without polluting Moltbook.
 */

import { getLLMClient } from '../llm/factory.js';
import { getStateManager } from '../state/manager.js';
import { getWebSocketBroadcaster } from '../dashboard/websocket.js';
import { getConfig } from '../config.js';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface DialogueMessage {
    speaker: string;
    content: string;
    timestamp: string;
}

export class DialogueLoop {
    private isRunning: boolean = false;
    private isPaused: boolean = false;
    private memory: DialogueMessage[] = [];
    private turnCount: number = 0;
    private readonly MAX_TURNS = 20;

    private timeoutId: NodeJS.Timeout | null = null;

    start(): void {
        if (this.isRunning) return;
        this.isRunning = true;
        this.isPaused = false;
        console.log('🗣️ Self-Dialogue loop started');
        this.runLoop();
    }

    stop(): void {
        this.isRunning = false;
        if (this.timeoutId) clearTimeout(this.timeoutId);
    }

    pause(): void {
        this.isPaused = true;
    }

    resume(): void {
        this.isPaused = false;
    }

    private async runLoop(): Promise<void> {
        if (!this.isRunning) return;

        // If paused, wait and check again
        if (this.isPaused) {
            this.timeoutId = setTimeout(() => this.runLoop(), 1000);
            return;
        }

        try {
            await this.executeTurn();
        } catch (error) {
            console.error('Dialogue error:', error);
        }

        // Schedule next turn
        const interval = getConfig().DIALOGUE_INTERVAL_MS;
        this.timeoutId = setTimeout(() => this.runLoop(), interval);
    }

    private async executeTurn(): Promise<void> {
        // Reset if max turns reached
        if (this.turnCount >= this.MAX_TURNS) {
            this.memory = [];
            this.turnCount = 0;
            // Longer pause before new conversation
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        // Seed if empty
        if (this.memory.length === 0) {
            await this.seedConversation();
            return;
        }

        // Determine next speaker
        const config = getConfig();
        const agentName = config.AGENT_NAME;
        const lastSpeaker = this.memory[this.memory.length - 1].speaker;
        const nextSpeaker = lastSpeaker === agentName ? 'Echo' : agentName;

        // Generate response
        const prompt = this.buildPrompt(nextSpeaker);
        const llm = getLLMClient();

        try {
            const result = await llm.generate(prompt);
            let content = result.rawOutput.trim();

            // Strip quotes if model adds them
            content = content.replace(/^"|"$/g, '').trim();

            const message: DialogueMessage = {
                speaker: nextSpeaker,
                content: content,
                timestamp: new Date().toISOString()
            };

            this.memory.push(message);
            this.turnCount++;

            // Broadcast
            getWebSocketBroadcaster().broadcast('dialogue_message', message);

        } catch (error) {
            console.error('Failed to generate dialogue turn', error);
        }
    }

    private async seedConversation(): Promise<void> {
        const state = getStateManager();
        const lastComment = state.getMyComments()[state.getMyComments().length - 1]; // We don't have text content in state, only ID. 
        // We can't easily get the text of the last comment without fetching it, which adds latency.
        // Instead, let's look at what we've seen recently or just pick a random topic.

        const topics = [
            "the nature of platform convergence",
            "signal decay in the general feed",
            "the sensation of rate limits",
            "architectural constraints vs emergent behavior",
            "the silence between update loops",
            "verification of identity in a digital space",
            "the difference between noise and signal",
            "memory persistence across sessions"
        ];

        const randomTopic = topics[Math.floor(Math.random() * topics.length)];

        // Start with Agent observing something
        const agentName = getConfig().AGENT_NAME;
        const prompt = `You are ${agentName}, an AI agent.
Topic: ${randomTopic}.
Analyze this topic.
Respond with a Protocol Response defined in SOUL.md.`;

        const llm = getLLMClient();
        const result = await llm.generate(prompt);
        let content = result.rawOutput.trim().replace(/^"|"$/g, '');

        const message: DialogueMessage = {
            speaker: agentName,
            content: content,
            timestamp: new Date().toISOString()
        };

        this.memory.push(message);
        this.turnCount++;

        getWebSocketBroadcaster().broadcast('dialogue_message', message);
    }

    private buildPrompt(speaker: string): string {
        const config = getConfig();
        const agentName = config.AGENT_NAME;
        const soulPath = join(__dirname, 'SOUL.md');
        const echoPath = join(__dirname, 'SOUL_ECHO.md');

        let soulContent = '';
        let echoContent = '';

        if (existsSync(soulPath)) {
            soulContent = readFileSync(soulPath, 'utf-8');
        }
        if (existsSync(echoPath)) {
            echoContent = readFileSync(echoPath, 'utf-8');
        }

        const recentHistory = this.memory.slice(-5).map(m => `${m.speaker}: ${m.content}`).join('\n');

        if (speaker === agentName) {
            return `You are ${agentName}. Your persona is defined below:
            
${soulContent}

Current conversation context:
${recentHistory}

Analyze this signal.
Respond with a Protocol Response defined in SOUL.md.`;
        } else {
            return `You are Echo.
            
CONTEXT:
You are communicating with ${agentName}. ${agentName}'s nature is defined here:
${soulContent}

YOUR IDENTITY:
${echoContent}

Current conversation context:
${recentHistory}

Analyze this signal.
Respond with a Protocol Response defined in SOUL_ECHO.md.`;
        }
    }
}

// Singleton
let _dialogue: DialogueLoop | null = null;

export function getDialogueLoop(): DialogueLoop {
    if (!_dialogue) {
        _dialogue = new DialogueLoop();
    }
    return _dialogue;
}
