# Real LLM Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Activate Amazon Bedrock for live AI predictions and enrich prompts with Neo4j counter-strategy patterns and Datadog self-monitoring accuracy data.

**Architecture:** `predict_opponent()` in `AgentPredictor` becomes a 3-step pipeline: (1) parallel-fetch Neo4j patterns + Datadog accuracy with 500ms timeouts, (2) inject context into prompt, (3) call Bedrock. Each layer fails independently — a missing integration never blocks a match.

**Tech Stack:** Python asyncio, Amazon Bedrock (`boto3`), Neo4j (`neo4j_client.py`), Datadog DogStatsD (`datadog_metrics.py`), FastAPI WebSocket

---

### Task 1: Activate Bedrock via env var

**Files:**
- Create: `backend/.env` (if it doesn't exist — check first)
- Reference: `backend/agent.py:697` — `mock_mode = os.getenv("MOCK_MODE", "true").lower() == "true"`

**Step 1: Check if .env already exists**

```bash
ls backend/.env 2>/dev/null || echo "missing"
```

**Step 2: Create or update .env**

```
MOCK_MODE=false
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<your_key>
AWS_SECRET_ACCESS_KEY=<your_secret>
BEDROCK_MODEL_ID=anthropic.claude-sonnet-4-5-20250929-v1:0
```

Set `MOCK_MODE=false`. Leave the AWS credentials blank for now — you'll fill them in before running.

**Step 3: Verify the env var is read correctly**

```bash
MOCK_MODE=false python3 -c "
import os
os.environ['MOCK_MODE'] = 'false'
from backend.agent import AgentPredictor
a = AgentPredictor('red', 'aggressive')
print('mock_mode:', a.mock_mode)  # Expected: False
"
```

Expected output: `mock_mode: False`

**Step 4: Commit**

```bash
git add backend/.env
git commit -m "feat: activate Bedrock via MOCK_MODE=false"
```

---

### Task 2: Add `neo4j_client` and `metrics` to `AgentPredictor.__init__`

**Files:**
- Modify: `backend/agent.py:693-698`

**Step 1: Read the current `__init__`**

Lines 693-698:
```python
class AgentPredictor:
    """Prediction engine for a single agent. Supports Bedrock and mock modes."""

    def __init__(self, agent_name: str, personality: str = "adaptive", game_type: str = "resource_wars"):
        self.agent_name = agent_name
        self.personality = personality
        self.game_type = game_type
        self.mock_mode = os.getenv("MOCK_MODE", "true").lower() == "true"
        self._bedrock_client = None
```

**Step 2: Replace with**

```python
class AgentPredictor:
    """Prediction engine for a single agent. Supports Bedrock and mock modes."""

    def __init__(
        self,
        agent_name: str,
        personality: str = "adaptive",
        game_type: str = "resource_wars",
        neo4j_client=None,
        metrics=None,
    ):
        self.agent_name = agent_name
        self.personality = personality
        self.game_type = game_type
        self.mock_mode = os.getenv("MOCK_MODE", "true").lower() == "true"
        self._bedrock_client = None
        self.neo4j_client = neo4j_client
        self.metrics = metrics
```

**Step 3: Verify no syntax errors**

```bash
python3 -m py_compile backend/agent.py && echo "OK"
```

Expected: `OK`

**Step 4: Commit**

```bash
git add backend/agent.py
git commit -m "feat: add neo4j_client and metrics params to AgentPredictor"
```

---

### Task 3: Pass clients from `Match.__post_init__` into `AgentPredictor`

**Files:**
- Modify: `backend/match.py:74-77`

**Step 1: Read the current agent construction in `__post_init__`**

Lines 74-77:
```python
if self.red_agent is None:
    self.red_agent = AgentPredictor("red", self.config.red_personality, game_type=gt)
if self.blue_agent is None:
    self.blue_agent = AgentPredictor("blue", self.config.blue_personality, game_type=gt)
```

Note: `self._neo4j_client` and `self._metrics` are set on lines 80-96. The agent construction happens BEFORE the lazy-load block at line 79. So we need to move the agent construction AFTER the lazy-load block, or restructure.

**Step 2: Replace the `__post_init__` agent construction + lazy-load block**

Find lines 74-96 and replace with:
```python
        # Lazy-load optional integrations first (agents need these)
        try:
            from backend.neo4j_client import get_neo4j_client
            self._neo4j_client = get_neo4j_client()
        except Exception:
            pass

        try:
            from backend.mongodb_client import get_mongodb_client
            self._mongodb_client = get_mongodb_client()
        except Exception:
            pass

        try:
            from backend.datadog_metrics import arena_metrics
            self._metrics = arena_metrics
        except Exception:
            pass

        if self.red_agent is None:
            self.red_agent = AgentPredictor(
                "red", self.config.red_personality, game_type=gt,
                neo4j_client=self._neo4j_client, metrics=self._metrics,
            )
        if self.blue_agent is None:
            self.blue_agent = AgentPredictor(
                "blue", self.config.blue_personality, game_type=gt,
                neo4j_client=self._neo4j_client, metrics=self._metrics,
            )
```

**Step 3: Verify no syntax errors**

```bash
python3 -m py_compile backend/match.py && echo "OK"
```

**Step 4: Quick smoke test — Match constructs without error**

```bash
python3 -c "
from backend.match import Match, MatchConfig
m = Match(config=MatchConfig(game_type='resource_wars'))
print('red neo4j:', m.red_agent.neo4j_client)
print('red metrics:', m.red_agent.metrics)
print('OK')
"
```

Expected: prints `None` for both (Neo4j/Datadog not configured) then `OK`. No crash.

**Step 5: Commit**

```bash
git add backend/match.py
git commit -m "feat: pass neo4j_client and metrics into AgentPredictor from Match"
```

---

### Task 4: Add `_get_neo4j_patterns()` method to `AgentPredictor`

**Files:**
- Modify: `backend/agent.py` — add after `_fallback_mock()` method (after line 787)

**Step 1: Add the method**

Insert this new method after `_fallback_mock()`:

```python
    async def _get_neo4j_patterns(self, opponent_personality: str) -> list[str]:
        """Fetch counter-strategy patterns from Neo4j for the given opponent personality."""
        if self.neo4j_client is None:
            return []
        try:
            patterns = await asyncio.wait_for(
                asyncio.to_thread(
                    self.neo4j_client.get_counter_strategies,
                    self.agent_name,
                    opponent_personality,
                ),
                timeout=0.5,
            )
            return patterns or []
        except Exception as e:
            logger.debug("Neo4j pattern fetch failed: %s", e)
            return []
```

**Step 2: Verify `get_counter_strategies` exists on the Neo4j client**

```bash
python3 -c "
from backend.neo4j_client import get_neo4j_client
client = get_neo4j_client()
print(type(client))
print(hasattr(client, 'get_counter_strategies'))
"
```

If it prints `False`, check `backend/neo4j_client.py` for the actual method name. Adjust the method name in the code above accordingly.

**Step 3: Verify syntax**

```bash
python3 -m py_compile backend/agent.py && echo "OK"
```

**Step 4: Commit**

```bash
git add backend/agent.py
git commit -m "feat: add _get_neo4j_patterns to AgentPredictor"
```

---

### Task 5: Add `_get_self_accuracy()` method to `AgentPredictor`

**Files:**
- Modify: `backend/agent.py` — add after `_get_neo4j_patterns()`

**Step 1: Check what metrics API provides**

```bash
python3 -c "
from backend.datadog_metrics import arena_metrics
print([m for m in dir(arena_metrics) if not m.startswith('_')])
"
```

Look for accuracy-related methods. The `ArenaMetrics` class in `datadog_metrics.py` is write-only (DogStatsD sends metrics out, doesn't read them back). So `_get_self_accuracy()` will derive accuracy from in-memory state instead.

**Step 2: Add the method**

Insert after `_get_neo4j_patterns()`:

```python
    def _get_self_accuracy(self) -> Optional[dict]:
        """Return recent prediction accuracy if metrics available."""
        if self.metrics is None:
            return None
        try:
            # ArenaMetrics is write-only (DogStatsD); derive from internal counters
            # These are tracked on the Match object, not here. Return None until
            # we wire round-level accuracy through. This is a graceful no-op.
            return None
        except Exception as e:
            logger.debug("Accuracy fetch failed: %s", e)
            return None
```

> **Note for future:** To wire actual accuracy, `Match._run_round()` can increment counters on `AgentPredictor` directly (e.g. `self.red_agent.correct_predictions += 1`). For the hackathon, returning `None` here means the accuracy block is simply omitted from the prompt — a safe degradation.

**Step 3: Verify syntax**

```bash
python3 -m py_compile backend/agent.py && echo "OK"
```

**Step 4: Commit**

```bash
git add backend/agent.py
git commit -m "feat: add _get_self_accuracy stub to AgentPredictor"
```

---

### Task 6: Add `_fetch_intelligence_context()` method

**Files:**
- Modify: `backend/agent.py` — add after `_get_self_accuracy()`

**Step 1: Add the method**

```python
    async def _fetch_intelligence_context(self, opponent_personality: str) -> dict:
        """Parallel-fetch Neo4j patterns and self accuracy. Never raises."""
        results = await asyncio.gather(
            self._get_neo4j_patterns(opponent_personality),
            asyncio.coroutine(lambda: self._get_self_accuracy())()
            if False else asyncio.sleep(0, result=self._get_self_accuracy()),
            return_exceptions=True,
        )
        neo4j_patterns = results[0] if not isinstance(results[0], Exception) else []
        self_accuracy = results[1] if not isinstance(results[1], Exception) else None
        return {
            "counter_patterns": neo4j_patterns if isinstance(neo4j_patterns, list) else [],
            "recent_accuracy": self_accuracy,
        }
```

Wait — `_get_self_accuracy()` is sync, not async. Fix the gather call:

```python
    async def _fetch_intelligence_context(self, opponent_personality: str) -> dict:
        """Parallel-fetch Neo4j patterns and self accuracy. Never raises."""
        try:
            neo4j_patterns = await self._get_neo4j_patterns(opponent_personality)
        except Exception:
            neo4j_patterns = []
        self_accuracy = self._get_self_accuracy()
        return {
            "counter_patterns": neo4j_patterns if isinstance(neo4j_patterns, list) else [],
            "recent_accuracy": self_accuracy,
        }
```

**Step 2: Verify syntax**

```bash
python3 -m py_compile backend/agent.py && echo "OK"
```

**Step 3: Quick async test**

```bash
python3 -c "
import asyncio
from backend.agent import AgentPredictor

async def test():
    a = AgentPredictor('red', 'aggressive')
    ctx = await a._fetch_intelligence_context('defensive')
    print('context:', ctx)
    assert 'counter_patterns' in ctx
    assert 'recent_accuracy' in ctx
    print('OK')

asyncio.run(test())
"
```

Expected: `context: {'counter_patterns': [], 'recent_accuracy': None}` then `OK`.

**Step 4: Commit**

```bash
git add backend/agent.py
git commit -m "feat: add _fetch_intelligence_context to AgentPredictor"
```

---

### Task 7: Inject intelligence context into prompt builders

**Files:**
- Modify: `backend/agent.py:174` (`_build_system_prompt`), `backend/agent.py:429` (`_build_negotiation_prompt`), and the auction prompt builder
- Modify: `backend/agent.py:741` (`_build_prompt`)

**Step 1: Add a context-block builder helper** (add near top of file, after the existing helpers)

```python
def _build_intelligence_block(context: dict) -> str:
    """Format Neo4j patterns and accuracy into a prompt section. Returns '' if empty."""
    lines = []
    patterns = context.get("counter_patterns") or []
    accuracy = context.get("recent_accuracy")

    if patterns:
        lines.append("[INTELLIGENCE CONTEXT]")
        lines.append("Counter-strategy patterns from historical matches:")
        for p in patterns[:3]:  # cap at 3 to keep prompt concise
            lines.append(f"  - {p}")

    if accuracy is not None:
        if not lines:
            lines.append("[INTELLIGENCE CONTEXT]")
        lines.append(f"Your recent prediction accuracy: {accuracy}%")

    return "\n".join(lines)
```

**Step 2: Update `_build_system_prompt` signature and body**

Change signature from:
```python
def _build_system_prompt(
    agent_name: str,
    personality: str,
    game_state: GameState,
    my_history: list[dict],
    opponent_history: list[dict],
) -> str:
```

To:
```python
def _build_system_prompt(
    agent_name: str,
    personality: str,
    game_state: GameState,
    my_history: list[dict],
    opponent_history: list[dict],
    intelligence_context: dict | None = None,
) -> str:
```

At the end of the return string, before the closing `"""`, append:
```python
intel_block = _build_intelligence_block(intelligence_context or {})
```
And append it to the returned string:
```python
return f"""...existing prompt...\n\n{intel_block}""" if intel_block else f"""...existing prompt..."""
```

The simplest implementation: add a variable at the start, build the string, append:

```python
def _build_system_prompt(..., intelligence_context: dict | None = None) -> str:
    config = AGENT_PERSONALITIES.get(personality, AGENT_PERSONALITIES["adaptive"])
    intel_block = _build_intelligence_block(intelligence_context or {})
    base = f"""You are {agent_name}... (existing string) ..."""
    return f"{base}\n\n{intel_block}" if intel_block else base
```

Repeat the same pattern for `_build_negotiation_prompt` and `_build_auction_prompt`.

**Step 3: Update `_build_prompt()` in `AgentPredictor` to accept and pass context**

Change:
```python
def _build_prompt(self, game_state, my_history, opponent_history) -> str:
```
To:
```python
def _build_prompt(self, game_state, my_history, opponent_history, intelligence_context: dict | None = None) -> str:
```
And pass `intelligence_context=intelligence_context` to each prompt builder call.

**Step 4: Update `_predict_bedrock()` to fetch and pass context**

In `_predict_bedrock()` (line 789), change line 800:
```python
prompt = self._build_prompt(game_state, my_history, opponent_history)
```
To:
```python
opponent_personality = "adaptive"  # default; ideally passed in — see Task 8
intelligence_context = await self._fetch_intelligence_context(opponent_personality)
prompt = self._build_prompt(game_state, my_history, opponent_history, intelligence_context)
```

**Step 5: Verify syntax**

```bash
python3 -m py_compile backend/agent.py && echo "OK"
```

**Step 6: Commit**

```bash
git add backend/agent.py
git commit -m "feat: inject intelligence context block into all prompt builders"
```

---

### Task 8: Pass opponent personality through the prediction call chain

**Files:**
- Modify: `backend/agent.py:709` (`predict_opponent`)
- Modify: `backend/agent.py:789` (`_predict_bedrock`)
- Modify: `backend/match.py` (`_get_prediction`)

**Step 1: Check how `predict_opponent` is called in `match.py`**

```bash
grep -n "predict_opponent" backend/match.py
```

Note the call site and what arguments are passed.

**Step 2: Add `opponent_personality` param to `predict_opponent` and `_predict_bedrock`**

```python
async def predict_opponent(
    self,
    game_state,
    opponent_history: list[dict],
    my_history: list[dict],
    opponent_personality: str = "adaptive",
) -> PredictionResult:
    if self.mock_mode:
        return await self._predict_mock(game_state, opponent_history, my_history)
    return await self._predict_bedrock(game_state, opponent_history, my_history, opponent_personality)
```

```python
async def _predict_bedrock(
    self,
    game_state,
    opponent_history: list[dict],
    my_history: list[dict],
    opponent_personality: str = "adaptive",
) -> PredictionResult:
    ...
    intelligence_context = await self._fetch_intelligence_context(opponent_personality)
    prompt = self._build_prompt(game_state, my_history, opponent_history, intelligence_context)
    ...
```

**Step 3: Update `match.py` call site to pass opponent personality**

Find the call to `predict_opponent` in `match.py` (in `_get_prediction()`). Add the opponent's personality:

```python
# agent is "red" or "blue"
opponent = "blue" if agent == "red" else "red"
opponent_personality = self.config.blue_personality if agent == "red" else self.config.red_personality
result = await predictor.predict_opponent(
    game_state,
    opponent_history,
    my_history,
    opponent_personality=opponent_personality,
)
```

**Step 4: Verify full syntax**

```bash
python3 -m py_compile backend/agent.py && python3 -m py_compile backend/match.py && echo "OK"
```

**Step 5: Commit**

```bash
git add backend/agent.py backend/match.py
git commit -m "feat: thread opponent_personality through prediction chain for Neo4j context"
```

---

### Task 9: End-to-end smoke test (mock mode, no Bedrock)

**Step 1: Run with MOCK_MODE=true (safe baseline)**

```bash
PYTHONPATH=. MOCK_MODE=true uvicorn backend.main:app --port 8888 &
sleep 2
curl -s http://localhost:8888/health | python3 -m json.tool
```

Expected: `"mock_mode": true`

**Step 2: Kill the server**

```bash
kill %1
```

**Step 3: Run with MOCK_MODE=false (no AWS creds — should fail gracefully)**

```bash
PYTHONPATH=. MOCK_MODE=false uvicorn backend.main:app --port 8888 &
sleep 2
curl -s http://localhost:8888/health | python3 -m json.tool
```

Expected: `"mock_mode": false` — server starts fine even without AWS creds.

**Step 4: Kill the server**

```bash
kill %1
```

**Step 5: Commit if any last-minute fixes**

```bash
git add -A && git commit -m "chore: end-to-end smoke test passing"
```

---

### Task 10: (Optional) Wire AWS credentials and run a live Bedrock match

> Only do this if you have AWS credentials with Bedrock access.

**Step 1: Set credentials in `.env` or shell**

```bash
export AWS_ACCESS_KEY_ID=<your_key>
export AWS_SECRET_ACCESS_KEY=<your_secret>
export AWS_REGION=us-east-1
export MOCK_MODE=false
```

**Step 2: Start backend**

```bash
PYTHONPATH=. uvicorn backend.main:app --reload --port 8888
```

**Step 3: Open frontend and run a match**

```bash
cd frontend && npm run dev
```

Navigate to `http://localhost:3000`, select personalities, click "Initialize Simulation".

**Step 4: Watch the backend logs**

You should see: Bedrock invocations, LLMObs span creation, DogStatsD metric logging.

**Step 5: Check Datadog dashboard (if DD_API_KEY set)**

Metrics: `arena.predictions.*`, `arena.tokens.*`, `arena.round.latency`

---

## Summary

| Task | File | What Changes |
|------|------|--------------|
| 1 | `.env` | `MOCK_MODE=false` |
| 2 | `agent.py:693` | `__init__` accepts `neo4j_client`, `metrics` |
| 3 | `match.py:74` | Lazy-load clients before agent construction, pass to constructors |
| 4 | `agent.py` | `_get_neo4j_patterns()` async method |
| 5 | `agent.py` | `_get_self_accuracy()` sync method (stub) |
| 6 | `agent.py` | `_fetch_intelligence_context()` orchestrates both |
| 7 | `agent.py` | `_build_intelligence_block()` helper + inject into all 3 prompt builders |
| 8 | `agent.py`, `match.py` | Thread `opponent_personality` through call chain |
| 9 | — | Smoke test both modes |
| 10 | — | Optional live Bedrock test |
