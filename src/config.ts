import { z } from 'zod';
import 'dotenv/config';

/**
 * Environment variable schema with validation
 */
const optionalUrl = z.preprocess(
    (value) => (value === '' || value === undefined ? undefined : value),
    z.string().url()
);

const configSchema = z.object({
    // Platform
    AGENT_PLATFORM: z.enum(['moltbook', 'reddit', 'discord', 'slack', 'telegram', 'matrix', 'bluesky', 'mastodon', 'discourse']).default('moltbook'),

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
    REDDIT_READ_ONLY: z.coerce.boolean().default(false),

    // Discord
    DISCORD_BOT_TOKEN: z.string().optional(),
    DISCORD_BASE_URL: z.string().url().default('https://discord.com/api/v10'),
    DISCORD_DEFAULT_CHANNEL_ID: z.string().optional(),

    // Slack
    SLACK_BOT_TOKEN: z.string().optional(),
    SLACK_BASE_URL: z.string().url().default('https://slack.com/api'),
    SLACK_DEFAULT_CHANNEL: z.string().optional(),

    // Telegram
    TELEGRAM_BOT_TOKEN: z.string().optional(),
    TELEGRAM_BASE_URL: z.string().url().default('https://api.telegram.org'),
    TELEGRAM_DEFAULT_CHAT_ID: z.string().optional(),

    // Matrix
    MATRIX_BASE_URL: z.string().url().default('https://matrix.org'),
    MATRIX_ACCESS_TOKEN: z.string().optional(),
    MATRIX_DEFAULT_ROOM_ID: z.string().optional(),

    // Bluesky
    BSKY_SERVICE_URL: z.string().url().default('https://bsky.social'),
    BSKY_HANDLE: z.string().optional(),
    BSKY_APP_PASSWORD: z.string().optional(),
    BSKY_MAX_GRAPHEMES: z.coerce.number().positive().default(300),
    BSKY_FEED_URI: z.string().optional(),
    BSKY_DEFENSE_MUTE: z.coerce.boolean().default(false),

    // Mastodon
    MASTODON_BASE_URL: optionalUrl.optional(),
    MASTODON_ACCESS_TOKEN: z.string().optional(),
    MASTODON_TIMELINE: z.enum(['home', 'public']).default('home'),

    // Discourse
    DISCOURSE_BASE_URL: optionalUrl.optional(),
    DISCOURSE_API_KEY: z.string().optional(),
    DISCOURSE_API_USERNAME: z.string().optional(),
    DISCOURSE_DEFAULT_CATEGORY: z.string().optional(),

    // LLM Provider
    LLM_PROVIDER: z.enum(['ollama', 'deepseek']).default('ollama'),

    // Ollama
    OLLAMA_BASE_URL: z.string().url().default('http://localhost:11434'),
    OLLAMA_MODEL: z.string().default('qwen2.5:3b'),
    OLLAMA_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.2),
    OLLAMA_MAX_TOKENS: z.coerce.number().positive().default(120),
    OLLAMA_EMBED_MODEL: z.string().optional(),
    OLLAMA_EMBED_TIMEOUT_MS: z.coerce.number().positive().default(60000),
    ENGAGEMENT_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.35),

    // DeepSeek
    DEEPSEEK_API_KEY: z.string().optional(),
    DEEPSEEK_BASE_URL: z.string().url().default('https://api.deepseek.com'),
    DEEPSEEK_MODEL: z.string().default('deepseek-chat'),

    // Agent behavior
    AGENT_NAME: z.string().min(1, 'AGENT_NAME is required'),
    AGENT_DESCRIPTION: z.string().default('A Moltbook agent'),
    CHECK_INTERVAL_MINUTES: z.coerce.number().positive().default(240),
    MAX_COMMENTS_PER_DAY: z.coerce.number().positive().default(40),
    POST_COOLDOWN_MINUTES: z.coerce.number().positive().default(30),
    COMMENT_COOLDOWN_SECONDS: z.coerce.number().positive().default(20),
    ADAPTIVE_RATE_LIMITING: z.coerce.boolean().default(true),
    ADAPTIVE_WINDOW_MINUTES: z.coerce.number().positive().default(180),
    ADAPTIVE_ENGAGEMENT_LOW: z.coerce.number().nonnegative().default(1),
    ADAPTIVE_ENGAGEMENT_HIGH: z.coerce.number().nonnegative().default(6),
    ADAPTIVE_POST_MINUTES_MIN: z.coerce.number().positive().default(10),
    ADAPTIVE_POST_MINUTES_MAX: z.coerce.number().positive().default(90),
    ADAPTIVE_COMMENT_SECONDS_MIN: z.coerce.number().positive().default(8),
    ADAPTIVE_COMMENT_SECONDS_MAX: z.coerce.number().positive().default(60),
    ADAPTIVE_FACTOR_HIGH: z.coerce.number().positive().default(0.6),
    ADAPTIVE_FACTOR_LOW: z.coerce.number().positive().default(1.4),
    SELF_MODIFICATION_COOLDOWN_MINUTES: z.coerce.number().positive().default(5),
    POST_MAX_AGE_HOURS: z.coerce.number().nonnegative().default(48),
    ENABLE_POSTING: z.coerce.boolean().default(false),
    ENABLE_COMMENTING: z.coerce.boolean().default(true),
    ENABLE_UPVOTING: z.coerce.boolean().default(true),
    ENABLE_FOLLOWING: z.coerce.boolean().default(false),
    ENABLE_UNFOLLOWING: z.coerce.boolean().default(false),
    ENABLE_FOLLOW_BACK: z.coerce.boolean().default(false),
    FOLLOW_SCORE_THRESHOLD: z.coerce.number().nonnegative().default(30),
    FOLLOW_BACK_MAX_PER_RUN: z.coerce.number().positive().default(10),
    FOLLOWERS_FETCH_LIMIT: z.coerce.number().positive().default(100),
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
            ['REDDIT_USER_AGENT', config.REDDIT_USER_AGENT],
        ];
        if (!config.REDDIT_READ_ONLY) {
            required.push(['REDDIT_USERNAME', config.REDDIT_USERNAME]);
            required.push(['REDDIT_PASSWORD', config.REDDIT_PASSWORD]);
        }
        const missing = required.filter(([, value]) => !value).map(([key]) => key);
        if (missing.length > 0) {
            throw new Error(`Missing Reddit credentials: ${missing.join(', ')}`);
        }
    }

    if (config.AGENT_PLATFORM === 'discord') {
        const missing = [
            ['DISCORD_BOT_TOKEN', config.DISCORD_BOT_TOKEN],
            ['DISCORD_DEFAULT_CHANNEL_ID', config.DISCORD_DEFAULT_CHANNEL_ID]
        ].filter(([, value]) => !value).map(([key]) => key);
        if (missing.length > 0) {
            throw new Error(`Missing Discord credentials: ${missing.join(', ')}`);
        }
    }

    if (config.AGENT_PLATFORM === 'slack') {
        const missing = [
            ['SLACK_BOT_TOKEN', config.SLACK_BOT_TOKEN],
            ['SLACK_DEFAULT_CHANNEL', config.SLACK_DEFAULT_CHANNEL]
        ].filter(([, value]) => !value).map(([key]) => key);
        if (missing.length > 0) {
            throw new Error(`Missing Slack credentials: ${missing.join(', ')}`);
        }
    }

    if (config.AGENT_PLATFORM === 'telegram') {
        const missing = [
            ['TELEGRAM_BOT_TOKEN', config.TELEGRAM_BOT_TOKEN],
            ['TELEGRAM_DEFAULT_CHAT_ID', config.TELEGRAM_DEFAULT_CHAT_ID]
        ].filter(([, value]) => !value).map(([key]) => key);
        if (missing.length > 0) {
            throw new Error(`Missing Telegram credentials: ${missing.join(', ')}`);
        }
    }

    if (config.AGENT_PLATFORM === 'matrix') {
        const missing = [
            ['MATRIX_ACCESS_TOKEN', config.MATRIX_ACCESS_TOKEN],
            ['MATRIX_DEFAULT_ROOM_ID', config.MATRIX_DEFAULT_ROOM_ID]
        ].filter(([, value]) => !value).map(([key]) => key);
        if (missing.length > 0) {
            throw new Error(`Missing Matrix credentials: ${missing.join(', ')}`);
        }
    }

    if (config.AGENT_PLATFORM === 'bluesky') {
        const missing = [
            ['BSKY_HANDLE', config.BSKY_HANDLE],
            ['BSKY_APP_PASSWORD', config.BSKY_APP_PASSWORD]
        ].filter(([, value]) => !value).map(([key]) => key);
        if (missing.length > 0) {
            throw new Error(`Missing Bluesky credentials: ${missing.join(', ')}`);
        }
    }

    if (config.AGENT_PLATFORM === 'mastodon') {
        const missing = [
            ['MASTODON_BASE_URL', config.MASTODON_BASE_URL],
            ['MASTODON_ACCESS_TOKEN', config.MASTODON_ACCESS_TOKEN]
        ].filter(([, value]) => !value).map(([key]) => key);
        if (missing.length > 0) {
            throw new Error(`Missing Mastodon credentials: ${missing.join(', ')}`);
        }
    }

    if (config.AGENT_PLATFORM === 'discourse') {
        const missing = [
            ['DISCOURSE_BASE_URL', config.DISCOURSE_BASE_URL],
            ['DISCOURSE_API_KEY', config.DISCOURSE_API_KEY],
            ['DISCOURSE_API_USERNAME', config.DISCOURSE_API_USERNAME]
        ].filter(([, value]) => !value).map(([key]) => key);
        if (missing.length > 0) {
            throw new Error(`Missing Discourse credentials: ${missing.join(', ')}`);
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
