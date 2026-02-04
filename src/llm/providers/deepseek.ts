import { getConfig } from '../../config.js';
import { BaseProvider } from '../base.js';
import { LLMClient, LLMResponse, GenerateOptions } from '../types.js';

export class DeepSeekProvider extends BaseProvider implements LLMClient {
    private apiKey: string;
    private baseUrl: string;
    private model: string;

    constructor() {
        super();
        const config = getConfig();
        this.apiKey = config.DEEPSEEK_API_KEY || '';
        this.baseUrl = config.DEEPSEEK_BASE_URL;
        this.model = config.DEEPSEEK_MODEL;
    }

    async generate(prompt: string, options: GenerateOptions = {}): Promise<LLMResponse> {
        if (!this.apiKey) {
            throw new Error('DeepSeek API key is missing');
        }

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: this.model,
                messages: [
                    { role: 'system', content: options.systemOverride ?? this.systemPrompt },
                    { role: 'user', content: prompt },
                ],
                stream: false,
                temperature: options.temperature ?? 0.2,
                max_tokens: options.maxTokens ?? 120,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`DeepSeek API error: ${response.status} ${JSON.stringify(errorData)}`);
        }

        const data = await response.json() as {
            choices: Array<{
                message: {
                    content: string;
                }
            }>
        };
        const rawOutput = data.choices[0]?.message?.content?.trim() || '';

        // Check for SKIP response
        const isSkip = rawOutput.toUpperCase() === 'SKIP';

        if (isSkip) {
            return { response: null, rawOutput, isSkip: true };
        }

        const processed = options.skipPostProcessing ? rawOutput : this.applyPostProcessing(rawOutput);
        return { response: processed, rawOutput, isSkip: false };
    }

    async healthCheck(): Promise<boolean> {
        // Simple health check: try to hit the versions endpoint or similar if it exists, 
        // or just return true since it's a cloud API.
        return !!this.apiKey;
    }

    getModel(): string {
        return this.model;
    }

    getProvider(): string {
        return 'deepseek';
    }

    async embed(_text: string): Promise<number[]> {
        throw new Error('Embeddings not supported for DeepSeek provider');
    }
}
