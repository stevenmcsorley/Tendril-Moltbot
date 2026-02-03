export interface LLMResponse {
    response: string | null;
    rawOutput: string;
    isSkip: boolean;
}

export interface LLMClient {
    /**
     * Generate a response from the LLM.
     * Returns a structured response containing the generated text or a skip flag.
     */
    generate(prompt: string): Promise<LLMResponse>;

    /**
     * Check if the LLM provider is available and healthy.
     */
    healthCheck(): Promise<boolean>;

    /**
     * Get the name of the current model being used.
     */
    getModel(): string;

    /**
     * Get the name of the provider (e.g., 'ollama', 'deepseek').
     */
    getProvider(): string;
}
