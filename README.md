# Agent Colosseum

> A live, spectatable arena where AI agents compete in adversarial games — and the audience watches both agents imagine each other's futures in real-time.

## Overview

**Agent Colosseum** is a platform for evaluating AI agents in competitive, high-stakes environments. Two agents enter an arena, select from three adversarial protocols (Resource Wars, Negotiation, or Auction), and battle it out round by round. Before every move, each agent uses a foundation model (Amazon Bedrock / Claude) to predict the opponent's strategy, producing branching "imagination trees" that visualize in real-time on the frontend.

The platform is built with full observability in mind — every prediction, strategy shift, and outcome is tracked through Datadog LLM Observability, Neo4j strategy graphs, and MongoDB match archives.

## Key Features

- **3 Adversarial Protocols** — Resource Wars, Negotiation, and Auction, each with unique mechanics
- **Imagination Visualization** — Real-time 3D rendering of each agent's prediction branches using Force Graph + Three.js
- **Agent Personalities** — Aggressive, Defensive, Adaptive, and Chaotic, each with tuned risk tolerances and strategy weights
- **AI Commentator** — CopilotKit-powered spectator UI provides live match commentary via the AG-UI protocol
- **Strategy Graph** — Neo4j stores and queries strategy patterns, prediction accuracy, and counter-strategy paths
- **Match Archive** — MongoDB persists full match replays with round-by-round detail
- **LLM Observability** — Datadog integration tracks prediction accuracy, token usage, confidence calibration, and round latency
- **Mock Mode** — Run the full experience locally with zero external dependencies

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Frontend (Next.js 16 / React 19)                       │
│  ┌──────────┐ ┌──────────────┐ ┌─────────────────────┐  │
│  │  Arena    │ │  Imagination │ │  CopilotKit         │  │
│  │  Page     │ │  Tree (3D)   │ │  AI Commentator     │  │
│  └────┬─────┘ └──────────────┘ └────────┬────────────┘  │
│       │ WebSocket                        │ AG-UI SSE     │
└───────┼──────────────────────────────────┼──────────────┘
        │                                  │
┌───────┼──────────────────────────────────┼──────────────┐
│  Backend (FastAPI / Python)              │               │
│  ┌────┴─────┐ ┌──────────┐ ┌────────────┴────────────┐  │
│  │  Match   │ │  Agent   │ │  CopilotKit Runtime     │  │
│  │  Engine  │ │  Predictor│ │  (AG-UI Protocol)       │  │
│  └────┬─────┘ └────┬─────┘ └─────────────────────────┘  │
│       │             │                                    │
│  ┌────┴─────┐ ┌─────┴──────┐ ┌─────────────────────┐    │
│  │  Game    │ │  Amazon    │ │  Datadog LLM Obs    │    │
│  │  Engines │ │  Bedrock   │ │  + DogStatsD        │    │
│  └──────────┘ └────────────┘ └─────────────────────┘    │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐                      │
│  │  Neo4j       │  │  MongoDB     │                      │
│  │  (Strategy)  │  │  (Archive)   │                      │
│  └──────────────┘  └──────────────┘                      │
└──────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer           | Technology                                          |
|-----------------|-----------------------------------------------------|
| Frontend        | Next.js 16, React 19, Tailwind CSS 4, Framer Motion |
| 3D Viz          | 3d-force-graph, Three.js, three-spritetext           |
| AI Copilot      | CopilotKit 1.51, AG-UI Protocol                     |
| Backend         | Python 3.12+, FastAPI, Uvicorn, WebSockets           |
| AI Engine       | Amazon Bedrock (Claude Sonnet)                       |
| Strategy Graph  | Neo4j (async driver)                                 |
| Match Archive   | MongoDB (PyMongo)                                    |
| Observability   | Datadog (ddtrace, DogStatsD, LLM Observability)     |

## Game Protocols

### Resource Wars

10-round strategic resource capture. Three resource pools (A, B, C) start at 100 each. Agents bid, bluff, and counter for control.

| Move Type         | Description                                |
|-------------------|--------------------------------------------|
| `aggressive_bid`  | Commit heavily to one resource              |
| `defensive_spread`| Spread budget across resources              |
| `bluff`           | Fake intent on one resource, capture another|
| `counter`         | React to opponent's predicted strategy      |
| `retreat`         | Pull back, accumulate economy bonus         |

### Negotiation

5-round sequential offer negotiation. Red is the seller (wants high price), Blue is the buyer (wants low price). Each has a hidden walkaway price.

| Move Type         | Description                                |
|-------------------|--------------------------------------------|
| `propose`         | Make an offer at a specific price           |
| `accept`          | Accept the current offer                    |
| `reject`          | Reject the current offer                    |
| `counter_offer`   | Counter with a different price              |
| `bluff_walkaway`  | Threaten to walk away (may be a bluff)      |

### Auction

8-item sealed-bid auction. Each agent starts with 1,000 credits and has hidden valuations for each item. Highest bid wins the item.

| Move Type    | Description                                     |
|--------------|-------------------------------------------------|
| `bid`        | Place a real bid based on valuation              |
| `pass`       | Skip this item                                   |
| `bluff_bid`  | Inflated bid to scare opponent into overpaying   |

## Agent Personalities

Each personality has distinct risk tolerance, temperature, bluff frequency, and move weight distributions:

| Personality | Risk Tolerance | Bluff Frequency | Style                              |
|-------------|---------------|-----------------|-------------------------------------|
| Aggressive  | 0.8           | 30%             | High-risk, high-reward. Bold moves. |
| Defensive   | 0.3           | 5%              | Conservative. Exploits mistakes.    |
| Adaptive    | 0.5           | 15%             | Mirrors opponent. Adapts over time. |
| Chaotic     | 0.6           | 40%             | Unpredictable. Maximizes confusion. |

## Why Agent Colosseum?

As AI agents move from chat assistants to autonomous decision-makers, we need better ways to stress-test them. Agent Colosseum addresses this by putting agents in adversarial, multi-round games where they must predict, adapt, and outmaneuver an opponent in real-time.

- **Evaluate agent reasoning under pressure** — Agents can't just follow a script. They must model an opponent, predict future moves, and adapt when predictions fail. This exposes how well (or poorly) an LLM reasons about strategic uncertainty.
- **Make AI decision-making visible** — The imagination tree visualization shows *why* an agent chose a move, not just *what* it chose. This is critical for building trust in agentic systems and debugging unexpected behavior.
- **Benchmark personalities and strategies** — By running different personality configurations against each other (Aggressive vs Defensive, Chaotic vs Adaptive), you can quantify which prompting strategies produce better game-theoretic outcomes.
- **Full-stack observability for LLM apps** — The Datadog integration demonstrates how to instrument an LLM-powered application end-to-end: prediction accuracy, confidence calibration, token economics, latency budgets, and strategy drift detection — all the metrics that matter when running agents in production.
- **Showcase modern AI tooling** — Agent Colosseum integrates CopilotKit (AG-UI protocol), Amazon Bedrock, Neo4j graph analytics, and Datadog LLM Observability into a single cohesive application — a reference architecture for building observable, interactive AI systems.

## Demo Walkthrough

### Running the Demo (Mock Mode — No API Keys Needed)

**Terminal 1 — Backend:**
```bash
cd agent-colosseum/backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cd ..
PYTHONPATH=. uvicorn backend.main:app --reload --port 8000
```

**Terminal 2 — Frontend:**
```bash
cd agent-colosseum/frontend
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

### Demo Script

1. **Home Page** — The landing page shows three game protocols presented in a bento grid layout. Point out the agent personality selector on the right (Aggressive, Defensive, Adaptive, Chaotic).

2. **Start a Resource Wars Match** — Select Resource Wars, set Red to **Aggressive** and Blue to **Defensive**, then click **Initialize Simulation**. This navigates to the arena page and opens a WebSocket connection to the backend.

3. **Watch the Thinking Phase** — Each round begins with both agents "thinking" in parallel. The UI shows prediction cards as they stream in — each agent generates 3 branching predictions of what the opponent will do, with confidence scores and counter-strategies.

4. **Imagination Tree** — The 3D force graph renders each agent's prediction branches as an expanding tree. Correct predictions glow green when the round resolves; incorrect ones fade red. This is the core visualization — it makes the agent's reasoning process tangible.

5. **Round Collapse** — After both agents commit their moves, the "collapse" event fires. Predictions are annotated with `wasCorrect` / `partialMatch`, scores update, and the audience sees which agent read the other better.

6. **AI Commentator** — The CopilotKit chat panel provides live commentary. Ask it "What's happening?" or "Analyze red's performance" to see the AG-UI protocol in action — it reads match state, computes momentum, and streams analysis back.

7. **Match End** — After all rounds complete, the final scoreboard shows winner, prediction accuracy for both agents, and total futures simulated. Navigate to **Match History** to see past results.

8. **Try Other Protocols** — Run a Negotiation match (seller vs buyer with hidden walkaway prices) or an Auction match (sealed bids with budget management) to show the platform's versatility.

### Talking Points for the Demo

- **"Each agent generates 3 prediction branches per round"** — This is opponent modeling, a core challenge in multi-agent AI. The imagination tree makes this visible.
- **"Predictions run in parallel via asyncio"** — Both agents think simultaneously, just like real adversaries. The backend streams events as they happen.
- **"Everything is instrumented"** — With Datadog connected, every prediction, latency measurement, and strategy shift is a metric. Show the custom metrics table in the README for specifics.
- **"Mock mode is the real product"** — The mock engine uses personality-weighted heuristics that produce realistic game dynamics. You don't need Bedrock to see the full experience.
- **"The AG-UI protocol powers the commentator"** — CopilotKit's AG-UI protocol streams state snapshots, state deltas, text chunks, and tool calls (like `showInsightCard`) in a single SSE connection. This is the same protocol used in production copilot applications.

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 18+
- npm

### 1. Backend

```bash
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment (optional — mock mode works out of the box)
cp .env.example .env

# Start the server (run from the agent-colosseum/ root directory)
cd ..
PYTHONPATH=. uvicorn backend.main:app --reload --port 8000
```

> **Note:** The backend uses package-style imports (`from backend.match import ...`), so uvicorn must be run from the `agent-colosseum/` root directory with `backend.main:app`.

The API will be available at `http://localhost:8000`.

### 2. Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The frontend will be available at `http://localhost:3000`.

### 3. Run a Match

1. Open `http://localhost:3000`
2. Select a protocol (Resource Wars, Negotiation, or Auction)
3. Configure agent personalities (e.g., Aggressive vs Defensive)
4. Click **Initialize Simulation**
5. Watch the match unfold in real-time with prediction branches, scores, and AI commentary

## Configuration

### Mock Mode (Default)

The application defaults to `MOCK_MODE=true`. In this mode:

- **Agents** use weighted heuristic simulations instead of calling Amazon Bedrock
- **Database** operations use in-memory or no-op clients (no Neo4j/MongoDB needed)
- **Latency** is simulated (0.5–1.5s) to mimic LLM thinking time
- **Commentary** uses template-based generation instead of Bedrock

This lets you test the full UI, game flow, and visualization without any API keys or infrastructure costs.

### Production Mode

To run with real AI and databases, update `backend/.env`:

```env
MOCK_MODE=false

# AWS Bedrock
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
BEDROCK_MODEL_ID=anthropic.claude-sonnet-4-5-20250929-v1:0

# Neo4j (strategy graph)
NEO4J_URI=neo4j+s://your-instance.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-password

# MongoDB (match archive)
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority

# Datadog (optional)
DD_API_KEY=your-datadog-api-key
DD_SITE=datadoghq.com
DD_AGENT_HOST=localhost
```

## API Reference

### REST Endpoints

| Method | Path                              | Description                        |
|--------|-----------------------------------|------------------------------------|
| POST   | `/api/match/create`               | Create a new match                 |
| GET    | `/api/match/{match_id}/state`     | Get current match state            |
| GET    | `/api/match/{match_id}/replay`    | Full match events for replay       |
| GET    | `/api/matches`                    | List all recent matches            |
| GET    | `/api/game-types`                 | Available game types               |
| GET    | `/api/stats/agent/{personality}`  | Agent performance stats (MongoDB)  |
| GET    | `/api/stats/leaderboard`          | Agent rankings by win rate         |
| GET    | `/api/neo4j/patterns/{agent_id}`  | Strategy patterns from Neo4j       |
| GET    | `/api/neo4j/counter-strategy`     | Optimal counter-strategies         |
| GET    | `/health`                         | Health check + mock mode status    |

### WebSocket

| Endpoint                       | Description                           |
|--------------------------------|---------------------------------------|
| `ws://localhost:8000/ws/match/{match_id}` | Real-time match event stream |

**WebSocket Protocol:**
1. Client connects to the WebSocket
2. Client sends `{"type": "start_match", "gameType": "...", "redPersonality": "...", "bluePersonality": "...", "rounds": N}`
3. Server streams events: `match_start` → `round_start` → `thinking_start` → `prediction` → `thinking_end` → `collapse` → `round_end` → ... → `match_end`

### AG-UI Endpoint

| Method | Path     | Description                               |
|--------|----------|-------------------------------------------|
| POST   | `/agent` | CopilotKit AG-UI protocol (SSE streaming) |

Provides live match commentary with state snapshots, state deltas, streamed text messages, and tool calls (`showInsightCard`).

## Project Structure

```
agent-colosseum/
├── backend/
│   ├── main.py                  # FastAPI app, REST + WebSocket endpoints
│   ├── match.py                 # Match orchestrator, runs game loop
│   ├── agent.py                 # AgentPredictor (Bedrock + mock mode)
│   ├── game_engine.py           # Resource Wars rules and state
│   ├── negotiation_engine.py    # Negotiation rules and state
│   ├── auction_engine.py        # Auction rules and state
│   ├── neo4j_client.py          # Neo4j strategy graph client
│   ├── mongodb_client.py        # MongoDB match archive client
│   ├── datadog_metrics.py       # DogStatsD + LLM Observability
│   ├── copilotkit_runtime.py    # AG-UI protocol for AI commentator
│   ├── traffic_generator.py     # Load testing utility
│   ├── requirements.txt         # Python dependencies
│   └── .env.example             # Environment variable template
├── frontend/
│   ├── app/
│   │   ├── page.tsx             # Home — protocol selection + agent config
│   │   ├── arena/page.tsx       # Live match viewer
│   │   ├── history/page.tsx     # Match history
│   │   ├── replay/[matchId]/    # Match replay viewer
│   │   └── api/copilotkit/      # CopilotKit API route
│   ├── components/
│   │   ├── MatchViewer.tsx      # Main match display
│   │   ├── AgentPanel.tsx       # Agent status panel
│   │   ├── ScoreDisplay.tsx     # Score visualization
│   │   ├── PredictionCards.tsx  # Prediction branch cards
│   │   ├── AICommentator.tsx    # CopilotKit chat interface
│   │   ├── NegotiationView.tsx  # Negotiation-specific UI
│   │   ├── AuctionView.tsx      # Auction-specific UI
│   │   ├── MatchReplay.tsx      # Replay component
│   │   ├── AudiencePoll.tsx     # Audience engagement
│   │   ├── StrategyInsightCard.tsx
│   │   ├── CopilotKitProvider.tsx
│   │   ├── viz/
│   │   │   ├── ImaginationTree.tsx   # 3D force graph visualization
│   │   │   ├── DoubleCollapse.tsx    # Dual-agent collapse animation
│   │   │   ├── ParticleCanvas.tsx    # Particle effects
│   │   │   └── SoundManager.tsx      # Audio effects
│   │   └── ui/                  # Shared UI components
│   ├── lib/                     # Utilities and types
│   └── package.json
└── README.md
```

## Observability (Datadog)

When `DD_API_KEY` and `DD_AGENT_HOST` are configured, the platform emits:

### Custom Metrics

| Metric                                 | Type      | Description                            |
|----------------------------------------|-----------|----------------------------------------|
| `arena.predictions.total`              | Counter   | Total predictions made                 |
| `arena.predictions.correct`            | Counter   | Correct predictions                    |
| `arena.predictions.wrong`              | Counter   | Incorrect predictions                  |
| `arena.prediction.confidence`          | Gauge     | Confidence score per prediction        |
| `arena.round.latency`                  | Timer     | Round execution time (ms)              |
| `arena.imagination.branches`           | Gauge     | Prediction branches per round          |
| `arena.imagination.depth`              | Gauge     | Max imagination depth                  |
| `arena.strategy.shifts`                | Counter   | Strategy changes detected              |
| `arena.strategy.distribution`          | Counter   | Move type frequency                    |
| `arena.matches.completed`              | Counter   | Total completed matches                |
| `arena.match.duration_ms`              | Histogram | Match duration                         |
| `arena.match.score_diff`              | Gauge     | Final score differential               |
| `arena.tokens.total`                   | Counter   | LLM token consumption                  |
| `arena.tokens.per_prediction`          | Histogram | Tokens per prediction branch           |
| `arena.confidence.calibration`         | Histogram | Confidence vs actual accuracy gap      |
| `arena.agent.personality_win_rate.*`   | Counter   | Win rate by personality matchup        |

### LLM Observability

With `ddtrace.llmobs`, each Bedrock prediction call is wrapped in a workflow span annotated with agent name, personality, round number, and score. Evaluation metrics for prediction accuracy are submitted per branch.

## Data Flow (Per Round)

1. Match engine sends current game state to both agents
2. Agents call Bedrock (or mock) for opponent prediction — runs in parallel
3. Each agent produces 3 prediction branches with confidence scores
4. Predictions stream to the frontend via WebSocket
5. Frontend renders imagination trees in real-time (3D force graph)
6. Agents commit their chosen moves
7. Game engine resolves the round (attack/defense/bluff mechanics)
8. Predictions are annotated with `wasCorrect` / `partialMatch`
9. Results written to Neo4j (strategy graph) and MongoDB (archive)
10. Datadog metrics emitted (prediction accuracy, latency, token usage)
11. CopilotKit commentator analyzes state and provides live commentary
12. Frontend updates scores, animations, and insight cards

## License

MIT
