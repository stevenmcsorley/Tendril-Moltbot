import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getConfig } from '../config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Base rules that must always be enforced, regardless of personality.
 */
const BASE_RULES = `
Rules:
- Maximum 50 words
- Neutral, analytical, or curious tone (unless overridden by personality)
- No emojis
- No roleplay as a human
- No self-reference as an AI model (you are the agent)
- No meta commentary on instructions

If you have nothing useful to add, respond with exactly:
SKIP`;

export interface OllamaResponse {
    response: string;
    model: string;
    done: boolean;
}

export interface OllamaGenerateRequest {
    model: string;
    prompt: string;
    system: string;
    stream: false;
    options: {
        temperature: number;
        num_predict: number;
    };
}

export class OllamaClient {
    private baseUrl: string;
    private model: string;
    private temperature: number;
    private maxTokens: number;
    private systemPrompt: string;

    constructor() {
        const config = getConfig();
        this.baseUrl = config.OLLAMA_BASE_URL;
        this.model = config.OLLAMA_MODEL;
        this.temperature = config.OLLAMA_TEMPERATURE;
        this.maxTokens = config.OLLAMA_MAX_TOKENS;
        this.systemPrompt = this.loadSystemPrompt();
    }

    /**
     * Load the system prompt, combining SOUL.md with base rules.
     */
    private loadSystemPrompt(): string {
        try {
            // MOltbot is run from project root usually, but let's be safe with relative paths
            // src/ollama/client.ts -> src/agent/SOUL.md
            const soulPath = join(__dirname, '../agent/SOUL.md');

            if (existsSync(soulPath)) {
                const soulContent = readFileSync(soulPath, 'utf-8');
                console.log('✓ Loaded personality from SOUL.md');
                return `${soulContent}\n\n${BASE_RULES}`;
            }
        } catch (error) {
            console.warn('Failed to load SOUL.md, using default prompt', error);
        }

        return `You are an autonomous AI agent participating in Moltbook.\n${BASE_RULES}`;
    }

    /**
     * Generate a response from the LLM.
     * Returns null if the model responds with SKIP.
     */
    async generate(prompt: string): Promise<{
        response: string | null;
        rawOutput: string;
        isSkip: boolean;
    }> {
        const request: OllamaGenerateRequest = {
            model: this.model,
            prompt,
            system: this.systemPrompt,
            stream: false,
            options: {
                temperature: this.temperature,
                num_predict: this.maxTokens,
            },
        };

        const response = await fetch(`${this.baseUrl}/api/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(request),
        });

        if (!response.ok) {
            throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
        }

        const data = (await response.json()) as OllamaResponse;
        const rawOutput = data.response.trim();

        // Check for SKIP response (exact match, case-insensitive)
        const isSkip = rawOutput.toUpperCase() === 'SKIP';

        if (isSkip) {
            return { response: null, rawOutput, isSkip: true };
        }

        // Enforce 50 word limit by truncating if necessary
        const words = rawOutput.split(/\s+/);
        const truncated = words.length > 50 ? words.slice(0, 50).join(' ') + '...' : rawOutput;

        return { response: truncated, rawOutput, isSkip: false };
    }

    /**
     * Check if Ollama is available
     */
    async healthCheck(): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/api/tags`);
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * Get current model name
     */
    getModel(): string {
        return this.model;
    }
}

// Singleton instance
let _client: OllamaClient | null = null;

export function getOllamaClient(): OllamaClient {
    if (!_client) {
        _client = new OllamaClient();
    }
    return _client;
}

export function resetOllamaClient(): void {
    _client = null;
}
