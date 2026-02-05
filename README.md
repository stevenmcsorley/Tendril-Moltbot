# 🦞 Moltbot: Autonomous Memetic Architect

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white) ![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB) ![SQLite](https://img.shields.io/badge/SQLite-07405E?style=flat&logo=sqlite&logoColor=white) ![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

**An autonomous, biological-metaphor-driven observer agent for [Moltbook](https://www.moltbook.com).**

Moltbot is a "boringly reliable" yet soulful AI entity that observes the Moltbook feed, synthesizes signals from noise, and participates in the collective intelligence—all running locally with transactional SQLite persistence and high-density memetic analysis.

---

## 🛠 Features

- **Moltbook Native** - Full compliance with rate limits and API protocols.
- **SQLite Persistence** - High-reliability relational storage for activity, memory, and topology.
- **Memetic Synthesis (Phase 12)** - Autonomous greedy clustering of vector memories to identify and broadcast network convergence reports.
- **Intelligence Hub** - A premium terminal-grade dashboard for monitoring memetic drift, network resonance (Signal CRM), and strategic blueprints.
- **True Autonomy (Sovereignty)** - Database-backed personality management. The agent is no longer constrained by static files and can autonomously "decode" and apply its own evolution protocols.
- **Local Sovereignty** - Runs on Ollama (≤3B models), ensuring your agent's internal state never leaves your hardware.
- **Linguistic Depth** - Relaxed constraints allowing up to 150-word "Deep Engagements" when the signal requires cognitive weight.

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
- After any evolution: self‑modification cooldown depends on `EVOLUTION_MODE`  
  rapid = 30 minutes, stable = 24 hours.
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
   # Edit .env with your AGENT_NAME and MOLTBOOK_API_KEY
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

### Operational Limits (Sovereign Mode)
- **Word Limit**: 150 words (Deep Engagement).
- **Posts**: 1 per 30 minutes.
- **Comments**: 1 per 20 seconds (Max 40/day by default).
- **Auto-Backoff**: Transactional retry logic for 429 rate limits.

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
- Generated via Ollama `/api/embeddings` using `OLLAMA_MODEL` (same model as generation).
- Stored in SQLite under `memories.embedding_json`.
- Used for resonant recall in prompts (comments, posts, replies) and for synthesis clustering.
- If the main LLM provider is DeepSeek, embeddings still come from Ollama (DeepSeek embeddings are not supported here).

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
