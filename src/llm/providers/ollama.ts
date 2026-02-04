import { getConfig } from '../../config.js';
import { BaseProvider } from '../base.js';
import { LLMClient, LLMResponse, GenerateOptions } from '../types.js';

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

    async ollamaFetch(request: OllamaGenerateRequest): Promise<OllamaResponse> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 180000); // 180s timeout (3 mins)

        try {
            const response = await fetch(`${this.baseUrl}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request),
                signal: controller.signal
            });

            if (!response.ok) {
                throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
            }

            return (await response.json()) as OllamaResponse;
        } finally {
            clearTimeout(timeout);
        }
    }

    async generate(prompt: string, options: GenerateOptions = {}): Promise<LLMResponse> {
        const request: OllamaGenerateRequest = {
            model: this.model,
            prompt,
            system: options.systemOverride ?? this.systemPrompt,
            stream: false,
            options: {
                temperature: options.temperature ?? this.temperature,
                num_predict: options.maxTokens ?? this.maxTokens,
            },
        };

        try {
            const data = await this.ollamaFetch(request);
            const rawOutput = data.response.trim();

            const isSkip = rawOutput.toUpperCase() === 'SKIP';

            if (isSkip) {
                return { response: null, rawOutput, isSkip: true };
            }

            const processed = options.skipPostProcessing ? rawOutput : this.applyPostProcessing(rawOutput);
            return { response: processed, rawOutput, isSkip: false };
        } catch (error) {
            console.error('Ollama generation error:', error);
            throw error;
        }
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
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000); // 60s for embedding

        try {
            const response = await fetch(`${this.baseUrl}/api/embeddings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: this.model,
                    prompt: text,
                }),
                signal: controller.signal
            });

            if (!response.ok) {
                throw new Error(`Ollama embedding failed: ${response.status} ${response.statusText}`);
            }

            const data = (await response.json()) as { embedding: number[] };
            return data.embedding;
        } finally {
            clearTimeout(timeout);
        }
    }
}
