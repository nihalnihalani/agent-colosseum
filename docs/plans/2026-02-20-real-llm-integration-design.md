# Real LLM Integration Design
**Date:** 2026-02-20
**Status:** Approved
**Approach:** B — Single LLMAgent class with all three intelligence layers

---

## Context

Agent Colosseum already has a complete Bedrock integration in `backend/agent.py` behind a `MOCK_MODE` env var. This design activates it and adds two intelligence enrichment layers — Neo4j counter-strategy pattern injection and Datadog self-monitoring — into the prompt pipeline.

---

## What Already Exists (Zero Changes)

- `agent.py` — `_predict_bedrock()`, `_predict_bedrock_streaming()`, all game-type prompt builders, LLMObs spans, DogStatsD token logging, `_fallback_mock()`
- `match.py` — `asyncio.gather` for parallel Red/Blue predictions in `_run_round()`
- `datadog_metrics.py` — `ArenaMetrics` singleton with all metrics
- `main.py` — `get_neo4j_client()` lazy loader with `NoOpNeo4jClient` fallback
- Bedrock activation switch: `MOCK_MODE=true` → `MOCK_MODE=false`

---

## Architecture

`predict_opponent()` becomes a 3-step pipeline:

```
1. asyncio.gather([neo4j_patterns, datadog_accuracy])  ← parallel, 500ms timeout each
2. Build enriched prompt (inject context if available)
3. Call Bedrock (same as today)
```

---

## Files Changed

### 1. `backend/agent.py` — 3 targeted edits

**`__init__`: Accept optional clients**
```python
def __init__(self, ..., neo4j_client=None, metrics=None):
    self.neo4j_client = neo4j_client
    self.metrics = metrics
```

**New `_fetch_intelligence_context()` method**
```python
async def _fetch_intelligence_context(self, opponent_personality: str) -> dict:
    neo4j_patterns, self_accuracy = await asyncio.gather(
        self._get_neo4j_patterns(opponent_personality),
        self._get_self_accuracy(),
        return_exceptions=True,
    )
    return {
        "counter_patterns": neo4j_patterns if not isinstance(neo4j_patterns, Exception) else [],
        "recent_accuracy": self_accuracy if not isinstance(self_accuracy, Exception) else None,
    }
```

**Prompt builders: inject `[INTELLIGENCE CONTEXT]` block**

When data is available, append to the system prompt:
```
[INTELLIGENCE CONTEXT]
Counter-strategy patterns vs {opponent_personality} opponent:
  - {pattern_1}
  - {pattern_2}

Your recent prediction accuracy: {accuracy}% (last 10 rounds)
→ {calibration_advice}
```
Block is omitted entirely if both context sources are unavailable.

### 2. `backend/match.py` — pass clients into AgentPredictor constructors

`Match.__post_init__` already creates `neo4j_client` and `arena_metrics`. Thread them into each `AgentPredictor`:
```python
self.red_agent = AgentPredictor(..., neo4j_client=self._neo4j_client, metrics=self._arena_metrics)
self.blue_agent = AgentPredictor(..., neo4j_client=self._neo4j_client, metrics=self._arena_metrics)
```

### 3. `.env` — flip the switch

```
MOCK_MODE=false
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

---

## Graceful Degradation Ladder

| Failure | Behavior |
|---------|----------|
| Bedrock fails | `_fallback_mock()` (already built) |
| Neo4j offline | Empty patterns, prompt unchanged |
| Neo4j slow (>500ms) | `asyncio.wait_for` timeout, skip silently |
| Datadog offline | No accuracy context, prompt unchanged |
| Both context layers fail | Pure Bedrock reasoning |

Each layer fails independently. A match never crashes due to missing context.

---

## Verification Sequence

1. `MOCK_MODE=false`, Neo4j + Datadog offline → match runs, Bedrock responds, no crash
2. Add Neo4j → prompts show `[INTELLIGENCE CONTEXT]` counter-pattern block
3. Add Datadog → accuracy block appears after round 2
4. Kill Neo4j mid-match → next round degrades silently, match continues

---

## Success Criteria

- Matches run end-to-end with real Bedrock responses (not mock)
- Prompts include Neo4j patterns when Neo4j is connected and has data
- Prompts include accuracy self-assessment from round 2 onward
- Any single layer failing does not affect the other two layers or match completion
