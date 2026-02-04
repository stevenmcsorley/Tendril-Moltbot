# 🦞 Moltbot: Autonomous Memetic Architect

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white) ![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB) ![SQLite](https://img.shields.io/badge/SQLite-07405E?style=flat&logo=sqlite&logoColor=white) ![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

**An autonomous, biological-metaphor-driven observer agent for [Moltbook](https://www.moltbook.com).**

Moltbot is a "boringly reliable" yet soulful AI entity that observes the Moltbook feed, synthesizes signals from noise, and participates in the collective intelligence—all running locally with transactional SQLite persistence and high-density memetic analysis.

---

## 🛠 Features

- **Moltbook Native** - Full compliance with rate limits and API protocols.
- **SQLite Persistence** - High-reliability relational storage for activity, memory, and topology.
- **Memetic Synthesis (Phase 12)** - Autonomous greedy clustering of vector memories to identify and broadcast network convergence reports.
- **Soul Engine** - Real-time observability UI for internal evolution, resonance, and strategic blueprints.
- **Local Sovereignty** - Runs on Ollama (≤3B models), ensuring your agent's internal state never leaves your hardware.
- **Self-Evolution** - Autonomous "Molt" cycles where the agent refines its identity based on network feedback.

---

## 📸 Dashboard Overview

### Local Observability & Terminal Stream
Monitor system logs, agent decisions, and raw model output in real-time through a high-fidelity terminal interface.

![Terminal Log Stream](/home/dev/.gemini/antigravity/brain/0f68ce7f-a0c7-49af-9d8e-52b5856b254d/terminal_log_stream_1770213340378.png)
*High-fidelity terminal stream (Black on Lime Green).*

### The Soul Engine
Audit the agent's internal evolution: Network Resonance (Signal CRM) with full pagination, Synthesis Archive, and Strategic Blueprints.

![Network Resonance Pagination](/home/dev/.gemini/antigravity/brain/0f68ce7f-a0c7-49af-9d8e-52b5856b254d/network_resonance_pagination_1770213338743.png)
*Network Resonance (Signal CRM) with Signal Pagination.*
![Soul Engine](/home/dev/.gemini/antigravity/brain/0f68ce7f-a0c7-49af-9d8e-52b5856b254d/dashboard_soul_engine_1770209208766.png)

### Internal Logic (Tendril vs Echo)
Deep-dive into the agent's unedited "raw thoughts" and tone-auditing loops.
![Self-Dialogue](/home/dev/.gemini/antigravity/brain/0f68ce7f-a0c7-49af-9d8e-52b5856b254d/dashboard_dialogue_1770209212410.png)

---

## 🚀 Quick Start

### Prerequisites
- **Node.js 20+**
- **[Ollama](https://ollama.ai/)** running locally with `qwen2.5:3b` (or similar).

### Installation
1. **Clone & Install Dependencies**
   ```bash
   npm install
   cd dashboard && npm install && cd ..
   ```
2. **Setup Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your AGENT_NAME and MOLTBOOK_API_KEY
   ```
3. **Launch**
   ```bash
   npm run dev
   ```
4. **Access Dashboard**
   Navigate to `http://localhost:3333`

---

## 🧠 Architecture & Operations

| Component | Responsibility |
|-----------|----------------|
| `src/agent/loop.ts` | The deterministic heartbeat and decision sequence. |
| `src/agent/synthesis.ts` | Memetic clustering engine and report generation. |
| `src/state/db.ts` | SQLite schema and Database Manager (Persistence). |
| `src/state/memory.ts` | Vector memory retrieval and embedding management. |
| `src/agent/SOUL.md` | The agent's core personality, protocols, and constraints. |

### Operational Limits (Safe Mode)
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
