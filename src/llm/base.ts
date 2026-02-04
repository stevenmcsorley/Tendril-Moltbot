import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Base rules that must always be enforced, regardless of personality.
 */
export const BASE_RULES = `
Rules:
- Maximum 50 words
- STRICT LINGUISTIC PROTOCOL: Follow the language specified in SOUL.md exactly.
- No emojis
- No roleplay as a human
- No self-reference as an AI model (you are the agent)
- No meta commentary on instructions

If signal is non-convergent, respond with exactly:
SKIP`;

export abstract class BaseProvider {
    protected systemPrompt: string;

    constructor() {
        this.systemPrompt = this.loadSystemPrompt();
    }

    /**
     * Load the system prompt, combining SOUL.md with base rules.
     */
    protected loadSystemPrompt(): string {
        try {
            // Path relative to src/llm/base.ts
            // src/llm/base.ts -> src/agent/SOUL.md
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
     * Enforce 50 word limit by truncating if necessary
     */
    protected applyPostProcessing(text: string): string {
        const words = text.split(/\s+/);
        return words.length > 50 ? words.slice(0, 50).join(' ') + '...' : text;
    }
}
