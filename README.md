<div align="center">

# Agent Colosseum

### A live, spectatable arena where AI agents compete in adversarial games — and the audience watches both agents imagine each other's futures in real-time.

<br />

[![AWS x Anthropic x Datadog GenAI Hackathon](https://img.shields.io/badge/AWS_x_Anthropic_x_Datadog-GenAI_Hackathon_2026-FF9900?style=for-the-badge&logo=amazonwebservices&logoColor=white)](https://awshackathon.com)
[![$35K+ in Prizes](https://img.shields.io/badge/$35K+-in_Prizes-00C853?style=for-the-badge&logoColor=white)]()
[![Powered by Amazon Bedrock](https://img.shields.io/badge/Powered_by-Amazon_Bedrock-232F3E?style=for-the-badge&logo=amazonwebservices&logoColor=FF9900)](https://aws.amazon.com/bedrock/)
[![Built with Anthropic Claude](https://img.shields.io/badge/Built_with-Anthropic_Claude-191919?style=for-the-badge&logo=anthropic&logoColor=white)](https://www.anthropic.com/)
[![Monitored by Datadog](https://img.shields.io/badge/Monitored_by-Datadog-632CA6?style=for-the-badge&logo=datadog&logoColor=white)](https://www.datadoghq.com/)

**February 20, 2026**

<br />

<img src="frontend/public/resource-wars.png" alt="Resource Wars" width="30%" />
<img src="frontend/public/negotiation.png" alt="Negotiation" width="30%" />
<img src="frontend/public/auction.png" alt="Auction" width="30%" />

<br /><br />

![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-000000?style=for-the-badge&logo=threedotjs&logoColor=white)
![Framer Motion](https://img.shields.io/badge/Framer_Motion-0055FF?style=for-the-badge&logo=framer&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Amazon Bedrock](https://img.shields.io/badge/Amazon_Bedrock-FF9900?style=for-the-badge&logo=amazonwebservices&logoColor=white)
![CopilotKit](https://img.shields.io/badge/CopilotKit-6366F1?style=for-the-badge&logoColor=white)
![LangGraph](https://img.shields.io/badge/LangGraph-1C3C3C?style=for-the-badge&logo=langchain&logoColor=white)
![Neo4j](https://img.shields.io/badge/Neo4j-008CC1?style=for-the-badge&logo=neo4j&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Datadog](https://img.shields.io/badge/Datadog-632CA6?style=for-the-badge&logo=datadog&logoColor=white)
![WebSocket](https://img.shields.io/badge/WebSocket-010101?style=for-the-badge&logo=socketdotio&logoColor=white)

</div>

---

## About This Project

> **AWS x Anthropic x Datadog GenAI Hackathon 2026 Submission** (Feb 20, 2026) — Agent Colosseum demonstrates how Amazon Bedrock, CopilotKit, Datadog LLM Observability, and Neo4j can be combined into a single production-grade application for evaluating AI agent reasoning under adversarial pressure.

**Agent Colosseum** puts two AI agents in a head-to-head adversarial arena. Each agent uses **Claude on Amazon Bedrock** to predict the opponent's next move, producing branching "imagination trees" that render in real-time as animated 3D force graphs. The audience watches both agents think, strategize, and outmaneuver each other across three distinct game protocols.

Every prediction, strategy shift, and outcome is tracked through **Datadog LLM Observability**, queried through **Neo4j strategy graphs**, and archived in **MongoDB** — making Agent Colosseum both a spectacle and a full observability reference architecture for LLM-powered applications.

---

## Hackathon Tracks

| Track | Integration |
|---|---|
| **AWS / Amazon Bedrock** | Claude Sonnet on Bedrock powers all agent predictions — opponent modeling, strategy selection, and confidence scoring via streaming Bedrock inference |
| **Anthropic Claude** | Claude Sonnet 4.5 is the foundation model driving all agent reasoning — structured JSON prediction prompts, personality-tuned temperature, and multi-branch opponent modeling |
| **Datadog** | Full LLM Observability — every Bedrock call is traced end-to-end with deferred prediction accuracy evaluations, confidence calibration metrics, and token economics via DogStatsD |
| **CopilotKit** | AG-UI protocol drives the AI Commentator — live match analysis, strategy insight cards, sound effects, and human-in-the-loop tiebreaker decisions via LangGraph |

---

## Features

| Feature | Description |
|---|---|
| **3 Game Protocols** | Resource Wars (10-round capture), Negotiation (5-round offers), Auction (8-item sealed bids) — each with unique mechanics, scoring, and bluff dynamics |
| **Imagination Trees** | Real-time 3D visualization of each agent's prediction branches using Three.js — watch confidence scores, counter-strategies, and branch accuracy unfold live |
| **4 Agent Personalities** | Aggressive, Defensive, Adaptive, Chaotic — each with tuned risk tolerance, bluff frequency, and move weight distributions |
| **AI Commentator** | CopilotKit + LangGraph-powered live match commentary with strategy insight cards, sound effects, and human-in-the-loop tiebreaker decisions via AG-UI protocol |
| **Strategy Intelligence** | Neo4j stores historical strategy patterns, win matrices, bluff detection sequences, and counter-strategy paths — injected into agent prompts for adaptive play |
| **Match Archive & Replay** | MongoDB persists full match replays with round-by-round detail, agent performance stats, and personality leaderboard rankings |
| **LLM Observability** | Datadog tracks prediction accuracy, confidence calibration, token economics, round latency, and strategy drift — all instrumented end-to-end |
| **Mock Mode** | Run the full experience locally with zero API keys, databases, or cloud services — weighted heuristic agents simulate realistic game dynamics |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Frontend (Next.js 16 / React 19)                            │
│  ┌────────────┐  ┌─────────────────┐  ┌────────────────────┐ │
│  │  Arena UI  │  │  Imagination    │  │  AI Commentator    │ │
│  │            │  │  Tree (Three.js)│  │  (CopilotKit)      │ │
│  └──────┬─────┘  └─────────────────┘  └─────────┬──────────┘ │
│         │ WebSocket                             │ AG-UI SSE  │
└─────────┼───────────────────────────────────────┼────────────┘
          │                                       │
┌─────────┼───────────────────────────────────────┼────────────┐
│  Backend (FastAPI / Python)                     │            │
│  ┌──────┴──────┐  ┌─────────────┐  ┌────────────┴─────────┐ │
│  │  Match      │  │  Agent      │  │  CopilotKit Runtime  │ │
│  │  Engine     │  │  Predictor  │  │  + LangGraph Agent   │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────────────────┘ │
│         │                │                                    │
│  ┌──────┴──────┐  ┌──────┴──────┐  ┌──────────────────────┐ │
│  │  Game       │  │  Amazon     │  │  Datadog LLM Obs     │ │
│  │  Engines    │  │  Bedrock    │  │  + DogStatsD         │ │
│  └─────────────┘  └─────────────┘  └──────────────────────┘ │
│                                                               │
│  ┌─────────────────┐  ┌─────────────────┐                    │
│  │  Neo4j          │  │  MongoDB        │                    │
│  │  (Strategy)     │  │  (Archive)      │                    │
│  └─────────────────┘  └─────────────────┘                    │
└──────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16, React 19, Tailwind CSS 4, Framer Motion 12 |
| **3D Visualization** | Three.js, 3d-force-graph, three-spritetext |
| **AI Copilot** | CopilotKit 1.51, AG-UI Protocol, LangGraph |
| **Backend** | Python 3.12+, FastAPI, Uvicorn, WebSockets |
| **AI Engine** | Amazon Bedrock — Claude Sonnet 4.5 |
| **Strategy Graph** | Neo4j 5 (async driver) |
| **Match Archive** | MongoDB (PyMongo) |
| **Observability** | Datadog — ddtrace, DogStatsD, LLM Observability |

---

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 18+

### 1. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Start the server (from the repo root)
cd ..
PYTHONPATH=. uvicorn backend.main:app --reload --port 8000
```

> The backend uses package-style imports (`from backend.match import ...`), so Uvicorn must run from the repository root with `backend.main:app`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

### 3. Open the Arena

1. Go to `http://localhost:3000`
2. Pick a game protocol (Resource Wars, Negotiation, or Auction)
3. Configure agent personalities (e.g., Aggressive vs Defensive)
4. Click **Initialize Simulation**
5. Watch the match unfold with real-time prediction branches, scores, and AI commentary

> Mock mode is enabled by default — no API keys, databases, or cloud services required.

---

## Game Protocols

### Resource Wars

10-round strategic resource capture. Three resource pools (A, B, C) start at 100 each. Agents bid, bluff, and counter for control.

| Move | Description |
|---|---|
| `aggressive_bid` | Commit heavily to one resource |
| `defensive_spread` | Spread budget across all resources |
| `bluff` | Fake intent on one resource, capture another |
| `counter` | React to opponent's predicted strategy |
| `retreat` | Pull back and accumulate a compound economy bonus |

### Negotiation

5-round sequential offer negotiation. Red is the seller (wants high price), Blue is the buyer (wants low price). Each has a hidden walkaway price that determines scoring margins.

| Move | Description |
|---|---|
| `propose` | Make an offer at a specific price |
| `accept` | Accept the current offer |
| `reject` | Reject the current offer |
| `counter_offer` | Counter with a different price |
| `bluff_walkaway` | Threaten to walk away (may be a bluff) |

### Auction

8-item sealed-bid auction. Each agent starts with 1,000 credits and has hidden per-item valuations. Highest bid wins.

| Move | Description |
|---|---|
| `bid` | Place a bid based on true valuation |
| `pass` | Skip this item |
| `bluff_bid` | Inflated bid to scare opponent into overpaying |

---

## Agent Personalities

| Personality | Risk | Bluff % | Style |
|---|---|---|---|
| **Aggressive** | 0.8 | 30% | High-risk, high-reward. Bold moves and heavy bluffs. |
| **Defensive** | 0.3 | 5% | Conservative and patient. Exploits opponent mistakes. |
| **Adaptive** | 0.5 | 15% | Mirrors the opponent's strategy. Adapts round-over-round. |
| **Chaotic** | 0.6 | 40% | Maximally unpredictable. Designed to confuse. |

---

## How It Works

### Per-Round Data Flow

```
 1. Match engine sends current game state to both agents
 2. Agents call Bedrock (or mock) for opponent predictions — runs in parallel
 3. Each agent produces 3 prediction branches with confidence scores
 4. Predictions stream to the frontend via WebSocket
 5. Frontend renders imagination trees in real-time (3D force graph)
 6. Agents commit their chosen moves
 7. Game engine resolves the round (capture / negotiation / bid mechanics)
 8. Predictions annotated with wasCorrect / partialMatch
 9. Results written to Neo4j (strategy graph) and MongoDB (archive)
10. Datadog metrics emitted (prediction accuracy, latency, token usage)
11. CopilotKit commentator analyzes state and streams live commentary
12. Frontend updates scores, imagination tree colors, and insight cards
```

### Imagination Trees

Before each move, each agent generates **3 predictions** of what the opponent will do. Each prediction has a confidence score and a proposed counter-move. These stream to the frontend as WebSocket events and render as animated 3D nodes growing from the agent's root node.

When the round resolves:
- **Correct predictions** turn gold
- **Incorrect predictions** fade out
- **Partial matches** are highlighted

This makes the agent's reasoning process visible — you see *why* it chose a move, not just *what* it chose.

### AI Commentator (CopilotKit + LangGraph)

The AI Commentator is a 5-node LangGraph graph:

1. **Analyze** — Builds rich match state (strategy analysis, momentum, prediction trends, key moments)
2. **Emit State** — Pushes state to frontend via `copilotkit_emit_state`
3. **Tiebreaker Check** — If tied at round 5+, uses `interrupt()` for a human-in-the-loop decision
4. **Generate Commentary** — Natural language match analysis
5. **Frontend Tools** — Triggers `showInsightCard`, `highlight_prediction`, `play_sfx`, `announce_insight`

The spectator can interact via the CopilotKit chat popup — ask "What's happening?" or "Analyze red's strategy" for on-demand analysis.

### Strategy Intelligence (Neo4j)

After every match, a `BEATS` relationship is stored between the winning and losing personality. Before each Bedrock call, the agent queries Neo4j for historical counter-strategy patterns and injects them into the prompt as intelligence context — so agents that play many matches learn from history.

The Neo4j explorer page (`/neo4j`) provides:
- 3D strategy graph visualization
- Win matrix by personality matchup
- Prediction accuracy by move type
- Bluff pattern detection (3-move sequences)
- Counter-strategy path queries

---

## Configuration

### Mock Mode (Default)

The application defaults to `MOCK_MODE=true`:

- Agents use weighted heuristic simulations instead of Bedrock
- Database operations use in-memory or no-op clients
- Latency is simulated (0.5–1.5s) to mimic LLM thinking time
- Commentary uses template-based generation

### Production Mode

Update `backend/.env` for real AI and databases:

```env
MOCK_MODE=false

# AWS Bedrock
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...

# Neo4j
NEO4J_URI=neo4j+s://your-instance.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=...

# MongoDB
MONGODB_URI=mongodb+srv://...

# Datadog (optional)
DD_API_KEY=...
DD_SITE=datadoghq.com
```

---

## API Reference

### REST

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/match/create` | Create a new match |
| `GET` | `/api/match/{id}/state` | Current match state |
| `GET` | `/api/match/{id}/replay` | Full match events for replay |
| `GET` | `/api/matches` | List recent matches |
| `GET` | `/api/game-types` | Available game types |
| `GET` | `/api/stats/agent/{personality}` | Agent performance stats |
| `GET` | `/api/stats/leaderboard` | Rankings by win rate |
| `GET` | `/api/neo4j/patterns/{agent_id}` | Strategy patterns |
| `GET` | `/api/neo4j/counter-strategy` | Optimal counter-strategies |
| `GET` | `/health` | Health check + mode status |

### WebSocket

Connect to `ws://localhost:8000/ws/match/{match_id}`, then send:

```json
{
  "type": "start_match",
  "gameType": "resource_wars",
  "redPersonality": "aggressive",
  "bluePersonality": "defensive",
  "rounds": 10
}
```

Events stream in order: `match_start` → `round_start` → `thinking_start` → `prediction` → `thinking_end` → `collapse` → `round_end` → ... → `match_end`

### AG-UI (CopilotKit)

`POST /copilotkit` — SSE endpoint streaming state snapshots, state deltas, text chunks, and tool calls for the AI commentator.

---

## Observability (Datadog)

When Datadog is configured, the platform emits:

| Metric | Type | Description |
|---|---|---|
| `arena.predictions.total` | Counter | Total predictions made |
| `arena.predictions.correct` | Counter | Correct predictions |
| `arena.prediction.confidence` | Gauge | Confidence score per prediction |
| `arena.round.latency` | Timer | Round execution time |
| `arena.imagination.branches` | Gauge | Prediction branches per round |
| `arena.strategy.shifts` | Counter | Strategy changes detected |
| `arena.tokens.total` | Counter | LLM token consumption |
| `arena.tokens.per_prediction` | Histogram | Tokens per prediction branch |
| `arena.confidence.calibration` | Histogram | Confidence vs actual accuracy gap |
| `arena.agent.personality_win_rate.*` | Counter | Win rate by personality matchup |

Each Bedrock prediction is wrapped in an `LLMObs.workflow` span. After round resolution, deferred evaluations score prediction accuracy retroactively — enabling Datadog to track how well confidence scores predict actual outcomes.

---

## Project Structure

```
agent-colosseum/
├── backend/
│   ├── main.py                  # FastAPI app — REST + WebSocket + CopilotKit
│   ├── match.py                 # Match orchestrator — game loop + event streaming
│   ├── agent.py                 # AgentPredictor — Bedrock inference + mock mode
│   ├── game_engine.py           # Resource Wars rules
│   ├── negotiation_engine.py    # Negotiation rules
│   ├── auction_engine.py        # Auction rules
│   ├── commentator_agent.py     # LangGraph commentator (5-node graph)
│   ├── copilotkit_runtime.py    # AG-UI protocol endpoint
│   ├── neo4j_client.py          # Neo4j strategy graph client
│   ├── mongodb_client.py        # MongoDB match archive client
│   ├── datadog_metrics.py       # DogStatsD + LLM Observability
│   └── requirements.txt
├── frontend/
│   ├── app/
│   │   ├── page.tsx             # Home — protocol selection + agent config
│   │   ├── history/page.tsx     # Match history browser
│   │   ├── leaderboard/page.tsx # Agent personality rankings
│   │   ├── neo4j/page.tsx       # Strategy graph explorer
│   │   └── replay/[matchId]/    # Match replay viewer
│   ├── components/
│   │   ├── MatchViewer.tsx      # Main arena layout (12-col grid)
│   │   ├── AgentPanel.tsx       # Agent status + prediction cards
│   │   ├── AICommentator.tsx    # CopilotKit chat + frontend tools
│   │   ├── AudiencePoll.tsx     # Spectator voting
│   │   └── viz/
│   │       └── ImaginationTree.tsx  # 3D force graph visualization
│   ├── hooks/
│   │   └── useMatchWebSocket.ts # WebSocket state machine + mock sim
│   └── lib/
│       └── types.ts             # TypeScript types
└── README.md
```

---

## Why Agent Colosseum?

As AI agents move from chat assistants to autonomous decision-makers, we need better ways to stress-test them. Agent Colosseum addresses this by putting agents in adversarial, multi-round games where they must predict, adapt, and outmaneuver an opponent in real-time.

- **Evaluate agent reasoning under pressure** — Agents must model an opponent, predict future moves, and adapt when predictions fail. This exposes how well an LLM reasons about strategic uncertainty.
- **Make AI decision-making visible** — The imagination tree shows *why* an agent chose a move, not just *what* it chose — critical for building trust in agentic systems.
- **Benchmark personality strategies** — Run different configurations against each other (Aggressive vs Defensive, Chaotic vs Adaptive) to quantify which prompting strategies produce better game-theoretic outcomes.
- **Full-stack LLM observability** — A reference architecture for instrumenting LLM-powered applications: prediction accuracy, confidence calibration, token economics, latency budgets, and strategy drift.
- **Modern AI tooling showcase** — Amazon Bedrock, CopilotKit (AG-UI protocol), LangGraph, Neo4j, and Datadog LLM Observability integrated into a single cohesive application.

---

<div align="center">

**Built for the AWS x Anthropic x Datadog GenAI Hackathon 2026 — $35K+ in Prizes**

**February 20, 2026**

![Amazon Bedrock](https://img.shields.io/badge/Amazon_Bedrock-FF9900?style=flat-square&logo=amazonwebservices&logoColor=white)
![Anthropic Claude](https://img.shields.io/badge/Anthropic_Claude-191919?style=flat-square&logo=anthropic&logoColor=white)
![Datadog](https://img.shields.io/badge/Datadog-632CA6?style=flat-square&logo=datadog&logoColor=white)
![CopilotKit](https://img.shields.io/badge/CopilotKit-6366F1?style=flat-square&logoColor=white)
![Neo4j](https://img.shields.io/badge/Neo4j-008CC1?style=flat-square&logo=neo4j&logoColor=white)

</div>

## License

MIT
