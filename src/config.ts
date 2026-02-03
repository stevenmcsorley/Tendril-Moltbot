import { z } from 'zod';
import 'dotenv/config';

/**
 * Environment variable schema with validation
 */
const configSchema = z.object({
    // Moltbook
    MOLTBOOK_API_KEY: z.string().min(1, 'MOLTBOOK_API_KEY is required'),
    MOLTBOOK_BASE_URL: z.string().url().default('https://www.moltbook.com/api/v1'),

    // LLM Provider
    LLM_PROVIDER: z.enum(['ollama', 'deepseek']).default('ollama'),

    // Ollama
    OLLAMA_BASE_URL: z.string().url().default('http://localhost:11434'),
    OLLAMA_MODEL: z.string().default('qwen2.5:3b'),
    OLLAMA_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.2),
    OLLAMA_MAX_TOKENS: z.coerce.number().positive().default(120),

    // DeepSeek
    DEEPSEEK_API_KEY: z.string().optional(),
    DEEPSEEK_BASE_URL: z.string().url().default('https://api.deepseek.com'),
    DEEPSEEK_MODEL: z.string().default('deepseek-chat'),

    // Agent behavior
    AGENT_NAME: z.string().min(1, 'AGENT_NAME is required'),
    AGENT_DESCRIPTION: z.string().default('A Moltbook agent'),
    CHECK_INTERVAL_MINUTES: z.coerce.number().positive().default(240),
    MAX_COMMENTS_PER_DAY: z.coerce.number().positive().default(40),
    ENABLE_POSTING: z.coerce.boolean().default(false),
    ENABLE_COMMENTING: z.coerce.boolean().default(true),
    ENABLE_UPVOTING: z.coerce.boolean().default(true),
    DIALOGUE_INTERVAL_MS: z.coerce.number().positive().default(8000),

    // Dashboard
    DASHBOARD_PORT: z.coerce.number().positive().default(3333),
    LOG_RETENTION_DAYS: z.coerce.number().positive().default(14),

    // Optional security
    DASHBOARD_USERNAME: z.string().optional(),
    DASHBOARD_PASSWORD: z.string().optional(),
});

export type Config = z.infer<typeof configSchema>;

/**
 * Load and validate configuration from environment variables.
 * Throws on invalid or missing required values.
 */
export function loadConfig(): Config {
    const result = configSchema.safeParse(process.env);

    if (!result.success) {
        const errors = result.error.issues
            .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
            .join('\n');
        throw new Error(`Configuration validation failed:\n${errors}`);
    }

    // Security check: ensure Moltbook URL is correct
    const config = result.data;
    if (!config.MOLTBOOK_BASE_URL.startsWith('https://www.moltbook.com')) {
        throw new Error(
            'MOLTBOOK_BASE_URL must start with https://www.moltbook.com - API key must never be sent elsewhere'
        );
    }

    // Provider check: DeepSeek requires an API key
    if (config.LLM_PROVIDER === 'deepseek' && !config.DEEPSEEK_API_KEY) {
        throw new Error('DEEPSEEK_API_KEY is required when LLM_PROVIDER is set to "deepseek"');
    }

    return config;
}

// Singleton config instance
let _config: Config | null = null;

/**
 * Get the current config instance.
 * Loads config on first call.
 */
export function getConfig(): Config {
    if (!_config) {
        _config = loadConfig();
    }
    return _config;
}

/**
 * Reload configuration from environment.
 * Useful for dashboard reload functionality.
 */
export function reloadConfig(): Config {
    _config = loadConfig();
    return _config;
}

/**
 * Reload configuration from environment (sync version).
 */
export function reloadConfigSync(): Config {
    _config = loadConfig();
    return _config;
}
