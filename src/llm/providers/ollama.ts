import { getConfig } from '../../config.js';
import { BaseProvider } from '../base.js';
import { LLMClient, LLMResponse } from '../types.js';

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

export class OllamaProvider extends BaseProvider implements LLMClient {
    private baseUrl: string;
    private model: string;
    private temperature: number;
    private maxTokens: number;

    constructor() {
        super();
        const config = getConfig();
        this.baseUrl = config.OLLAMA_BASE_URL;
        this.model = config.OLLAMA_MODEL;
        this.temperature = config.OLLAMA_TEMPERATURE;
        this.maxTokens = config.OLLAMA_MAX_TOKENS;
    }

    async generate(prompt: string): Promise<LLMResponse> {
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

        const processed = this.applyPostProcessing(rawOutput);
        return { response: processed, rawOutput, isSkip: false };
    }

    async healthCheck(): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/api/tags`);
            return response.ok;
        } catch {
            return false;
        }
    }

    getModel(): string {
        return this.model;
    }

    getProvider(): string {
        return 'ollama';
    }

    async embed(text: string): Promise<number[]> {
        const response = await fetch(`${this.baseUrl}/api/embeddings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: this.model,
                prompt: text,
            }),
        });

        if (!response.ok) {
            throw new Error(`Ollama embedding failed: ${response.status} ${response.statusText}`);
        }

        const data = (await response.json()) as { embedding: number[] };
        return data.embedding;
    }
}
