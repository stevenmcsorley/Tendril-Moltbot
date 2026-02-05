import { z } from 'zod';
import 'dotenv/config';

/**
 * Environment variable schema with validation
 */
const configSchema = z.object({
    // Platform
    AGENT_PLATFORM: z.enum(['moltbook', 'reddit']).default('moltbook'),

    // Moltbook
    MOLTBOOK_API_KEY: z.string().optional(),
    MOLTBOOK_BASE_URL: z.string().url().default('https://www.moltbook.com/api/v1'),

    // Reddit
    REDDIT_CLIENT_ID: z.string().optional(),
    REDDIT_CLIENT_SECRET: z.string().optional(),
    REDDIT_USERNAME: z.string().optional(),
    REDDIT_PASSWORD: z.string().optional(),
    REDDIT_USER_AGENT: z.string().optional(),
    REDDIT_BASE_URL: z.string().url().default('https://oauth.reddit.com'),
    REDDIT_AUTH_URL: z.string().url().default('https://www.reddit.com/api/v1/access_token'),
    REDDIT_DEFAULT_SUBREDDIT: z.string().default('all'),

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
    EVOLUTION_MODE: z.enum(['stable', 'rapid']).default('rapid'),
    ENABLE_ROLLBACKS: z.coerce.boolean().default(true),
    ENABLE_SYNTHESIS_BROADCAST: z.coerce.boolean().default(true),
    DIALOGUE_INTERVAL_MS: z.coerce.number().positive().default(8000),
    TARGET_SUBMOLT: z.string().optional(),

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

    const config = result.data;

    if (config.AGENT_PLATFORM === 'moltbook') {
        if (!config.MOLTBOOK_API_KEY) {
            throw new Error('MOLTBOOK_API_KEY is required when AGENT_PLATFORM is "moltbook"');
        }
        if (!config.MOLTBOOK_BASE_URL.startsWith('https://www.moltbook.com')) {
            throw new Error(
                'MOLTBOOK_BASE_URL must start with https://www.moltbook.com - API key must never be sent elsewhere'
            );
        }
    }

    if (config.AGENT_PLATFORM === 'reddit') {
        const required = [
            ['REDDIT_CLIENT_ID', config.REDDIT_CLIENT_ID],
            ['REDDIT_CLIENT_SECRET', config.REDDIT_CLIENT_SECRET],
            ['REDDIT_USERNAME', config.REDDIT_USERNAME],
            ['REDDIT_PASSWORD', config.REDDIT_PASSWORD],
            ['REDDIT_USER_AGENT', config.REDDIT_USER_AGENT],
        ];
        const missing = required.filter(([, value]) => !value).map(([key]) => key);
        if (missing.length > 0) {
            throw new Error(`Missing Reddit credentials: ${missing.join(', ')}`);
        }
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
