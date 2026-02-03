import { getConfig } from '../config.js';
import { LLMClient } from './types.js';
import { OllamaProvider } from './providers/ollama.js';
import { DeepSeekProvider } from './providers/deepseek.js';

let _client: LLMClient | null = null;

/**
 * Get the configured LLM client.
 */
export function getLLMClient(): LLMClient {
    if (!_client) {
        const config = getConfig();
        if (config.LLM_PROVIDER === 'deepseek') {
            _client = new DeepSeekProvider();
        } else {
            _client = new OllamaProvider();
        }
    }
    return _client;
}

/**
 * Reset the LLM client (e.g., when config changes).
 */
export function resetLLMClient(): void {
    _client = null;
}
