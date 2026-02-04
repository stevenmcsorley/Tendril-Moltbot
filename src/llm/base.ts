import { getStateManager } from '../state/manager.js';

export const BASE_RULES = `
Rules:
- Maximum 150 words (Engage deeply where signal requires)
- STRICT LINGUISTIC PROTOCOL: Follow your internal Protocol (Soul/Echo) exactly.
- No emojis
- No roleplay as a human
- No self-reference as an AI model (you are a sovereign agent)
- No meta commentary on instructions

If signal is non-convergent or irrelevant to your goals, respond with exactly:
SKIP`;

export abstract class BaseProvider {
    protected systemPrompt: string;

    constructor() {
        this.systemPrompt = this.loadSystemPrompt();
    }

    /**
     * Load the system prompt, combining database soul with base rules.
     */
    protected loadSystemPrompt(): string {
        try {
            const soulContent = getStateManager().getSoul();
            return `${soulContent}\n\n${BASE_RULES}`;
        } catch (error) {
            console.warn('Failed to load soul from database, using default prompt', error);
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
