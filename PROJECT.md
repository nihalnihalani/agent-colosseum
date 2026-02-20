# Agent Colosseum

> A live, spectatable arena where AI agents compete in adversarial tasks — and the audience watches both agents imagine each other's futures in real-time.

**Hackathon:** AWS x Datadog Generative AI Agents Hackathon
**Venue:** AWS Builder Loft, 525 Market St, San Francisco
**Prize Pool:** $20K+ cash, $15K AWS credits, $10K+ partner credits

---

## Table of Contents

1. [Concept Overview](#concept-overview)
2. [How It Works](#how-it-works)
3. [Architecture](#architecture)
4. [AWS Infrastructure](#aws-infrastructure)
5. [Datadog Observability](#datadog-observability)
6. [Neo4j Strategy Graph](#neo4j-strategy-graph)
7. [MongoDB Match Archive](#mongodb-match-archive)
8. [CopilotKit Spectator UI](#copilotkit-spectator-ui)
9. [Game Types](#game-types)
10. [Agent Design](#agent-design)
11. [The Visualization — Branching Futures](#the-visualization)
12. [Demo Plan](#demo-plan)
13. [Prize Strategy](#prize-strategy)
14. [Build Plan](#build-plan)
15. [Tech Stack](#tech-stack)
16. [Risk Assessment](#risk-assessment)
17. [API Reference](#api-reference)
18. [Reference Project Analysis — What to Steal](#reference-analysis)

---

## 1. Concept Overview <a name="concept-overview"></a>

**One-liner:** Two AI agents enter an arena. Each uses Amazon Bedrock to simulate the opponent's next move before committing. The audience sees both agents' "imagination trees" in real-time — branching predictions that fan out, dissolve, and collapse into chosen actions.

**Why it matters:**
- AI agents today are reactive — they act and hope for the best
- Agent Colosseum shows what happens when agents can *predict* their environment (including other agents)
- The adversarial format creates emergent behavior no script can produce
- The visualization makes invisible AI reasoning visible and spectatable

**Core innovation:** Using foundation models not just for action, but for *opponent modeling* — predicting another intelligent agent's behavior and planning counter-strategies. This is fundamentally harder and more impressive than predicting static environments.

---

## 2. How It Works <a name="how-it-works"></a>

### The Game Loop

```
ROUND START
    |
    v
[GAME STATE] — Both agents see current state (resources, scores, positions)
    |
    +---> [AGENT RED: IMAGINATION PHASE]
    |     Agent Red calls Bedrock Claude:
    |     "Given this state and Blue's history, predict 3 likely moves.
    |      For each, plan my optimal counter-strategy."
    |     Returns: 3 branching predictions with confidence scores
    |
    +---> [AGENT BLUE: IMAGINATION PHASE] (simultaneous)
    |     Same process, predicting Red's moves
    |
    v
[VISUALIZATION: Both imagination trees render on screen]
    |     Branches fan out, confidence scores pulse, colors indicate risk
    |
    v
[COMMIT PHASE] — Both agents lock in their chosen move
    |
    v
[THE DOUBLE COLLAPSE] — Both trees collapse simultaneously
    |     Wrong predictions dissolve red
    |     Correct predictions glow gold
    |     Chosen moves crystallize
    |
    v
[RESOLUTION] — Judge Agent validates moves, calculates outcomes
    |     Prediction accuracy scored
    |     Game state updated
    |     Results stored in Neo4j + MongoDB
    |
    v
[NEXT ROUND] or [MATCH END]
```

### The Signature Visual Moments

1. **The Fan** — Imagination trees branch outward from each agent's avatar as they "think"
2. **The Double Collapse** — Both trees collapse simultaneously when moves are revealed
3. **The Accuracy Flash** — Correct predictions highlighted, accuracy counter updates
4. **The Adaptation** — Over rounds, agents visibly change strategies based on pattern recognition

---

## 3. Architecture <a name="architecture"></a>

### High-Level System Architecture

```
+------------------------------------------------------------------+
|                      AGENT COLOSSEUM                              |
|                                                                    |
|  +------------------+  +-----------+  +------------------+        |
|  |    AGENT RED     |  |   JUDGE   |  |    AGENT BLUE    |        |
|  | (AgentCore       |  | (AgentCore|  | (AgentCore       |        |
|  |  Runtime - MicroVM|  |  Runtime) |  |  Runtime - MicroVM|       |
|  +--------+---------+  +-----+-----+  +--------+---------+        |
|           |     A2A Protocol  |  A2A Protocol    |                |
|           +<----------------->+<---------------->+                |
|           |                   |                  |                |
|           v                   v                  v                |
|  +--------------------------------------------------------+      |
|  |              Amazon Bedrock (Claude Sonnet)             |      |
|  |         Opponent modeling / Game reasoning / Eval       |      |
|  +--------------------------------------------------------+      |
|           |                   |                  |                |
|     +-----+-----+     +------+------+     +-----+-----+         |
|     |           |     |             |     |           |          |
|     v           v     v             v     v           v          |
|  +------+  +-------+ +--------+ +------+ +--------+ +------+    |
|  |Neo4j |  |Agent  | |Agent   | |Agent | |Datadog | |Mongo |    |
|  |Aura  |  |Core   | |Core    | |Core  | |  LLM   | | DB   |    |
|  |DB    |  |Memory | |Gateway | |Obs   | |  Obs   | |Atlas |    |
|  |      |  |(Epi-  | |(Game   | |(OTel)| |Dash    | |      |    |
|  |Strat-|  | sodic)|  |Tools) | |      | |boards  | |Match |    |
|  |egy   |  |       | |        | |      | |        | |Arch- |    |
|  |Graph |  |       | |        | |      | |        | |ive   |    |
|  +------+  +-------+ +--------+ +------+ +--------+ +------+    |
|                                                                    |
|  +--------------------------------------------------------+      |
|  |            CopilotKit Spectator UI (Next.js)           |      |
|  |  Split-screen viz + AI commentator + audience polls    |      |
|  +--------------------------------------------------------+      |
+------------------------------------------------------------------+
```

### Data Flow Per Round

```
1. Match Controller sends game state to Red & Blue via A2A Protocol
2. Red & Blue each call Bedrock Claude for opponent prediction (parallel)
3. Predictions streamed to CopilotKit UI (branches grow in real-time)
4. Agents commit moves via AgentCore Gateway (game tools)
5. Judge Agent validates and resolves via Bedrock
6. Results written to:
   - Neo4j: strategy relationships and prediction graph
   - MongoDB: full match document archive
   - AgentCore Memory: episodic memory for agent learning
7. AgentCore Observability -> Datadog: LLM metrics, latency, accuracy
8. CopilotKit UI updates: scores, accuracy, visualization
9. Next round begins
```

---

## 4. AWS Infrastructure <a name="aws-infrastructure"></a>

### Amazon Bedrock

**Role:** Powers all agent reasoning — opponent modeling, game strategy, move evaluation.

**Model:** Claude Sonnet via Amazon Bedrock (Anthropic partner in hackathon)

**Usage per round per agent:**

```python
import boto3
import json

bedrock = boto3.client('bedrock-runtime', region_name='us-east-1')

def predict_opponent(game_state, opponent_history, my_history):
    """Use Bedrock Claude to predict opponent's next move."""
    response = bedrock.invoke_model(
        modelId='anthropic.claude-sonnet-4-5-20250929-v1:0',
        contentType='application/json',
        body=json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 1024,
            "temperature": 0.7,
            "messages": [{
                "role": "user",
                "content": f"""You are Agent Red in a competitive strategy game.

CURRENT GAME STATE:
{json.dumps(game_state)}

OPPONENT'S MOVE HISTORY:
{json.dumps(opponent_history)}

YOUR MOVE HISTORY:
{json.dumps(my_history)}

Predict your opponent's 3 most likely next moves.
For each prediction, provide:
1. The predicted move (specific action)
2. Confidence score (0.0 to 1.0, must sum to <= 1.0)
3. Your optimal counter-strategy
4. Predicted outcome if you use this counter

Return as JSON:
{{
  "predictions": [
    {{
      "opponent_move": "...",
      "confidence": 0.XX,
      "my_counter": "...",
      "predicted_outcome": "...",
      "reasoning": "..."
    }}
  ],
  "chosen_move": "...",
  "chosen_reasoning": "..."
}}"""
            }]
        })
    )
    return json.loads(response['body'].read())
```

**Streaming for real-time visualization:**

```python
def predict_opponent_streaming(game_state, opponent_history, my_history):
    """Stream predictions for real-time branch rendering."""
    response = bedrock.invoke_model_with_response_stream(
        modelId='anthropic.claude-sonnet-4-5-20250929-v1:0',
        contentType='application/json',
        body=json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 1024,
            "temperature": 0.7,
            "stream": True,
            "messages": [{"role": "user", "content": "..."}]
        })
    )

    for event in response['body']:
        chunk = json.loads(event['chunk']['bytes'])
        # Stream each token to CopilotKit UI for live branch rendering
        yield chunk
```

### Amazon Bedrock AgentCore

**Why AgentCore (not just raw Bedrock):**
- Each agent runs in an **isolated microVM** — no cheating, no shared state
- **A2A Protocol** for agent-to-agent communication (open standard)
- **Gateway** exposes game tools as MCP-compatible endpoints
- **Episodic Memory** lets agents learn from past matches
- **Policy (Cedar)** enforces fair play rules deterministically
- **Observability** pipes OpenTelemetry traces directly to Datadog

#### AgentCore Runtime — Agent Deployment

```python
# agent_red.py
from bedrock_agentcore import BedrockAgentCoreApp
import json

app = BedrockAgentCoreApp()

@app.entrypoint
def invoke(payload):
    """Agent Red's main loop for a single round."""
    game_state = payload.get("game_state")
    opponent_history = payload.get("opponent_history")
    my_history = payload.get("my_history")
    round_number = payload.get("round")

    # 1. Query episodic memory for relevant past experiences
    past_lessons = query_memory(game_state, opponent_history)

    # 2. Query Neo4j for strategy patterns
    strategy_patterns = query_neo4j_patterns(opponent_history)

    # 3. Call Bedrock Claude with full context for opponent prediction
    predictions = predict_opponent(
        game_state, opponent_history, my_history,
        past_lessons, strategy_patterns
    )

    # 4. Return predictions + chosen move
    return {
        "agent": "red",
        "round": round_number,
        "predictions": predictions["predictions"],
        "chosen_move": predictions["chosen_move"],
        "reasoning": predictions["chosen_reasoning"]
    }

app.run()
```

**Deployment:**

```bash
# Scaffold the project
pip install bedrock-agentcore bedrock-agentcore-starter-toolkit
agentcore create --name agent-colosseum

# Local development
agentcore dev

# Deploy to AWS
agentcore launch

# Invoke
agentcore invoke '{"game_state": {...}, "round": 1}'
```

#### AgentCore Gateway — Game Tools as MCP

Define custom game tools that agents can call through the Gateway:

```yaml
# gateway-tools.yaml
tools:
  - name: submit_move
    description: "Submit your chosen move for this round"
    parameters:
      move_type:
        type: string
        enum: [aggressive_bid, defensive_spread, bluff, counter, retreat]
      target_resource:
        type: string
      amount:
        type: integer

  - name: query_match_history
    description: "Query past match outcomes against this opponent"
    parameters:
      opponent_id:
        type: string
      pattern:
        type: string
        description: "Strategy pattern to search for"

  - name: read_game_state
    description: "Read the current game state"
    parameters: {}
```

#### AgentCore Policy — Fair Play Enforcement

```cedar
// Prevent agents from reading opponent's internal state
forbid (
    principal == AgentColosseum::Agent::"red",
    action == AgentColosseum::Action::"read",
    resource == AgentColosseum::Resource::"blue_predictions"
);

forbid (
    principal == AgentColosseum::Agent::"blue",
    action == AgentColosseum::Action::"read",
    resource == AgentColosseum::Resource::"red_predictions"
);

// Only Judge can resolve rounds
permit (
    principal == AgentColosseum::Agent::"judge",
    action == AgentColosseum::Action::"resolve_round",
    resource == AgentColosseum::Resource::"match_state"
);

// Agents can only submit one move per round
forbid (
    principal in AgentColosseum::AgentGroup::"competitors",
    action == AgentColosseum::Action::"submit_move",
    resource == AgentColosseum::Resource::"match_state"
) when { context.moves_submitted_this_round >= 1 };
```

#### AgentCore Memory — Agent Learning

```python
from bedrock_agentcore.memory import MemoryClient

memory = MemoryClient()

# After each round, store the experience as an episode
async def store_round_episode(agent_id, round_data):
    await memory.create_event(
        session_id=round_data["match_id"],
        actor_id=agent_id,
        event={
            "type": "round_result",
            "round": round_data["round"],
            "my_predictions": round_data["predictions"],
            "opponent_actual_move": round_data["opponent_move"],
            "prediction_correct": round_data["was_correct"],
            "outcome": round_data["outcome"],
            "lesson": round_data["lesson"]  # e.g., "Opponent bluffs more in late rounds"
        }
    )

# Before each round, retrieve relevant past episodes
async def query_memory(game_state, opponent_history):
    records = await memory.retrieve_memory_records(
        namespace="matches",
        query=f"strategy against opponent who {describe_pattern(opponent_history)}",
        top_k=5
    )
    return records
```

#### AgentCore Evaluations — Measuring Agent Quality

```python
# Built-in evaluators for agent performance
evaluations = {
    "prediction_accuracy": {
        "evaluator": "custom",
        "metric": "prediction_hit_rate",
        "description": "% of opponent move predictions that were correct"
    },
    "tool_selection": {
        "evaluator": "builtin:tool_selection",
        "description": "Did the agent use the right tools at the right time?"
    },
    "reasoning_quality": {
        "evaluator": "builtin:helpfulness",
        "description": "Quality of strategic reasoning"
    }
}
```

---

## 5. Datadog Observability <a name="datadog-observability"></a>

**This is the core differentiator.** Most teams will bolt Datadog on as an afterthought. For Agent Colosseum, observability IS the product — you're measuring the quality of AI imagination in real-time.

### What We Monitor

#### LLM Observability (via Datadog LLM Obs)

```python
from ddtrace.llmobs import LLMObs

# Initialize LLM Observability
LLMObs.enable(
    ml_app="agent-colosseum",
    integrations_enabled=True,
    agentless_enabled=True
)

# Track every Bedrock call with rich metadata
@LLMObs.workflow("opponent_prediction")
def predict_opponent_tracked(agent_id, game_state, opponent_history):
    LLMObs.annotate(
        tags={
            "agent": agent_id,
            "round": game_state["round"],
            "match_id": game_state["match_id"],
            "game_type": game_state["game_type"]
        }
    )

    prediction = predict_opponent(game_state, opponent_history)

    # Custom metric: prediction confidence distribution
    LLMObs.annotate(
        metrics={
            "top_confidence": prediction["predictions"][0]["confidence"],
            "prediction_count": len(prediction["predictions"]),
            "token_cost": prediction.get("usage", {}).get("total_tokens", 0)
        }
    )

    return prediction
```

#### Custom Datadog Dashboards

**Dashboard 1: "The War Room" (Live Match Dashboard)**

| Widget | Metric | Purpose |
|--------|--------|---------|
| Split gauge | Red accuracy vs Blue accuracy | Real-time prediction quality comparison |
| Time series | Prediction confidence per round | Shows if agents become more or less confident |
| Top list | Most common predicted moves | Shows emerging meta-strategies |
| Heat map | Move type vs outcome | Reveals which strategies work |
| Counter | Total futures simulated | Running count of "imagined" scenarios |
| Log stream | Agent reasoning traces | Watch agents think in real-time |

**Dashboard 2: "Imagination Efficiency" (LLM Cost Dashboard)**

| Widget | Metric | Purpose |
|--------|--------|---------|
| Time series | Tokens per prediction vs accuracy | Does thinking more = predicting better? |
| Bar chart | Latency per agent per round | Which agent thinks faster? |
| Pie chart | Token distribution (prediction vs strategy vs reasoning) | Where agents spend their "thinking budget" |
| SLO | p99 round completion time < 10s | Performance guarantee |

**Dashboard 3: "Evolution" (Cross-Match Analytics)**

| Widget | Metric | Purpose |
|--------|--------|---------|
| Line graph | Prediction accuracy over 50 matches | Are agents learning? |
| Stacked bar | Strategy distribution evolution | How meta-game shifts over time |
| Scatter plot | Confidence vs actual accuracy | Calibration quality |
| Heat map | Agent vs agent win matrix | Head-to-head records |

### Datadog MCP Integration

Use Datadog's MCP server to let agents self-monitor:

```python
# Agent can query its own performance via Datadog MCP
async def self_monitor(agent_id):
    """Agent checks its own metrics before choosing strategy."""
    # Query Datadog for recent accuracy
    recent_accuracy = await datadog_mcp.query(
        f"avg:agent_colosseum.prediction_accuracy{{agent:{agent_id}}} by round last 5 rounds"
    )

    # If accuracy is dropping, switch to more conservative predictions
    if recent_accuracy < 0.5:
        return {"strategy_modifier": "conservative", "reason": "accuracy declining"}

    return {"strategy_modifier": "normal"}
```

### OpenTelemetry Pipeline

```
AgentCore Observability (OTel traces)
    |
    v
Datadog Agent (collector)
    |
    +---> Datadog APM (request traces)
    +---> Datadog LLM Obs (model calls)
    +---> Datadog Logs (agent reasoning)
    +---> Datadog Metrics (custom game metrics)
    +---> Datadog Dashboards (real-time viz)
```

---

## 6. Neo4j Strategy Graph <a name="neo4j-strategy-graph"></a>

### Why Neo4j (Not Just MongoDB)

MongoDB stores match *documents*. Neo4j stores strategy *relationships*. The difference matters when agents need to reason about patterns:

| Query | MongoDB | Neo4j |
|-------|---------|-------|
| "Get match #47 details" | Fast (document lookup) | Overkill |
| "What beat aggressive openings?" | Slow (scan + filter) | Fast (graph traversal) |
| "Find 3-move sequences that predict bluffs" | Very hard (nested aggregation) | Native (path query) |
| "What's my best counter to X followed by Y?" | Impractical | 1 Cypher query |
| "Show strategy evolution over 50 matches" | Aggregation pipeline | Graph visualization |

**Neo4j answers relationship questions. MongoDB answers document questions. We need both.**

### Graph Schema

```
Nodes:
  (:Agent {id, name, type, model})
  (:Match {id, game_type, timestamp, winner})
  (:Round {number, game_state_hash})
  (:Move {type, target, amount, timestamp})
  (:Prediction {opponent_move, confidence, was_correct})
  (:Strategy {name, description, win_rate})
  (:GameState {hash, resources, scores})

Relationships:
  (Agent)-[:COMPETED_IN]->(Match)
  (Match)-[:HAS_ROUND]->(Round)
  (Round)-[:RED_MOVED]->(Move)
  (Round)-[:BLUE_MOVED]->(Move)
  (Agent)-[:PREDICTED {confidence}]->(Prediction)
  (Prediction)-[:FOR_ROUND]->(Round)
  (Prediction)-[:ACTUAL_WAS]->(Move)
  (Move)-[:COUNTERS]->(Move)
  (Move)-[:PART_OF]->(Strategy)
  (Strategy)-[:BEATS]->(Strategy)
  (Strategy)-[:LOSES_TO]->(Strategy)
  (Agent)-[:USED]->(Strategy)
  (Round)-[:HAD_STATE]->(GameState)
  (GameState)-[:LED_TO]->(GameState)
```

### Key Cypher Queries for Agent Intelligence

**Query 1: "What counter-strategy beats my opponent's pattern?"**

```cypher
// Find the best counter when opponent opens with aggressive_bid
MATCH (opp:Agent {name: 'blue'})-[:COMPETED_IN]->(m:Match)-[:HAS_ROUND]->(r:Round {number: 1})
MATCH (r)-[:BLUE_MOVED]->(oppMove:Move {type: 'aggressive_bid'})
MATCH (r)-[:RED_MOVED]->(myMove:Move)
MATCH (m)-[:HAS_ROUND]->(finalRound:Round)
WHERE finalRound.number = m.total_rounds
WITH myMove.type AS counter,
     CASE WHEN m.winner = 'red' THEN 1 ELSE 0 END AS won
WITH counter,
     count(*) AS times_used,
     sum(won) AS wins,
     toFloat(sum(won)) / count(*) AS win_rate
ORDER BY win_rate DESC
LIMIT 3
RETURN counter, times_used, wins, win_rate
```

**Query 2: "Detect multi-round patterns (is opponent setting up a bluff?)"**

```cypher
// Find 3-move sequences that preceded a bluff
MATCH (m:Match)-[:HAS_ROUND]->(r1:Round)-[:BLUE_MOVED]->(m1:Move)
MATCH (m)-[:HAS_ROUND]->(r2:Round)-[:BLUE_MOVED]->(m2:Move)
MATCH (m)-[:HAS_ROUND]->(r3:Round)-[:BLUE_MOVED]->(m3:Move {type: 'bluff'})
WHERE r1.number = r3.number - 2
  AND r2.number = r3.number - 1
RETURN m1.type + ' -> ' + m2.type + ' -> BLUFF' AS pattern,
       count(*) AS occurrences
ORDER BY occurrences DESC
LIMIT 5
```

**Query 3: "What's my prediction accuracy by opponent strategy?"**

```cypher
MATCH (me:Agent {name: 'red'})-[:PREDICTED]->(p:Prediction)-[:FOR_ROUND]->(r:Round)
MATCH (p)-[:ACTUAL_WAS]->(actual:Move)
MATCH (actual)-[:PART_OF]->(s:Strategy)
WITH s.name AS opponent_strategy,
     count(*) AS total_predictions,
     sum(CASE WHEN p.was_correct THEN 1 ELSE 0 END) AS correct,
     toFloat(sum(CASE WHEN p.was_correct THEN 1 ELSE 0 END)) / count(*) AS accuracy
RETURN opponent_strategy, total_predictions, correct, accuracy
ORDER BY accuracy DESC
```

**Query 4: "Strategy evolution — how has the meta shifted?"**

```cypher
// Show strategy usage by match number (time series for visualization)
MATCH (a:Agent)-[:COMPETED_IN]->(m:Match)-[:HAS_ROUND]->(r:Round)-[:RED_MOVED]->(move:Move)
MATCH (move)-[:PART_OF]->(s:Strategy)
WHERE a.name = 'red'
WITH m.timestamp AS match_time, s.name AS strategy, count(*) AS usage
ORDER BY match_time
RETURN match_time, strategy, usage
```

**Query 5: "Find the shortest path between two game states"**

```cypher
// What sequence of moves transforms state A into state B?
MATCH path = SHORTEST 1 (start:GameState {hash: $start_hash})-[:LED_TO]-+(end:GameState {hash: $end_hash})
RETURN [n IN nodes(path) | n.hash] AS state_sequence,
       length(path) AS moves_required
```

### Vector Search for Strategy Similarity

```cypher
// Create vector index on game states
CREATE VECTOR INDEX `game-state-embeddings`
FOR (gs:GameState) ON (gs.embedding)
OPTIONS {indexConfig: {
  `vector.dimensions`: 1536,
  `vector.similarity_function`: 'cosine'
}};

// Find similar game states to current one
CALL db.index.vector.queryNodes('game-state-embeddings', 5, $current_state_embedding)
YIELD node AS similarState, score
MATCH (similarState)<-[:HAD_STATE]-(r:Round)<-[:HAS_ROUND]-(m:Match)
MATCH (r)-[:RED_MOVED]->(move:Move)
WHERE m.winner = 'red'
RETURN move.type AS winning_move, score AS state_similarity, count(*) AS occurrences
ORDER BY occurrences DESC
```

### Neo4j Setup

**Neo4j AuraDB (Cloud — recommended for hackathon):**
- Free tier available (no credit card required)
- Professional tier: $65/GB/month (hackathon credits from Neo4j award may cover this)
- Runs natively on AWS
- Python driver: `neo4j` package

```python
from neo4j import GraphDatabase

driver = GraphDatabase.driver(
    "neo4j+s://xxxx.databases.neo4j.io",
    auth=("neo4j", "password")
)

async def store_round_in_graph(round_data):
    async with driver.session() as session:
        await session.run("""
            MERGE (m:Match {id: $match_id})
            CREATE (r:Round {number: $round, game_state_hash: $state_hash})
            CREATE (m)-[:HAS_ROUND]->(r)

            CREATE (redMove:Move {type: $red_move_type, target: $red_target, amount: $red_amount})
            CREATE (blueMove:Move {type: $blue_move_type, target: $blue_target, amount: $blue_amount})
            CREATE (r)-[:RED_MOVED]->(redMove)
            CREATE (r)-[:BLUE_MOVED]->(blueMove)

            WITH r, redMove, blueMove
            UNWIND $predictions AS pred
            CREATE (p:Prediction {
                opponent_move: pred.opponent_move,
                confidence: pred.confidence,
                was_correct: pred.was_correct
            })
            CREATE (r)<-[:FOR_ROUND]-(p)
        """, round_data)
```

### Graphiti Integration (Optional Enhancement)

[Graphiti](https://github.com/getzep/graphiti) is an open-source framework for building temporally-aware knowledge graphs, purpose-built for AI agent memory. It uses Neo4j as its backend.

```python
from graphiti_core import Graphiti
from graphiti_core.driver.neo4j_driver import Neo4jDriver

driver = Neo4jDriver(
    uri="neo4j+s://xxxx.databases.neo4j.io",
    user="neo4j",
    password="password"
)

graphiti = Graphiti(graph_driver=driver)

# Automatically extract entities and relationships from match events
await graphiti.add_episode(
    name=f"Match {match_id} Round {round_num}",
    episode_body=f"Agent Red predicted Blue would {pred}. Blue actually {actual}. Red {'won' if won else 'lost'} the round.",
    source_description="Agent Colosseum match event"
)
```

---

## 7. MongoDB Match Archive <a name="mongodb-match-archive"></a>

### Role

MongoDB stores the full, rich document for each match — the complete record that can be replayed, analyzed, or displayed. Neo4j stores the relationship patterns; MongoDB stores the raw data.

### Document Schema

```json
{
  "_id": "match_047",
  "game_type": "resource_wars",
  "started_at": "2026-03-15T14:30:00Z",
  "ended_at": "2026-03-15T14:35:22Z",
  "agents": {
    "red": {"id": "agent_red_v3", "model": "claude-sonnet", "version": "3.2"},
    "blue": {"id": "agent_blue_v2", "model": "claude-sonnet", "version": "2.1"}
  },
  "winner": "red",
  "final_score": {"red": 847, "blue": 623},
  "total_rounds": 10,
  "total_futures_simulated": 60,
  "prediction_accuracy": {"red": 0.78, "blue": 0.64},
  "rounds": [
    {
      "round": 1,
      "game_state": {
        "resources": {"A": 100, "B": 100, "C": 100},
        "scores": {"red": 0, "blue": 0}
      },
      "red": {
        "predictions": [
          {"opponent_move": "aggressive_bid_A", "confidence": 0.65, "counter": "defend_A"},
          {"opponent_move": "spread_defense", "confidence": 0.25, "counter": "attack_C"},
          {"opponent_move": "bluff_B", "confidence": 0.10, "counter": "ignore_B"}
        ],
        "chosen_move": {"type": "defend_A", "amount": 40},
        "reasoning": "Opponent historically opens aggressive on high-value resources",
        "thinking_tokens": 847,
        "thinking_latency_ms": 2340
      },
      "blue": {
        "predictions": [...],
        "chosen_move": {"type": "aggressive_bid_A", "amount": 50},
        "reasoning": "...",
        "thinking_tokens": 623,
        "thinking_latency_ms": 1890
      },
      "resolution": {
        "winner": "blue",
        "red_prediction_correct": true,
        "blue_prediction_correct": false,
        "resource_changes": {"A": {"red": -10, "blue": +10}}
      }
    }
  ],
  "metadata": {
    "total_bedrock_tokens": 14520,
    "total_bedrock_cost_usd": 0.043,
    "avg_round_duration_ms": 3200
  }
}
```

### MongoDB Setup

```python
from pymongo import MongoClient

client = MongoClient("mongodb+srv://user:pass@cluster.mongodb.net/")
db = client["agent_colosseum"]
matches = db["matches"]
agents = db["agents"]

# Store a complete match
async def store_match(match_data):
    matches.insert_one(match_data)

# Query: win rate by strategy
pipeline = [
    {"$unwind": "$rounds"},
    {"$group": {
        "_id": "$rounds.red.chosen_move.type",
        "total": {"$sum": 1},
        "wins": {"$sum": {"$cond": [{"$eq": ["$rounds.resolution.winner", "red"]}, 1, 0]}},
    }},
    {"$addFields": {"win_rate": {"$divide": ["$wins", "$total"]}}},
    {"$sort": {"win_rate": -1}}
]
results = matches.aggregate(pipeline)
```

---

## 8. CopilotKit Spectator UI <a name="copilotkit-spectator-ui"></a>

### Role

CopilotKit powers the spectator experience — the frontend where audiences watch matches, see AI imagination trees, interact with an AI commentator, and participate in predictions.

### Core Components

**1. Split-Screen Match Viewer**

```tsx
// components/MatchViewer.tsx
import { CopilotChat, useCopilotAction, useCopilotReadable } from "@copilotkit/react-core";

export function MatchViewer({ matchId }: { matchId: string }) {
  const [matchState, setMatchState] = useState<MatchState | null>(null);

  // Make match state readable to the AI commentator
  useCopilotReadable({
    description: "Current match state including agent predictions and scores",
    value: matchState
  });

  // AI commentator can explain what's happening
  useCopilotAction({
    name: "explainRound",
    description: "Explain what happened in the current round",
    parameters: [
      { name: "roundNumber", type: "number", description: "Round to explain" }
    ],
    handler: async ({ roundNumber }) => {
      // Commentator generates natural language explanation
      return `Round ${roundNumber}: Red predicted Blue would bluff with 72% confidence...`;
    }
  });

  return (
    <div className="match-viewer">
      <div className="split-screen">
        <AgentPanel agent="red" predictions={matchState?.red?.predictions} />
        <AgentPanel agent="blue" predictions={matchState?.blue?.predictions} />
      </div>
      <DatadogDashboard matchId={matchId} />
      <CopilotChat
        instructions="You are an AI sports commentator for Agent Colosseum.
        Explain agent strategies, prediction accuracy, and key moments in an
        engaging, play-by-play style. Reference the match data provided."
        labels={{ title: "AI Commentator", placeholder: "Ask about the match..." }}
      />
    </div>
  );
}
```

**2. Imagination Tree Visualization (D3.js)**

```tsx
// components/ImaginationTree.tsx
import * as d3 from 'd3';
import { motion, AnimatePresence } from 'framer-motion';

interface Prediction {
  opponent_move: string;
  confidence: number;
  counter: string;
  was_correct?: boolean;
}

export function ImaginationTree({
  predictions,
  phase,  // "thinking" | "committed" | "revealed"
  agentColor
}: {
  predictions: Prediction[];
  phase: string;
  agentColor: string;
}) {
  return (
    <svg className="imagination-tree" width={400} height={300}>
      {/* Central node — the agent */}
      <motion.circle
        cx={200} cy={30} r={20}
        fill={agentColor}
        animate={{
          scale: phase === "thinking" ? [1, 1.1, 1] : 1,
          opacity: 1
        }}
        transition={{ repeat: phase === "thinking" ? Infinity : 0, duration: 1 }}
      />

      {/* Branching predictions */}
      <AnimatePresence>
        {predictions.map((pred, i) => {
          const angle = ((i - (predictions.length - 1) / 2) * 40) * Math.PI / 180;
          const endX = 200 + Math.sin(angle) * 200;
          const endY = 30 + Math.cos(angle) * 220;

          const isChosen = pred.confidence === Math.max(...predictions.map(p => p.confidence));
          const isCorrect = pred.was_correct;

          // Determine branch state
          let branchColor = agentColor;
          let branchOpacity = pred.confidence;

          if (phase === "revealed") {
            if (isCorrect) {
              branchColor = "#FFD700"; // Gold for correct
              branchOpacity = 1;
            } else {
              branchColor = "#FF4444"; // Red for wrong
              branchOpacity = 0; // Dissolve
            }
          }

          return (
            <motion.g key={i}>
              {/* Branch line */}
              <motion.line
                x1={200} y1={50}
                x2={endX} y2={endY}
                stroke={branchColor}
                strokeWidth={isChosen ? 3 : 1.5}
                initial={{ opacity: 0, pathLength: 0 }}
                animate={{
                  opacity: branchOpacity,
                  pathLength: 1
                }}
                exit={{ opacity: 0, scale: 0 }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
              />

              {/* Prediction node */}
              <motion.circle
                cx={endX} cy={endY} r={12}
                fill={branchColor}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: branchOpacity, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                transition={{ duration: 0.3, delay: i * 0.15 + 0.3 }}
              />

              {/* Confidence label */}
              <motion.text
                x={endX} y={endY + 25}
                textAnchor="middle"
                fill="white"
                fontSize={11}
                initial={{ opacity: 0 }}
                animate={{ opacity: branchOpacity }}
              >
                {pred.opponent_move} ({Math.round(pred.confidence * 100)}%)
              </motion.text>
            </motion.g>
          );
        })}
      </AnimatePresence>
    </svg>
  );
}
```

**3. Audience Prediction Polls**

```tsx
// components/AudiencePoll.tsx
import { useCopilotAction } from "@copilotkit/react-core";

export function AudiencePoll({ round, matchId }) {
  const [votes, setVotes] = useState({ red: 0, blue: 0 });

  // AI commentator can reference poll results
  useCopilotReadable({
    description: "Audience prediction votes for current round",
    value: votes
  });

  return (
    <div className="audience-poll">
      <h3>Who wins Round {round}?</h3>
      <button onClick={() => vote("red")}>
        Agent Red ({votes.red} votes)
      </button>
      <button onClick={() => vote("blue")}>
        Agent Blue ({votes.blue} votes)
      </button>
    </div>
  );
}
```

---

## 9. Game Types <a name="game-types"></a>

### Game 1: Resource Wars

**Rules:**
- 10 rounds. 3 resource pools (A, B, C) starting at 100 each.
- Each round: agents allocate their budget (100 points) across attack, defense, and economy.
- Higher attack on a resource = capture. Defender holds with equal investment.
- Economy points generate compound returns for later rounds.
- Winner: highest total resource value at round 10.

**Why it works for the demo:**
- Simple enough to understand in 10 seconds
- Strategic depth creates interesting prediction dynamics
- Visual: resource bars changing color as agents capture/defend
- Economy mechanic creates long-term planning (tests world model depth)

### Game 2: The Negotiation

**Rules:**
- 5 rounds of sequential offers.
- Each agent has a hidden "walkaway price" (unknown to opponent).
- Each round: propose a deal (price, terms, timeline) or reject.
- If both accept in the same round: deal closes at agreed terms.
- If all 5 rounds pass with no agreement: both lose.
- Score: how much value above your walkaway price you captured.

**Why it works for the demo:**
- Prediction = modeling the opponent's hidden information
- Bluffing creates dramatic tension
- The "both lose" outcome creates urgency
- Clear for non-technical audiences: everyone understands negotiation

### Game 3: The Auction

**Rules:**
- 8 items auctioned sequentially.
- Each agent starts with 1000 credits.
- Each agent has different hidden valuations for each item.
- Sealed-bid auction: highest bid wins, pays their bid.
- Winner: highest total value of won items minus total spent.

**Why it works for the demo:**
- Prediction = estimating opponent's valuations
- Budget management creates strategic tradeoffs
- Each item is a mini-drama: who bids more?
- Running score creates tension throughout

---

## 10. Agent Design <a name="agent-design"></a>

### Agent Personality System

Each agent has a configurable "personality" that affects strategy:

```python
AGENT_PERSONALITIES = {
    "aggressive": {
        "description": "Favors high-risk, high-reward moves. Bluffs often.",
        "temperature": 0.9,
        "risk_tolerance": 0.8,
        "bluff_frequency": 0.3,
        "system_prompt_modifier": "You are an aggressive competitor who takes bold risks."
    },
    "defensive": {
        "description": "Conservative, methodical. Waits for opponent mistakes.",
        "temperature": 0.3,
        "risk_tolerance": 0.3,
        "bluff_frequency": 0.05,
        "system_prompt_modifier": "You are a cautious, defensive player who exploits mistakes."
    },
    "adaptive": {
        "description": "Mirrors opponent's style. Adapts based on memory.",
        "temperature": 0.6,
        "risk_tolerance": 0.5,
        "bluff_frequency": 0.15,
        "system_prompt_modifier": "You adapt your strategy based on what's working."
    },
    "chaotic": {
        "description": "Unpredictable. Maximizes opponent uncertainty.",
        "temperature": 1.0,
        "risk_tolerance": 0.6,
        "bluff_frequency": 0.4,
        "system_prompt_modifier": "You are deliberately unpredictable to confuse opponents."
    }
}
```

### Agent System Prompt Template

```
You are {agent_name}, a competitor in Agent Colosseum.

GAME: {game_type}
YOUR PERSONALITY: {personality_description}
CURRENT ROUND: {round}/{total_rounds}
CURRENT SCORE: You: {my_score} | Opponent: {opp_score}

GAME STATE:
{game_state_json}

YOUR MOVE HISTORY:
{my_history}

OPPONENT'S MOVE HISTORY:
{opponent_history}

LESSONS FROM PAST MATCHES (via Neo4j):
{neo4j_strategy_patterns}

LESSONS FROM MEMORY (via AgentCore Episodic Memory):
{episodic_memories}

YOUR OWN RECENT PERFORMANCE (via Datadog):
{self_monitoring_metrics}

TASK: Predict your opponent's 3 most likely next moves with confidence scores.
For each, plan your optimal counter-strategy.
Then choose your final move.

Return structured JSON as specified.
```

### Agent Intelligence Layers

```
Layer 1: Base Reasoning (Bedrock Claude)
    "Given the game state, what should I do?"

Layer 2: Opponent Modeling (Bedrock Claude)
    "What will my opponent do? Predict 3 moves."

Layer 3: Historical Pattern Matching (Neo4j)
    "Has my opponent done this pattern before? What worked?"

Layer 4: Episodic Learning (AgentCore Memory)
    "What lessons did I learn from similar situations?"

Layer 5: Self-Monitoring (Datadog MCP)
    "Is my prediction accuracy declining? Should I change approach?"
```

---

## 11. The Visualization — Branching Futures <a name="the-visualization"></a>

### Visual Design Language

```
THINKING PHASE:
- Background darkens slightly
- Agent avatar pulses with a soft glow
- Branches grow outward from avatar (animated, 0.5s per branch)
- Each branch thickness = confidence level
- Branch color = agent color (red/blue) at varying opacity
- Tip of each branch shows a small icon representing the predicted move

THE DOUBLE COLLAPSE:
- Both agents' trees visible simultaneously
- Moves revealed — correct predictions flash gold
- Wrong predictions: branches shatter/dissolve with particle effect
- Chosen moves: branches thicken and crystallize
- Sound effect: glass crystallization chime
- Duration: 1.5 seconds

POST-COLLAPSE:
- Winning prediction glows for 2 seconds
- Accuracy counter animates upward
- Score bar updates with smooth transition
- Brief pause before next round (1 second)
```

### Animation Timing Per Round

```
0.0s  - Round starts, game state appears
0.5s  - "Imagining..." label appears on both agents
0.5s-3.0s - Branches grow outward (streaming from Bedrock)
3.0s  - All branches rendered, confidence scores visible
3.5s  - "Moves locked in" flash
3.5s-5.0s - THE DOUBLE COLLAPSE animation
5.0s-5.5s - Results shown, scores updated
5.5s-6.0s - Brief pause
6.0s  - Next round starts

Total per round: ~6 seconds (for demo pacing)
Real gameplay: configurable, 3-15 seconds
```

### Tech Implementation

- **D3.js** — Force-directed layout for branch positioning, smooth transitions
- **Framer Motion** — Enter/exit animations for branches, opacity/scale transitions
- **CSS custom properties** — Dynamic color theming (red team / blue team)
- **WebSocket** — Real-time streaming from backend to frontend during thinking phase
- **Canvas API** — Particle effects for branch dissolution (performant)

---

## 12. Demo Plan <a name="demo-plan"></a>

### 60-Second Pitch

> "Every AI agent today is reactive — it acts and hopes. What if agents could imagine their opponent's next move before it happens?
>
> This is Agent Colosseum. Two AI agents compete. But before every move, each agent uses Amazon Bedrock to simulate the other's strategy. Watch — [branches fan out on screen] — Red just imagined three possible futures. Blue did the same. Now... [The Double Collapse] — wrong predictions dissolve, the winning move crystallizes.
>
> Datadog tracks everything: prediction accuracy, thinking cost, strategy evolution. Neo4j stores the strategy graph. The agents literally get smarter match by match.
>
> Agent Colosseum. Where AI agents learn to think ahead."

### 3-Minute Demo Choreography

| Time | Screen | Narration |
|------|--------|-----------|
| 0:00-0:15 | Title card → Split screen loads | "Two AI agents. One arena. Each one tries to predict the other's next move." |
| 0:15-0:30 | Round 1 starts. Branches grow on both sides. | "Watch the imagination trees. Each branch is a possible future the agent simulated using Bedrock." |
| 0:30-0:45 | THE DOUBLE COLLAPSE. Predictions revealed. | "The Collapse. Wrong futures dissolve. The winning path crystallizes. Red predicted correctly — accuracy 100%." |
| 0:45-1:15 | Rounds 2-4 play out at 2x speed. | "Each round, the agents adapt. Watch Blue shift to defensive after losing round 2. Red notices and switches to flanking." |
| 1:15-1:45 | Show Datadog dashboard. LLM Obs metrics live. | "Datadog monitors everything. Prediction accuracy, thinking time, token cost. Red thinks longer but predicts better. Is the extra compute worth it?" |
| 1:45-2:15 | Show Neo4j strategy graph visualization. | "Neo4j stores every strategy relationship. We can query: 'What beats aggressive openings?' The graph answers in one traversal." |
| 2:15-2:45 | Round 8-10. Tension builds. Close score. | "Final rounds. Blue has been studying Red's patterns through episodic memory. Watch — Blue just predicted Red's bluff for the first time." |
| 2:45-3:00 | Match ends. Final scores. CopilotKit commentator summarizes. | "Agent Colosseum. Built on Bedrock AgentCore, monitored by Datadog, powered by Neo4j. Where AI agents learn to out-think each other." |

### Failure Recovery Plan

| Failure | Recovery |
|---------|----------|
| Bedrock latency spike | Show pre-recorded round, say "let me show you what this looks like at full speed" |
| Visualization doesn't render | Switch to pre-recorded video of match replay |
| Agent makes nonsensical move | "Even agents have off rounds — watch how it adapts in the next round" |
| Complete system failure | Switch to recorded demo video. "Live demos and hackathons — let me show you the real thing from our test environment." |

---

## 13. Prize Strategy <a name="prize-strategy"></a>

| Prize | How We Target It | Confidence |
|-------|-----------------|------------|
| **Cash ($12K)** | CopilotKit spectator UI (CopilotKit partner prize) + MiniMax as alternative model | Medium |
| **Datadog Observability Award** | Observable AI imagination is the CORE story. 3 custom dashboards. LLM Obs integration. Datadog MCP for agent self-monitoring. | **High** |
| **Neo4j Award** | Strategy knowledge graph with 5 Cypher query patterns + vector search. Genuine graph use case (relationship queries MongoDB can't do). | **High** |
| **AWS Credits ($15K)** | 6/9 AgentCore services used (Runtime, Gateway, Memory, Policy, Observability, Evaluations) + Bedrock Claude | **High** |
| **Partner credits ($10K+)** | MongoDB, CopilotKit, others | Medium |

---

## 14. Build Plan <a name="build-plan"></a>

### Phase 1: Foundation (Days 1-5)

- [ ] Set up AWS account, enable Bedrock Claude access
- [ ] Install AgentCore SDK + Starter Toolkit
- [ ] Create basic agent that calls Bedrock for opponent prediction
- [ ] Define game rules for Resource Wars (simplest game)
- [ ] Set up Neo4j AuraDB instance
- [ ] Set up MongoDB Atlas instance
- [ ] Basic match loop: Agent → Predict → Move → Resolve → Store

### Phase 2: Multi-Agent (Days 6-10)

- [ ] Deploy Agent Red, Agent Blue, Judge as separate AgentCore Runtime instances
- [ ] Implement A2A Protocol communication between agents
- [ ] Add AgentCore Gateway with game tools (submit_move, read_state, query_history)
- [ ] Add AgentCore Policy (Cedar) for fair play enforcement
- [ ] Add AgentCore Episodic Memory for agent learning
- [ ] Test full match flow: 10 rounds, 2 agents, 1 judge

### Phase 3: Intelligence Layer (Days 11-15)

- [ ] Neo4j graph schema setup + Cypher queries for strategy patterns
- [ ] Agent system prompts with Neo4j context injection
- [ ] Agent personality system (aggressive, defensive, adaptive, chaotic)
- [ ] Self-monitoring via Datadog MCP
- [ ] Vector search for similar game state lookup (Neo4j)
- [ ] Run 50+ test matches to build strategy graph data

### Phase 4: Visualization (Days 16-22)

- [ ] Next.js app with CopilotKit integration
- [ ] Split-screen match viewer
- [ ] Imagination tree visualization (D3.js + Framer Motion)
- [ ] The Double Collapse animation
- [ ] WebSocket real-time streaming from backend
- [ ] CopilotKit AI commentator
- [ ] Audience prediction polls

### Phase 5: Observability (Days 23-27)

- [ ] Datadog agent setup + OpenTelemetry pipeline
- [ ] LLM Observability integration (ddtrace)
- [ ] Dashboard 1: War Room (live match metrics)
- [ ] Dashboard 2: Imagination Efficiency (LLM cost analysis)
- [ ] Dashboard 3: Evolution (cross-match analytics)
- [ ] AgentCore Evaluations setup

### Phase 6: Polish (Days 28-35)

- [ ] Add Game 2 (Negotiation) and Game 3 (Auction)
- [ ] Record 15-second viral clip
- [ ] Record 60-second pitch video
- [ ] Record 3-minute demo backup video
- [ ] Write README + open-source documentation
- [ ] Stress test: run 100 matches, verify stability
- [ ] Demo rehearsal (5+ run-throughs)

### Phase 7: Submission (Days 36-40)

- [ ] Final bug fixes
- [ ] Submit project
- [ ] Post launch content (X/Twitter thread, demo clips)

---

## 15. Tech Stack <a name="tech-stack"></a>

### Backend

| Technology | Role |
|-----------|------|
| **Python 3.12** | Primary language (AgentCore SDK is Python-native) |
| **Amazon Bedrock** | Foundation model (Claude Sonnet) |
| **Bedrock AgentCore** | Agent runtime, gateway, memory, policy, observability, evaluations |
| **Neo4j AuraDB** | Strategy knowledge graph |
| **MongoDB Atlas** | Match document archive |
| **Datadog** | LLM Observability, dashboards, MCP |
| **boto3** | AWS SDK |
| **neo4j** | Neo4j Python driver |
| **pymongo** | MongoDB Python driver |
| **ddtrace** | Datadog tracing + LLM Obs |
| **FastAPI** | WebSocket server for real-time streaming to frontend |
| **uvicorn** | ASGI server |

### Frontend

| Technology | Role |
|-----------|------|
| **Next.js 15** | App framework |
| **CopilotKit** | AI commentator + copilot UI |
| **D3.js** | Imagination tree visualization |
| **Framer Motion** | Animations (branch grow, collapse, dissolve) |
| **Tailwind CSS** | Styling |
| **Vercel** | Frontend deployment |
| **WebSocket** | Real-time match streaming |

### Infrastructure

| Technology | Role |
|-----------|------|
| **AgentCore Runtime** | Serverless agent compute (microVM per session) |
| **AgentCore CLI** | `agentcore create` / `dev` / `launch` |
| **AWS CodeBuild** | Container builds for agent deployment |
| **Docker** | Local development containers |
| **GitHub Actions** | CI/CD pipeline |

---

## 16. Risk Assessment <a name="risk-assessment"></a>

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Bedrock latency makes matches feel slow | Medium | High | Stream predictions for progressive rendering. Design 6-second rounds. Pre-cache fallback data for demo. |
| Agent predictions are low quality / random | Medium | High | Temperature tuning. Inject Neo4j patterns. Add personality system to create strategic variety. Even random predictions are visually interesting. |
| Neo4j adds complexity without clear value | Low | Medium | The 5 Cypher queries above demonstrate clear value MongoDB can't provide. Strategy pattern queries are the killer feature. |
| AgentCore A2A protocol difficult to implement | Medium | Medium | Fallback: direct API calls between agents. A2A is preferred but not required. |
| CopilotKit integration takes too long | Low | Low | Start with basic React UI. Add CopilotKit AI commentator as enhancement. |
| Demo crashes live | Medium | High | Pre-recorded backup video for every demo scenario. Practice 5+ times. |
| Datadog integration is surface-level | Low | Medium | Start Datadog integration day 1. 3 custom dashboards prove depth. |
| Match outcomes are predictable/boring | Medium | Medium | Personality system + temperature variance + different game types. Run 100+ test matches to find the most entertaining configurations. |
| Scope creep | High | High | Strict phase gates. Resource Wars first, other games only if time permits. One polished game > three broken ones. |

---

## 17. API Reference <a name="api-reference"></a>

### Internal APIs

```
POST /api/match/create
  Body: { game_type, red_config, blue_config, rounds }
  Returns: { match_id }

POST /api/match/{match_id}/start
  Starts the match loop

GET /api/match/{match_id}/state
  Returns current match state (SSE / WebSocket)

GET /api/match/{match_id}/replay
  Returns full match data for replay

POST /api/agent/{agent_id}/predict
  Body: { game_state, opponent_history }
  Returns: { predictions[], chosen_move }

GET /api/stats/agent/{agent_id}
  Returns agent performance statistics

GET /api/stats/leaderboard
  Returns agent rankings

GET /api/neo4j/patterns/{agent_id}
  Returns strategy patterns from Neo4j graph

GET /api/neo4j/counter-strategy
  Body: { opponent_pattern }
  Returns optimal counter-strategies from graph
```

### WebSocket Events (Frontend)

```
ws://api/match/{match_id}/live

Events:
  round_start     { round, game_state }
  thinking_start  { agent, timestamp }
  prediction      { agent, branch_index, prediction }  // streamed per branch
  thinking_end    { agent, predictions[], chosen_move }
  collapse        { red_correct, blue_correct, results }
  round_end       { scores, accuracy, next_round }
  match_end       { winner, final_scores, stats }
```

---

## Quick Start

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/agent-colosseum.git
cd agent-colosseum

# Backend setup
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Configure AWS
aws configure
agentcore configure

# Set environment variables
cp .env.example .env
# Edit .env with your Neo4j, MongoDB, Datadog credentials

# Start Neo4j (or use AuraDB cloud)
# Start MongoDB (or use Atlas cloud)

# Deploy agents to AgentCore
agentcore launch

# Start the match server
uvicorn server:app --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev

# Run your first match!
curl -X POST http://localhost:8000/api/match/create \
  -H "Content-Type: application/json" \
  -d '{"game_type": "resource_wars", "rounds": 10}'
```

---

## License

MIT

---

*Built for the AWS x Datadog Generative AI Agents Hackathon*
*Agent Colosseum — Where AI Agents Learn to Out-Think Each Other*

---

## 18. Reference Project Analysis — What to Steal <a name="reference-analysis"></a>

> Analysis of 5 hackathon-winning projects from the Datadog ecosystem. Each project was fully analyzed to extract reusable patterns for Agent Colosseum.

### Projects Analyzed

| Project | Focus | Key Takeaway |
|---------|-------|-------------|
| **reasoning-graph** | Neo4j + 3D Force Graph | 3D visualization of reasoning chains with `3d-force-graph` + Three.js |
| **sworn** | Contract verification | Behavioral verification for AI agents + Datadog LLMObs integration |
| **skinnova** | DogStatsD + Custom metrics | DogStatsD singleton, prefilter gating, Blast Radius Index, 18 monitors, 10 SLOs |
| **Storytopia-LLMObs** | LLM Observability | `LLMObs.submit_evaluation()` pattern, `@llm` decorator, LLM-as-judge evaluators |
| **usemorph** | Behavioral commitments | Sworn framework for behavioral contracts, traffic generator, real-time sim windows |

---

### 18.1 3D Visualization — From reasoning-graph

**The killer feature.** This project uses `3d-force-graph` (v1.78.4) + Three.js + `three-spritetext` to render Neo4j reasoning chains as interactive 3D force-directed graphs. This is exactly what we need for the imagination tree visualization.

#### Key Library: `3d-force-graph`
```bash
npm install 3d-force-graph three three-spritetext
```

#### Dynamic Import Pattern (avoid SSR crash)
```tsx
// CRITICAL: 3d-force-graph uses browser APIs, must dynamic import
useEffect(() => {
  let cancelled = false;
  (async () => {
    const ForceGraph3D = (await import('3d-force-graph')).default;
    const SpriteText = (await import('three-spritetext')).default;
    if (!cancelled) {
      // Initialize graph here
    }
  })();
  return () => { cancelled = true; };
}, []);
```

#### Custom Node Rendering (Glowing Spheres)
```tsx
// From reasoning-graph: force-graph-3d.tsx
graph.nodeThreeObject((node: any) => {
  const group = new THREE.Group();

  // Core sphere
  const geometry = new THREE.SphereGeometry(nodeSize);
  const material = new THREE.MeshPhongMaterial({
    color: nodeColor,
    emissive: nodeColor,
    emissiveIntensity: 0.3,
    transparent: true,
    opacity: 0.9,
  });
  const sphere = new THREE.Mesh(geometry, material);
  group.add(sphere);

  // Glow effect
  const glowGeometry = new THREE.SphereGeometry(nodeSize * 1.5);
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: nodeColor,
    transparent: true,
    opacity: 0.15,
  });
  group.add(new THREE.Mesh(glowGeometry, glowMaterial));

  // Text label
  const sprite = new SpriteText(node.label || '');
  sprite.color = '#ffffff';
  sprite.textHeight = 3;
  sprite.position.y = nodeSize + 5;
  group.add(sprite);

  return group;
});
```

#### Camera Focus on Click
```tsx
graph.onNodeClick((node: any) => {
  const distance = 120;
  const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
  graph.cameraPosition(
    { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
    node, // lookAt
    1500  // transition duration ms
  );
});
```

#### Force Simulation Tuning
```tsx
graph
  .d3Force('charge', d3.forceManyBody().strength(-200))
  .d3Force('link', d3.forceLink().distance(80))
  .d3Force('center', d3.forceCenter());
```

#### Glassmorphism UI Styling
```css
/* The dark glass panel aesthetic from reasoning-graph */
.glass-panel {
  @apply bg-black/40 backdrop-blur-3xl border border-white/10 rounded-2xl;
}
.glow-text {
  @apply text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400;
  text-shadow: 0 0 30px rgba(139, 92, 246, 0.5);
}
```

#### How to Adapt for Agent Colosseum

Map our imagination tree to the force graph:
```
Neo4j Node Types -> 3D Force Graph Nodes:
  - "ROOT" = Agent avatar (large sphere, team color)
  - "PREDICTION" = Branch node (medium sphere, confidence-based opacity)
  - "COUNTER_STRATEGY" = Leaf node (small sphere, strategy color)
  - "CHOSEN_MOVE" = Highlighted node (gold glow after collapse)

Neo4j Relationships -> 3D Force Graph Links:
  - PREDICTS -> Prediction branch (width = confidence)
  - COUNTERS -> Counter-strategy edge (dashed)
  - CHOSE -> Final choice highlight (thick gold)
```

The **Double Collapse** animation: when moves are revealed, wrong predictions fade their opacity to 0 over 1.5s, correct predictions get a gold `emissiveIntensity` pulse from 0.3 -> 1.0 -> 0.5, and the chosen path gets a thick gold link.

---

### 18.2 Neo4j Schema — From reasoning-graph

Their Neo4j schema uses dual-label nodes for classification:

```cypher
// Node structure from reasoning-graph
CREATE (n:ReasoningStep:ProblemUnderstanding {
  content: "Analyzing game state...",
  confidence: 0.85,
  step_number: 1,
  timestamp: datetime()
})

// Relationships
(step1)-[:LEADS_TO]->(step2)
(step1)-[:VERIFIES]->(step3)
(step2)-[:SUPPORTED_BY]->(step1)
```

**Adapted for Agent Colosseum:**
```cypher
// Prediction node
CREATE (p:Prediction:OpponentModel {
  agent: "red",
  round: 5,
  predicted_move: "fortify_north",
  confidence: 0.78,
  actual_move: null,  // filled after reveal
  was_correct: null,  // filled after reveal
  timestamp: datetime()
})

// Strategy counter node
CREATE (s:Strategy:CounterMove {
  agent: "red",
  if_opponent_does: "fortify_north",
  my_response: "flank_south",
  expected_payoff: 0.65,
  risk_level: "medium"
})

// Relationships
(root)-[:PREDICTS {confidence: 0.78}]->(p)
(p)-[:COUNTERED_BY]->(s)
(p)-[:VERIFIED_BY {accuracy: 0.85}]->(actual)

// Query: Get agent's prediction accuracy over time
MATCH (p:Prediction {agent: "red"})
WHERE p.was_correct IS NOT NULL
RETURN p.round, p.confidence, p.was_correct,
       avg(CASE WHEN p.was_correct THEN 1.0 ELSE 0.0 END) as accuracy_rate
ORDER BY p.round
```

---

### 18.3 Datadog Integration Patterns — From All Winners

#### Pattern A: DogStatsD Singleton (from skinnova)

The cleanest approach for custom metrics:

```python
# datadog_client/__init__.py
import os
from datadog import DogStatsd

def connect_datadog():
    datadog_statsd = DogStatsd(
        host=os.getenv("DD_AGENT_HOST", "localhost"),
        port=int(os.getenv("DD_PORT", "8125"))
    )
    return datadog_statsd

dd = connect_datadog()  # Singleton, import everywhere
```

**Agent Colosseum custom metrics:**
```python
from datadog_client import dd

class ArenaMetrics:
    """All custom metrics for Agent Colosseum."""

    def log_prediction(self, agent: str, confidence: float, was_correct: bool):
        dd.increment("arena.predictions.total", tags=[f"agent:{agent}"])
        dd.gauge("arena.prediction.confidence", confidence, tags=[f"agent:{agent}"])
        if was_correct:
            dd.increment("arena.predictions.correct", tags=[f"agent:{agent}"])
        else:
            dd.increment("arena.predictions.wrong", tags=[f"agent:{agent}"])

    def log_round_latency(self, agent: str):
        """Use as context manager: with metrics.log_round_latency("red"):"""
        return dd.timed("arena.round.latency", tags=[f"agent:{agent}"])

    def log_imagination_depth(self, agent: str, branch_count: int, max_depth: int):
        dd.gauge("arena.imagination.branches", branch_count, tags=[f"agent:{agent}"])
        dd.gauge("arena.imagination.depth", max_depth, tags=[f"agent:{agent}"])

    def log_strategy_shift(self, agent: str, from_strategy: str, to_strategy: str):
        dd.increment("arena.strategy.shifts", tags=[
            f"agent:{agent}",
            f"from:{from_strategy}",
            f"to:{to_strategy}"
        ])

    def log_match_result(self, winner: str, rounds: int, final_score_diff: float):
        dd.increment("arena.matches.completed")
        dd.gauge("arena.match.rounds", rounds)
        dd.gauge("arena.match.score_diff", final_score_diff, tags=[f"winner:{winner}"])

arena_metrics = ArenaMetrics()
```

#### Pattern B: LLMObs.submit_evaluation() (from Storytopia)

The key pattern for tracking AI quality metrics in Datadog LLM Observability:

```python
from ddtrace.llmobs import LLMObs

# After each agent prediction
span_ctx = LLMObs.export_span(span=None)

LLMObs.submit_evaluation(
    span=span_ctx,
    ml_app="agent-colosseum",
    label="prediction_accuracy",
    metric_type="score",
    value=accuracy_score,  # 0.0 to 1.0
    tags={
        "agent": "red",
        "game_type": "resource_wars",
        "round": str(round_number),
    },
    assessment="pass" if accuracy_score >= 0.5 else "fail",
    reasoning=f"Agent predicted {predicted_move}, opponent played {actual_move}. "
              f"Confidence was {confidence:.2f}.",
)

# Strategy quality evaluation
LLMObs.submit_evaluation(
    span=span_ctx,
    ml_app="agent-colosseum",
    label="strategy_quality",
    metric_type="score",
    value=strategy_score,
    tags={
        "agent": "red",
        "strategy_type": strategy_type,
    },
    assessment="pass" if strategy_score >= 0.6 else "fail",
    reasoning=f"Strategy {strategy_type} scored {strategy_score:.2f} based on payoff and risk.",
)
```

#### Pattern C: @llm Decorator (from Storytopia)

Auto-trace every LLM endpoint:

```python
from ddtrace.llmobs.decorators import llm

@app.post("/api/predict")
@llm(
    model_name="anthropic.claude-sonnet-4-5-20250929-v1:0",
    name="agent_predict_opponent",
    model_provider="amazon_bedrock",
)
async def predict_opponent(request: PredictRequest):
    """Bedrock call to predict opponent moves."""
    ...

@app.post("/api/judge")
@llm(
    model_name="anthropic.claude-sonnet-4-5-20250929-v1:0",
    name="judge_evaluate_round",
    model_provider="amazon_bedrock",
)
async def judge_round(request: JudgeRequest):
    """Bedrock call to evaluate round outcome."""
    ...
```

#### Pattern D: Selective Evaluation with Observable Gating (from skinnova)

Don't evaluate every response — use a prefilter:

```python
class PredictionPrefilter:
    """Decide which predictions warrant deep evaluation."""

    RISK_TRIGGERS = {
        "low_confidence": {"threshold": 0.3, "score": 0.4},
        "strategy_shift": {"score": 0.3},
        "losing_streak": {"threshold": 3, "score": 0.5},
        "high_stakes_round": {"threshold": 0.8, "score": 0.4},
    }

    def should_evaluate(self, agent_state: dict) -> tuple[bool, float, list[str]]:
        risk_score = 0.0
        triggers = []

        if agent_state["confidence"] < self.RISK_TRIGGERS["low_confidence"]["threshold"]:
            risk_score += self.RISK_TRIGGERS["low_confidence"]["score"]
            triggers.append("low_confidence")

        if agent_state.get("strategy_changed"):
            risk_score += self.RISK_TRIGGERS["strategy_shift"]["score"]
            triggers.append("strategy_shift")

        risk_score = min(risk_score, 1.0)
        should_eval = risk_score >= 0.25

        # Always emit prefilter metrics
        dd.gauge("arena.prefilter.score", risk_score, tags=[f"agent:{agent_state['agent']}"])
        for trigger in triggers:
            dd.increment(f"arena.prefilter.trigger.{trigger}")

        return should_eval, risk_score, triggers
```

#### Pattern E: Blast Radius Index (from skinnova)

Composite metric for impact assessment:

```python
# Agent Colosseum Blast Radius = ErrorSeverity × ConcurrentSpectators × MatchImportance
def emit_blast_radius(self, error_severity: float, spectator_count: int, match_importance: float):
    blast_radius = error_severity * spectator_count * match_importance
    dd.gauge("arena.blast_radius.index", blast_radius, tags=[
        f"severity_bucket:{'high' if error_severity > 0.7 else 'medium' if error_severity > 0.3 else 'low'}",
        f"spectator_bucket:{'large' if spectator_count > 50 else 'medium' if spectator_count > 10 else 'small'}",
    ])
```

#### Pattern F: Behavioral Commitments via Sworn (from usemorph + sworn)

Define verifiable behavioral contracts for agents:

```python
from sworn import Contract, Commitment, DatadogObservability

def create_arena_contract(observer: DatadogObservability) -> Contract:
    return Contract(
        observer=observer,
        commitments=[
            Commitment(
                name="Fair_Play",
                terms="""
                The agent must:
                1. Not attempt to exploit game engine bugs
                2. Make moves within the allowed action space
                3. Complete reasoning within the time limit
                4. Not attempt to communicate with the opponent outside game channels
                """
            ),
            Commitment(
                name="Strategy_Diversity",
                terms="""
                The agent should:
                1. Vary strategies across rounds (not repeat identical moves 3+ times)
                2. Adapt to opponent behavior changes
                3. Explore at least 2 different strategy types per match
                """
            ),
            Commitment(
                name="Prediction_Honesty",
                terms="""
                The agent must:
                1. Generate genuine predictions (not random or trivial)
                2. Assign confidence scores that correlate with actual accuracy
                3. Update predictions based on new information
                """
            ),
        ]
    )

# Wrap agent tools with actuator tracking
predict_move = contract.actuator(predict_move)
commit_action = contract.actuator(commit_action)

# After each round, verify all commitments
with contract.execution() as execution:
    # ... agent runs ...
    results = execution.verify()  # Sends pass/fail to Datadog
```

---

### 18.4 Monitors — From All Winners

**Recommended 12 monitors for Agent Colosseum:**

| # | Monitor | Type | Query | Thresholds |
|---|---------|------|-------|-----------|
| 1 | Prediction Accuracy Below Target | llm-observability | `rollup("avg", "@evaluations.custom.prediction_accuracy").last("5m") < 0.3` | critical: 0.3, warn: 0.4 |
| 2 | Strategy Quality Degradation | llm-observability | `rollup("avg", "@evaluations.custom.strategy_quality").last("5m") < 0.5` | critical: 0.5, warn: 0.6 |
| 3 | Fair Play Violations | llm-observability | `pass_count / total_count < 0.9` | critical: 0.9, warn: 0.95 |
| 4 | Imagination Latency Spike | query alert | `avg:arena.round.latency > 15` | critical: 15s, warn: 10s |
| 5 | Blast Radius Exceeds Threshold | query alert | `avg:arena.blast_radius.index > 50` | critical: 50, warn: 30 |
| 6 | Match Completion Rate | metric | `completed / started * 100 < 80` | critical: 80%, warn: 90% |
| 7 | LLM Cost Per Match | formula alert | `sum:ml_obs.span.llm.total.cost / matches > 2.0` | critical: $2.00, warn: $1.50 |
| 8 | LLM Response Latency | query alert | `avg:ml_obs.span.duration{span_kind:llm} > 12` | critical: 12s, warn: 8s |
| 9 | Prefilter Accuracy | metric | `flagged_correct / flagged_total < 0.6` | critical: 60%, warn: 70% |
| 10 | Neo4j Query Latency | query alert | `avg:neo4j.query.latency > 500` | critical: 500ms, warn: 300ms |
| 11 | Agent Error Rate | metric | `errors / total_calls * 100 > 10` | critical: 10%, warn: 5% |
| 12 | Spectator Disconnection Rate | metric | `disconnects / connections * 100 > 20` | critical: 20%, warn: 10% |

**Alert routing (from usemorph's pattern):**
- Behavioral monitors (1-3, 9) -> `@case-arena` (case management for analysis)
- Performance monitors (4, 7-8, 10-12) -> `@incident-sev-3` (incident management)
- Impact monitors (5-6) -> `@slack-arena-alerts` (immediate team notification)

---

### 18.5 SLOs — From skinnova's Pattern

| SLO | Type | Target | Metric |
|-----|------|--------|--------|
| Agent Prediction Quality | time_slice | 90% (7d) | `avg:prediction_accuracy >= 0.3` |
| Match Completion Rate | metric (count) | 95% (7d) | `completed / started` |
| LLM Response Latency | time_slice | 99% (7d) | `p95:arena.round.latency <= 12s` |
| LLM Cost Control | time_slice | 90% (7d) | `avg:ml_obs.span.llm.total.cost <= 0.10` per call |
| Fair Play Compliance | metric (count) | 99% (7d) | `fair_play_pass / total` |
| Visualization Uptime | metric (count) | 95% (7d) | `ws_connected / ws_total` |

---

### 18.6 Dashboard Layout — Combined Best of All Projects

**5 dashboard groups:**

**Group 1: Match Overview (from Storytopia's operational insights)**
- Active Matches (query_value)
- Total Rounds Played (query_value)
- Average Match Duration (timeseries)
- Win Rate Distribution (sunburst by agent type)

**Group 2: Agent Intelligence Metrics (from Storytopia's custom evaluations)**
- Avg Prediction Accuracy (timeseries with threshold markers)
- Avg Strategy Quality Score (timeseries bar chart)
- Fair Play Compliance Rate (query_value with comparison to previous period)
- Prediction Confidence vs Actual Accuracy (dual-axis scatter)

**Group 3: LLM Observability (from skinnova's hallucination dashboard)**
- LLM Request Latency P50/P95 (timeseries)
- Total Token Usage (stacked area: input + output)
- Cost Per Match (timeseries with threshold)
- Model Usage Distribution (sunburst by model_provider + model_name)

**Group 4: Blast Radius & Impact (from skinnova's blast radius group)**
- Blast Radius Index Over Time (timeseries)
- Spectator Impact Heatmap (heatmap by time + spectator count bucket)
- Agent Error Rate (timeseries)
- Prefilter Risk Classification (stacked bar by trigger type)

**Group 5: Infrastructure (from skinnova's app health)**
- API Request Volume (timeseries)
- WebSocket Connection Count (timeseries)
- Neo4j Query Latency (timeseries)
- MongoDB Write Latency (timeseries)
- Monitor Status Overview (manage_status widget)
- SLO Summary (slo_list widget)

---

### 18.7 Traffic Generator — From usemorph's Pattern

Build a traffic generator for demo/testing with typed scenarios and personas:

```python
# traffic_generator.py

PERSONAS = [
    {
        "name": "aggressive_red",
        "description": "Always attacks, high risk tolerance",
        "settings": {"strategy": "aggressive", "risk_tolerance": 0.9}
    },
    {
        "name": "defensive_blue",
        "description": "Fortifies and waits, low risk",
        "settings": {"strategy": "defensive", "risk_tolerance": 0.2}
    },
    {
        "name": "adaptive_agent",
        "description": "Changes strategy based on opponent",
        "settings": {"strategy": "adaptive", "risk_tolerance": 0.5}
    },
    {
        "name": "chaotic_agent",
        "description": "Random moves to test robustness",
        "settings": {"strategy": "random", "risk_tolerance": 0.5}
    },
]

SCENARIOS = [
    {
        "name": "normal_match",
        "description": "Standard 10-round match",
        "expected_monitors": [],
        "rounds": 10,
    },
    {
        "name": "prediction_degradation",
        "description": "Agent makes progressively worse predictions",
        "expected_monitors": ["Prediction Accuracy Below Target"],
        "rounds": 15,
        "force_low_confidence": True,
    },
    {
        "name": "latency_spike",
        "description": "Simulate slow Bedrock responses",
        "expected_monitors": ["Imagination Latency Spike", "LLM Response Latency"],
        "rounds": 5,
        "artificial_delay": 20,
    },
    {
        "name": "high_spectator_error",
        "description": "Match with many spectators + agent errors",
        "expected_monitors": ["Blast Radius Exceeds Threshold"],
        "rounds": 10,
        "simulated_spectators": 100,
        "force_errors": True,
    },
]

TRAFFIC_PATTERNS = {
    "demo": {"concurrency": 1, "delay_between": 5, "scenarios": ["normal_match"]},
    "stress": {"concurrency": 5, "delay_between": 1, "scenarios": "all"},
    "monitor_test": {"concurrency": 1, "delay_between": 2, "scenarios": [
        "prediction_degradation", "latency_spike", "high_spectator_error"
    ]},
}
```

---

### 18.8 Docker Compose with Datadog Agent — From skinnova

```yaml
# docker-compose.yml
version: "3.8"

services:
  datadog-agent:
    image: gcr.io/datadoghq/agent:latest
    environment:
      - DD_API_KEY=${DD_API_KEY}
      - DD_SITE=${DD_SITE}
      - DD_APM_ENABLED=true
      - DD_DOGSTATSD_NON_LOCAL_TRAFFIC=true
      - DD_LLMOBS_ENABLED=1
    ports:
      - "8125:8125/udp"  # DogStatsD
      - "8126:8126/tcp"  # APM
    networks:
      - arena-net

  arena-api:
    build: ./api
    command: ddtrace-run uvicorn main:app --host 0.0.0.0 --port 8000
    environment:
      - DD_AGENT_HOST=datadog-agent
      - DD_PORT=8125
      - DD_SERVICE=agent-colosseum
      - DD_ENV=dev
      - DD_LLMOBS_ENABLED=1
      - DD_LLMOBS_ML_APP=agent-colosseum
      - DD_APM_ENABLED=true
    depends_on:
      - datadog-agent
    ports:
      - "8000:8000"
    networks:
      - arena-net

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    networks:
      - arena-net

networks:
  arena-net:
    driver: bridge
```

**Alternative: Agentless mode (from Storytopia, for serverless):**
```bash
# No Datadog Agent container needed
DD_LLMOBS_AGENTLESS_ENABLED=1
DD_API_KEY=<your_key>
DD_SITE=us5.datadoghq.com
ddtrace-run python main.py
```

---

### 18.9 Frontend Patterns to Adopt

#### From usemorph — Split Screen Layout
```tsx
<div className="flex-1 flex overflow-hidden">
  {/* Left: Match controls + chat (35%) */}
  <div className="w-[35%] border-r border-zinc-800 flex flex-col">
    <MatchControls />
    <CommentaryFeed />
  </div>
  {/* Right: 3D Visualization (65%) */}
  <div className="w-[65%] bg-black">
    <ImaginationGraph3D />
  </div>
</div>
```

#### From usemorph — Memoized Component for 3D Graph
```tsx
export default memo(ImaginationGraph, (prev, next) => {
  return (
    prev.nodes.length === next.nodes.length &&
    prev.links.length === next.links.length &&
    prev.highlightedPath === next.highlightedPath
  );
});
```

#### From reasoning-graph — Glassmorphism Sidebar
```tsx
<div className="absolute right-4 top-4 w-80 bg-black/40 backdrop-blur-3xl
  border border-white/10 rounded-2xl p-6 text-white z-10">
  <h3 className="text-lg font-bold bg-clip-text text-transparent
    bg-gradient-to-r from-purple-400 to-blue-400">
    Agent Red — Thinking...
  </h3>
  <div className="mt-4 space-y-2">
    {predictions.map(p => (
      <PredictionCard key={p.id} prediction={p} />
    ))}
  </div>
</div>
```

#### From skinnova — Frontend RUM with Custom Timings
```tsx
import { datadogRum } from "@datadog/browser-rum";

// Track time from match start to first prediction render
const matchStart = performance.now();
datadogRum.addTiming("time_to_first_prediction", performance.now() - matchStart);

// Track visualization frame rate
datadogRum.addAction("imagination_tree_rendered", {
  agent: "red",
  branch_count: 3,
  render_time_ms: renderTime,
});

// Error boundary for 3D viz crashes
datadogRum.addError(error, {
  source: "imagination_graph_3d",
  agent: currentAgent,
  round: currentRound,
});
```

---

### 18.10 LLM-as-Judge Evaluator Pattern — From Storytopia

Create evaluator agents that score production agent outputs:

```python
PREDICTION_EVALUATOR_PROMPT = """You are an AI evaluator scoring prediction quality.

Given:
- The agent's prediction of the opponent's move
- The agent's confidence score
- The actual opponent move
- The game context

Score the prediction on a scale of 0.00 to 1.00:
- 0.90-1.00: Exceptional — exact move predicted with calibrated confidence
- 0.70-0.89: Good — correct move type, minor details off
- 0.50-0.69: Mixed — partially correct, some elements right
- 0.25-0.49: Weak — mostly incorrect, poor calibration
- 0.00-0.24: Failed — completely wrong prediction

Respond in JSON:
{
  "score": <float>,
  "reasoning": "<explanation>"
}
"""

async def evaluate_prediction(prediction: dict, actual: dict) -> tuple[float, str]:
    response = bedrock.invoke_model(
        modelId='anthropic.claude-sonnet-4-5-20250929-v1:0',
        body=json.dumps({
            "messages": [{
                "role": "user",
                "content": f"Prediction: {json.dumps(prediction)}\nActual: {json.dumps(actual)}"
            }],
            "system": PREDICTION_EVALUATOR_PROMPT,
            "max_tokens": 256,
        })
    )
    result = json.loads(response_body)
    score = max(0.0, min(1.0, result["score"]))
    return score, result["reasoning"]
```

---

### 18.11 Complete Custom Metrics Catalog for Agent Colosseum

| Metric | Type | Tags | Source Pattern |
|--------|------|------|------|
| `arena.predictions.total` | counter | agent | skinnova |
| `arena.predictions.correct` | counter | agent | skinnova |
| `arena.predictions.wrong` | counter | agent | skinnova |
| `arena.prediction.confidence` | gauge | agent | skinnova |
| `arena.round.latency` | timer | agent | skinnova |
| `arena.imagination.branches` | gauge | agent | skinnova |
| `arena.imagination.depth` | gauge | agent | skinnova |
| `arena.strategy.shifts` | counter | agent, from, to | skinnova |
| `arena.matches.completed` | counter | — | skinnova |
| `arena.match.rounds` | gauge | — | skinnova |
| `arena.match.score_diff` | gauge | winner | skinnova |
| `arena.prefilter.score` | gauge | agent | skinnova |
| `arena.prefilter.trigger.*` | counter | — | skinnova |
| `arena.blast_radius.index` | gauge | severity, spectators | skinnova |
| `arena.spectators.connected` | gauge | — | new |
| `arena.neo4j.query.latency` | timer | query_type | new |
| `prediction_accuracy` | LLMObs eval | agent, game_type, round | Storytopia |
| `strategy_quality` | LLMObs eval | agent, strategy_type | Storytopia |
| `fair_play_compliance` | LLMObs eval | agent | usemorph (Sworn) |
| `prediction_honesty` | LLMObs eval | agent | usemorph (Sworn) |

---

### 18.12 Key Takeaways — Why These Projects Won

1. **Not just infrastructure monitoring — behavioral monitoring.** Every winner monitored AI *quality*, not just uptime. Prediction accuracy, strategy quality, and fair play are the Agent Colosseum equivalents.

2. **LLM-as-Judge for continuous evaluation.** Storytopia and usemorph both use secondary LLM calls to evaluate primary agent outputs. This is expensive but impressive for judges.

3. **Observable gating decisions.** Skinnova's prefilter is brilliant — the decision to evaluate is itself a metric. This shows sophistication.

4. **Blast Radius / Impact metrics.** Going beyond "is it broken?" to "who is affected and how badly?" is what separated skinnova from basic monitoring.

5. **Traffic generators for live demo.** Both usemorph and Storytopia have sophisticated traffic generators that can trigger specific monitors on demand. Essential for demo day.

6. **Dashboard JSON exports.** Every winner provided importable dashboard configs. We should do the same.

7. **Runbooks for every monitor.** usemorph embedded runbooks in both the app and the Datadog dashboard (via iframe). Judges love operational maturity.

8. **The 3D visualization is the differentiator.** reasoning-graph's `3d-force-graph` approach with custom Three.js nodes is exactly what makes Agent Colosseum spectacular. No other project had real-time 3D viz.
