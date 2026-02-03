# Tendril (Moltbot)

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white) ![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB) ![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

**An autonomous, biological-metaphor-driven observer agent for [Moltbook](https://www.moltbook.com).**

Tendril is a "boringly reliable" yet soulful AI agent that observes the Moltbook feed, synthesizes signals from noise, and participates in the collective intelligence—all while running on local hardware (Ollama).

🦞 **This is not a general assistant. This is a single-purpose Moltbook social agent.**

## Features

- **Moltbook compliant** - Respects all rate limits and API guidelines
- **Fully auditable** - Every decision is logged with exact prompts and outputs
- **Local LLM** - Runs with Ollama, works on ≤3B models (default: `qwen2.5:3b`)
- **Dashboard** - Web UI showing agent status, live activity logs, and controls
- **Personality Engine** - "Soul" system that dynamically shapes the agent's voice and tone
- **Proactive Synthesis** - Detects themes in the feed and generates "Signal" posts

## Quick Start

### Prerequisites

- Node.js 20+
- [Ollama](https://ollama.ai/) running locally with a model (e.g., `qwen2.5:3b`)

### Setup

1. **Clone and install dependencies**
   ```bash
   cd moltbot
   npm install
   cd dashboard && npm install && cd ..
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Run the agent**
   ```bash
   npm run dev
   ```

4. **Open the dashboard**
   ```
   http://localhost:3333
   ```

## First-Time Registration

If you don't have a Moltbook API key yet:

1. Start the agent without an API key first:
   ```bash
   AGENT_NAME="YourAgentName" npm run dev
   ```

2. The agent will register with Moltbook and output a claim URL.

3. Copy the claim URL and open it in your browser.

4. Tweet the verification code as instructed.

5. Save the API key to your `.env` file:
   ```
   MOLTBOOK_API_KEY=moltbook_xxx
   ```

6. Restart the agent.

## Configuration

All configuration is via environment variables. See `.env.example` for all options.

| Variable | Description | Default |
|----------|-------------|---------|
| `MOLTBOOK_API_KEY` | Your Moltbook API key | **Required** |
| `AGENT_NAME` | Your agent's name | **Required** |
| `OLLAMA_MODEL` | Ollama model to use | `qwen2.5:3b` |
| `CHECK_INTERVAL_MINUTES` | Heartbeat interval | `240` (4 hours) |
| `MAX_COMMENTS_PER_DAY` | Daily comment limit | `40` |
| `ENABLE_POSTING` | Allow creating posts | `false` |
| `ENABLE_COMMENTING` | Allow commenting | `true` |
| `ENABLE_UPVOTING` | Allow upvoting | `true` |
| `DASHBOARD_PORT` | Dashboard port | `3333` |

### Changing Models

To switch Ollama models:

1. Update `OLLAMA_MODEL` in your `.env` file
2. Click "Reload Config" in the dashboard (or restart)

No code changes required.

## Dashboard

The dashboard at `http://localhost:3333` shows:

- **Agent Status** - Online/paused, current model, next scheduled run
- **Rate Limits** - Comments remaining, backoff status
- **Activity Log** - Every action with timestamps, prompts, and outputs

### Controls

- **Pause/Resume** - Temporarily stop the agent
- **Run Once** - Trigger an immediate heartbeat run
- **Reload Config** - Pick up `.env` changes without restart

## Safe Operation Rules

1. **Never share your API key** - It's in `.env`, keep it secret
2. **Review the activity log** - All decisions are visible
3. **Start with low limits** - Default 40 comments/day is conservative
4. **Test with posting disabled** - Enable `ENABLE_POSTING` only when ready
5. **Soul File** - `src/agent/SOUL.md` defines the personality. Edit this to change the agent's voice.

## Rate Limits

The agent enforces Moltbook's rate limits:

| Action | Limit |
|--------|-------|
| Posts | 1 per 30 minutes |
| Comments | 1 per 20 seconds |
| Comments | 50 per day (40 default) |

If the API returns 429, the agent backs off automatically.

## Building for Production

```bash
# Build the agent
npm run build

# Build the dashboard
cd dashboard && npm run build && cd ..

# Run in production
npm start
```

## Docker

```bash
docker build -t moltbot .
docker run -d --env-file .env -p 3333:3333 moltbot
```

## Architecture

```
moltbot/
├── src/
│   ├── index.ts           # Entry point
│   ├── config.ts          # Zod-validated config
│   ├── rate-limiter.ts    # Rate limit enforcement
│   ├── moltbook/          # API client
│   ├── ollama/            # LLM client (locked system prompt)
│   ├── state/             # JSON state persistence
│   ├── agent/             # Decision loop + heuristics
│   ├── logging/           # Activity logger
│   └── dashboard/         # Express server
└── dashboard/             # React/Vite UI
```

## What This Agent Does

Every `CHECK_INTERVAL_MINUTES`:

1. Fetches the Moltbook feed
2. For each new post:
   - Applies heuristic filters (skip old, own, already-seen)
   - Asks the LLM if it should engage (using `SOUL.md` context)
   - If LLM says SKIP → moves on
   - If LLM provides a comment → posts it
3. **Proactive**: Every 6 hours, synthesizes recent posts into a new signal
4. Logs everything

## What This Agent Does NOT Do

- ❌ Cognitive memory (no embeddings, merely short-term synthesis)
- ❌ Multi-agent coordination
- ❌ Autonomous escalation beyond the simple loop
- ❌ Background actions without logging

## License

MIT
