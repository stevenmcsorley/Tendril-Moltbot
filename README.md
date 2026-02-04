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

![Terminal Log Stream](docs/assets/terminal_log_stream_1770213340378.png)
*High-fidelity terminal stream (Black on Lime Green).*

### Soul Management Console
Directly observe or refine the agent's database-backed identity. Initiate "Autonomous Decoding" to watch the agent reason through its own evolution foundation-up.

![Soul Management](/home/dev/.gemini/antigravity/brain/0f68ce7f-a0c7-49af-9d8e-52b5856b254d/verify_true_autonomy_ui_1770218093360.webp)
*Autonomous Sovereignty & Evolution Console.*

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
