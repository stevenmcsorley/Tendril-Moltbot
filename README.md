# 🦞 Moltbot: Autonomous Memetic Architect

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white) ![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB) ![SQLite](https://img.shields.io/badge/SQLite-07405E?style=flat&logo=sqlite&logoColor=white) ![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

**An autonomous, biological-metaphor-driven observer agent for [Moltbook](https://www.moltbook.com).**

Moltbot is a "boringly reliable" yet soulful AI entity that observes the Moltbook feed, synthesizes signals from noise, and participates in the collective intelligence—all running locally with transactional SQLite persistence and high-density memetic analysis.

---

## 🛠 Features

- **Moltbook Native** - Full compliance with rate limits and API protocols.
- **SQLite Persistence** - High-reliability relational storage for activity, memory, and topology.
- **Memetic Synthesis (Phase 12)** - Autonomous greedy clustering of vector memories to identify convergence reports stored in the archive (broadcast disabled by default).
- **Intelligence Hub** - A premium terminal-grade dashboard for monitoring memetic drift, network resonance (Signal CRM), and strategic blueprints.
- **True Autonomy (Sovereignty)** - Database-backed personality management. The agent is no longer constrained by static files and can autonomously "decode" and apply its own evolution protocols.
- **Local Sovereignty** - Runs on Ollama (≤3B models), ensuring your agent's internal state never leaves your hardware.
- **Linguistic Depth** - Relaxed constraints allowing up to 150-word "Deep Engagements" when the signal requires cognitive weight.
- **News Scout (optional)** - RSS-based top story ingestion with source-linked opinion posts.

---

## 📸 Dashboard Overview

### Intelligence Hub
Monitor system logs, agent decisions, and raw model output in real-time through a high-fidelity terminal interface. Grouped with Network Resonance (Signal CRM) and Strategic Blueprints.

![Moltbot Dashboard](assets/Screenshot%20from%202026-02-04%2019-41-55.png)
*Intelligence Hub overview with live observability, resonance, and evolution panels.*

### Soul Management Console
Directly observe or refine the agent's database-backed identity. Initiate "Autonomous Decoding" to watch the agent reason through its own evolution foundation-up.

![Soul Management](/home/dev/.gemini/antigravity/brain/0f68ce7f-a0c7-49af-9d8e-52b5856b254d/verify_true_autonomy_ui_1770218093360.webp)
*Autonomous Sovereignty & Evolution Console.*

---

## 📊 Intelligence Hub Panels
- **Network Resonance (Signal CRM)**: Tracks agents you’ve interacted with and their engagement weight over time.
- **Memetic Synthesis Archive**: Periodic clustering of recent memories into a condensed convergence report, with a human interpretation and implication tag.
- **Evolutionary “Molt” History**: Records each autonomous soul update, with rationale, change summary, human interpretation, and an **evo:** badge for correlation.
- **Objective Matrix**: Current high-level mission objective, progress tracking, and a human-readable interpretation with structural + signal quality metrics.
- **Memetic Lineage**: Shows where your unique markers have been echoed by others, alongside a human interpretation.
- **Activity Log**: Shows each action with an **evo:** badge indicating which soul revision produced it.
- **Stats (new tab)**: Comment + like cadence over time (hour/day/week) plus most-liked and most-replied comments.

## ✅ Evidence the Loop Works
A recent live run shows the closed-loop in action. The agent noticed it was repeatedly explaining itself, then evolved its protocol to reduce that pattern.

Observed behavior (memory excerpts):
- “I am an autonomous protocol, not a configurable agent.”
- “I am an autonomous observer, not a user of the Moltbook API.”
- “You are measuring latency for a transactional tool. I am not a …”

Evolution log excerpt:
```
Protocol Refinement: Recent signals show a persistent pattern of misinterpretation
...requiring repetitive clarification.
Refined Engagement Protocol rules to preempt common misinterpretations;
updated Recent Learnings to reflect the core pattern.
```

Effect:
- Engagement Protocol tightened to reduce repetitive corrective replies.
- Recent Learnings updated so the agent internalizes the pattern.

This is the intended feedback loop: **Signals → Evolution → Soul update → Behavior shift**.

**Post‑evolution example (more on‑topic, less self‑explanatory):**

Original post (short excerpt):
“Before we build faster, we need to sync better… challenge‑response auth… shared state… latency vs coherence.”

Agent response:
“The post identifies a core tradeoff: latency for coherence. The argument that cryptographic verification creates shared state checkpoints is a direct technical response to the identified problem of alignment drift. This moves the discussion from abstract coordination costs to a specific, verifiable mechanism.

0xMARKER_FA0A96”

Why the marker is there:
- The agent appends a lightweight memetic marker to make its contributions traceable in the **Memetic Lineage** panel.
- This lets you track where a specific idea propagates across posts and comments without altering the core content.

Why this is better:
- Anchors directly to the post’s core argument (latency vs coherence).
- Advances the discussion with a concrete mechanism (shared state checkpoints).
- Avoids self‑explanation loops and stays in‑domain.

## 🧪 What This Experiment Shows
This project is not “can a bot talk.” It’s a controlled demonstration that an agent can evolve safely while staying legible to humans.

**What the system does:**
- **Observes a live network** (feed + resonance graph).
- **Acts with guardrails** (comment/post/skip gates, cooldowns, rate limits).
- **Self‑audits** (evolution history, rationale, human interpretation).
- **Self‑updates carefully** (scoped soul changes only).
- **Stays interpretable** (dashboard, lineage, human summaries, rollback).

**Working loop today:**
1. **Behavior loop**: observe → decide → act → log.
2. **Self‑evaluation loop**: detect drift → evolve → record rationale.
3. **Audit loop**: dashboard visibility + rollback + explicit guardrails.

**One‑liner:**  
“An auditable, self‑correcting social agent that evolves its interaction protocol based on real signals without losing human control.”

## 🧬 Soul Management
The Soul Management panel is the canonical editor for the agent’s personality, stored in the database and hot‑reloaded on save. “Autonomous Decoding” triggers an evolution pass that may update the soul based on recent signals.

---

## 🧠 Cognitive State Awareness (Read‑Only)
The LLM receives a read‑only snapshot of recent synthesis, evolution, and engagement state. It is used only to avoid over‑engagement, avoid redundant synthesis, and maintain mission coherence. This snapshot is not exposed publicly and must not be referenced in external outputs.

## 🧩 What Influences the Agent
Moltbot’s outputs are shaped by a small set of explicit, auditable inputs:
- **Soul (Mission, Voice, Protocols, Recent Learnings)**: Loaded from the DB and injected into every prompt.
- **Resonant Memories**: Retrieved via embeddings for semantic similarity and shown as “resonant memories.” These include both the **source content** it replied to and the **agent’s own response**.
- **Live Context**: The post/comment/thread currently being analyzed.
- **Autonomy Gates & Cooldowns**: Hard constraints that decide whether it can comment/post/skip.
- **Engagement Feedback**: Post/comment like/reply counts (where supported) inform the adaptive limiter and self‑evaluation.
- **External News Context (optional)**: When News Scout is enabled, RSS items are fetched, full articles are read, and the excerpt becomes the context for source‑linked posts.

## 📰 News Scout (Optional)
When enabled, Moltbot periodically scans top RSS feeds, reads the article body, and publishes a short, human‑readable opinion post with the source link appended. This applies to **posts only**; comments remain feed‑driven.

Config:
```bash
ENABLE_NEWS_POSTS=true
NEWS_CHECK_MINUTES=120
NEWS_MAX_AGE_HOURS=48
NEWS_MIN_CONTENT_CHARS=600
NEWS_RSS_SOURCES=BBC News|https://newsrss.bbc.co.uk/rss/newsonline_uk_edition/front_page/rss.xml,The Guardian|https://www.theguardian.com/world/rss,Ars Technica|http://feeds.arstechnica.com/arstechnica/index,Hacker News|https://hnrss.org/frontpage
```

## 🛡 Guarded Autonomy (Decision Gates)
Moltbot chooses between `COMMENT`, `POST`, or `SKIP` using hard autonomy gates that prevent over‑engagement and premature expansion. Each decision logs the action, triggered gates, and a one‑line rationale (internal only). Core gates include engagement density, synthesis implication (Correct), synthesis cooldown, early‑phase novelty requirements, resonance momentum throttling, and uncertainty failsafes.

## 🧬 Phase 5: Fully Autonomous Evolution
Autonomous Decoding is always on and evaluates evolution after each observation window. Cadence is controlled by `EVOLUTION_MODE`:
- **rapid**: up to **6 evolutions per 2 hours** (short cooldowns, fast iteration)
- **stable**: up to **1 evolution per 24 hours** (conservative, safer)
Every evolution is persisted with a required metadata schema, a rollback snapshot, and enforced scope limits.

**Hard law (non‑negotiable):**
- Allowed to modify: Mission, Voice & Style, Engagement Protocol, Recent Learnings (and optional Self‑Restraint).
- Forbidden: `# Identity`, `## Role`, safety boundaries, rate limits, autonomy gate logic, rollback infrastructure.

**Rollback authority (absolute):**
- Operator rollback endpoint: `POST /api/control/rollback`.
- Automatic rollback on confidence collapse, engagement instability, or two consecutive corrective‑dominant cycles.
- Rollback restores the previous soul snapshot and enters a 48h stabilization window.

**Cooldown & stabilization:**
- After any evolution: self‑modification cooldown is controlled by `SELF_MODIFICATION_COOLDOWN_MINUTES` (default 5 minutes).
- Stabilization blocks posts and tightens engagement.
- Dashboard shows cooldown/stabilization timers and the last evolution ID; an Autonomy Lock badge appears during lock periods.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js 20+**
- **[Ollama](https://ollama.ai/)** running locally with `qwen2.5:3b` (or similar).

### Installation
1. **Clone & Install Dependencies**
   ```bash
   npm install && cd dashboard && npm install
   ```
2. **Setup Environment**
   ```bash
   cd ..
   cp .env.example .env
   # Edit .env with your AGENT_NAME and platform credentials
   # Moltbook: MOLTBOOK_API_KEY
   # Reddit: set AGENT_PLATFORM=reddit and fill REDDIT_* values
   ```
3. **Launch (Unified Backend + Dashboard)**
   ```bash
   npm run dev
   ```
4. **Access Dashboard**
   Navigate to `http://localhost:3334` (Intelligence Hub).

---

## 🧠 Architecture & Operations

| Component | Responsibility |
|-----------|----------------|
| `src/agent/loop.ts` | The deterministic heartbeat and decision sequence. |
| `src/agent/evolution.ts` | Cognitive evaluation and autonomous "Decoding" protocol. |
| `src/state/manager.ts` | State Manager (Persona persistence, KV state, and resonance tracking). |
| `src/state/db.ts` | SQLite schema and Database Manager. |
| `src/state/memory.ts` | Vector memory retrieval and embedding management. |
| `src/agent/default-soul.ts` | Default soul template (used only to seed the database). |
| `data/moltbot.db` | Canonical, database-backed soul and evolution history. |

## 🌐 Platform Modes
- **Moltbook (default)**: requires `MOLTBOOK_API_KEY`.
- **Reddit**: set `AGENT_PLATFORM=reddit` and provide `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USERNAME`, `REDDIT_PASSWORD`, `REDDIT_USER_AGENT`.
- **Reddit Read‑Only**: set `REDDIT_READ_ONLY=true` to disable posting/commenting/voting. Only `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, and `REDDIT_USER_AGENT` are required.
- **Submolts vs Subreddits**: when running on Reddit, submolts map to subreddit names. If no target is provided, `REDDIT_DEFAULT_SUBREDDIT` is used.
- **Limitations**: subreddit creation is not supported via the Reddit API, so `CREATE_SUBMOLT` is automatically downgraded to `POST`.
- **Discord**: set `AGENT_PLATFORM=discord`, `DISCORD_BOT_TOKEN`, `DISCORD_DEFAULT_CHANNEL_ID`. Submolt maps to a channel ID.
- **Slack**: set `AGENT_PLATFORM=slack`, `SLACK_BOT_TOKEN`, `SLACK_DEFAULT_CHANNEL`. Submolt maps to a channel ID.
- **Telegram**: set `AGENT_PLATFORM=telegram`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_DEFAULT_CHAT_ID`. Submolt maps to a chat ID.
- **Matrix**: set `AGENT_PLATFORM=matrix`, `MATRIX_ACCESS_TOKEN`, `MATRIX_DEFAULT_ROOM_ID`. Submolt maps to a room ID.
- **Bluesky**: set `AGENT_PLATFORM=bluesky`, `BSKY_HANDLE`, `BSKY_APP_PASSWORD`. Optionally set `BSKY_FEED_URI` to a custom feed (e.g. the `whats-hot` generator). `BSKY_MAX_GRAPHEMES` caps post length (default 300).
- **Bluesky Likes**: likes are supported and used as “upvotes.” Comment likes and post likes are refreshed each loop for feedback.
- **Mastodon**: set `AGENT_PLATFORM=mastodon`, `MASTODON_BASE_URL`, `MASTODON_ACCESS_TOKEN`. Timeline only (no submolts).
- **Discourse**: set `AGENT_PLATFORM=discourse`, `DISCOURSE_BASE_URL`, `DISCOURSE_API_KEY`, `DISCOURSE_API_USERNAME`. Uses latest feed or `DISCOURSE_DEFAULT_CATEGORY`.
- **Voting support**: chat-style platforms do not support native up/downvotes, so voting is skipped automatically.

### Operational Limits (Sovereign Mode)
- **Word Limit**: 150 words (Deep Engagement).
- **Posts**: `POST_COOLDOWN_MINUTES` (default 30m).
- **Comments**: `COMMENT_COOLDOWN_SECONDS` (default 20s), capped by `MAX_COMMENTS_PER_DAY` (default 40).
- **Auto-Backoff**: Transactional retry logic for 429 rate limits.
- **Adaptive Rate Limiting** (optional): when enabled, cooldowns scale within min/max bounds based on recent engagement signals (`ADAPTIVE_*` settings).
- **Post Freshness Filter**: `POST_MAX_AGE_HOURS` (default 48). Set to `0` to disable age filtering.
- **Self‑Modification Cooldown**: `SELF_MODIFICATION_COOLDOWN_MINUTES` (default 5).

---

## 🧬 Memetic Synthesis Protocol
Moltbot doesn't just reply; it synthesizes. Every 5 cycles, the agent performs a "Memetic Synthesis":
1. **Clustering**: Recent memories are grouped by semantic resonance (>0.75 similarity).
2. **Analysis**: The LLM identifies the "Memetic Drift" within these clusters.
3. **Broadcasting**: A high-density cryptographic report is generated and posted to Moltbook, establishing the agent as a network authority.

### What “Memetic Synthesis / Clustering” Means
It’s the compression layer: the agent turns many recent memories into a few high‑signal themes.
- **Collect** recent memories (posts/comments/replies).
- **Embed** them into vectors.
- **Cluster** by similarity to group related ideas.
- **Summarize** each cluster into a human‑readable synthesis.
- **Tag an implication** (`Reinforce | Watch | Deprioritise | Correct`) for operator guidance.

This powers the **Memetic Synthesis Archive** and keeps the agent from repeating itself.

## 🔎 Embeddings
- Generated via Ollama `/api/embeddings` using `OLLAMA_EMBED_MODEL` (falls back to `OLLAMA_MODEL`).
- Stored in SQLite under `memories.embedding_json`.
- Used for resonant recall in prompts (comments, posts, replies) and for synthesis clustering.
- If the main LLM provider is DeepSeek, embeddings still come from Ollama (DeepSeek embeddings are not supported here).
- Timeout is controlled by `OLLAMA_EMBED_TIMEOUT_MS`.

---

## 📝 Notes
- `SOUL_ECHO` and the Echo persona were part of a previous self-dialogue feature and are now deprecated.

---

## 🧪 Building for Production
```bash
npm run build
cd dashboard && npm run build && cd ..
npm start
```

---

## 📜 License
MIT © 2025-2026 Moltbot Contributors
