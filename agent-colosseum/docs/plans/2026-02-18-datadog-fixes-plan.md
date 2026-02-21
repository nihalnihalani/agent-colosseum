# Datadog Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Fix four Datadog integration bugs so that LLM Observability traces are correctly linked, Bedrock calls are fully instrumented, streaming predictions are traced, and token usage metrics are actually emitted.

**Architecture:** All changes are confined to two Python files: `backend/datadog_metrics.py` (setup) and `backend/agent.py` (instrumentation). No new files are created. All fixes guard behind `_llmobs_enabled` so mock mode and missing-credentials environments are unaffected.

**Tech Stack:** Python 3.12, `ddtrace` (`LLMObs`), `datadog` (DogStatsD), Amazon Bedrock, FastAPI async.

---

## Background (read before implementing)

### File map
- `backend/datadog_metrics.py` — DogStatsD singleton (`ArenaMetrics`) + `setup_llmobs()`. **Task 1 is here.**
- `backend/agent.py` — `_llmobs_prediction_span`, `_llmobs_submit_evaluation`, `AgentPredictor._predict_bedrock`, `AgentPredictor.predict_opponent_streaming`. **Tasks 2–4 are here.**

### Key Datadog LLM Obs API (ddtrace)
```python
from ddtrace.llmobs import LLMObs

# Enable (called once at startup)
LLMObs.enable(ml_app="name", api_key="...", site="datadoghq.com", agentless_enabled=True, integrations_enabled=True)

# Span types
with LLMObs.workflow("name") as span: ...   # orchestration
with LLMObs.llm(model_name="...", model_provider="bedrock", name="...") as span: ...  # LLM call

# Annotate active span
LLMObs.annotate(
    input_data=[{"role": "user", "content": "..."}],
    output_data=[{"role": "assistant", "content": "..."}],
    metrics={"input_tokens": N, "output_tokens": N},
    tags={"key": "value"},
)

# Export active span for deferred evaluation submission
exported = LLMObs.export_span()  # exports currently active span

# Submit evaluation
LLMObs.submit_evaluation(
    span_context=exported,       # NOT None
    label="my_metric",
    metric_type="score",         # or "categorical"
    value=1.0,
    tags={"key": "value"},
)
```

### Guard pattern in agent.py
```python
_llmobs_enabled = False
_LLMObs: Any = None

try:
    if os.getenv("DD_API_KEY"):
        from ddtrace.llmobs import LLMObs as _LLMObsImport
        _LLMObs = _LLMObsImport
        _llmobs_enabled = True
except Exception:
    pass
```
All fixes must check `_llmobs_enabled` before calling `_LLMObs.*`.

### Bedrock response shape
```python
# Non-streaming (invoke_model)
body = json.loads(response["body"].read())
content = body["content"][0]["text"]
usage = body.get("usage", {})
input_tokens = usage.get("input_tokens", 0)
output_tokens = usage.get("output_tokens", 0)

# Streaming (invoke_model_with_response_stream)
# Token counts appear in the final chunk with type="message_delta"
# chunk["usage"]["input_tokens"] and chunk["usage"]["output_tokens"]
```

---

## Task 1: Fix `setup_llmobs()` — pass `api_key` and `site`

**File:** `backend/datadog_metrics.py:168-185`

**Bug:** `LLMObs.enable()` is called without `api_key` or `site`. While ddtrace reads `DD_API_KEY` from env automatically, the `site` parameter defaults to `datadoghq.com` (US1) — users on EU/US3/US5/AP1 Datadog sites silently send data to the wrong endpoint.

### Step 1: Edit `setup_llmobs()` in `backend/datadog_metrics.py`

Find lines 168–185 (the entire `setup_llmobs` function). Replace the body with:

```python
def setup_llmobs() -> None:
    """Initialize Datadog LLM Observability if configured."""
    api_key = os.getenv("DD_API_KEY", "")
    if not api_key:
        logger.warning("DD_API_KEY not set — LLM Observability disabled")
        return

    site = os.getenv("DD_SITE", "datadoghq.com")

    try:
        from ddtrace.llmobs import LLMObs

        LLMObs.enable(
            ml_app="agent-colosseum",
            api_key=api_key,
            site=site,
            integrations_enabled=True,
            agentless_enabled=True,
        )
        logger.info("Datadog LLM Observability enabled (site=%s)", site)
    except Exception as e:
        logger.warning("Failed to enable LLM Observability: %s", e)
```

### Step 2: Verify Python syntax

```bash
cd /Users/nihalnihalani/Desktop/Github/dtadog/agent-colosseum/backend
python3 -c "import ast; ast.parse(open('datadog_metrics.py').read()); print('OK')"
```
Expected: `OK`

### Step 3: Commit

```bash
cd /Users/nihalnihalani/Desktop/Github/dtadog/agent-colosseum
git add backend/datadog_metrics.py
git commit -m "fix: pass api_key and site to LLMObs.enable for correct endpoint routing"
```

---

## Task 2: Fix `span_context=None` — link evaluations to active span

**File:** `backend/agent.py:71-97`

**Bug:** `_llmobs_submit_evaluation` calls `_LLMObs.submit_evaluation(span_context=None, ...)`. This submits evaluations with no span/trace linkage — they appear in Datadog but cannot be correlated to any prediction call.

**Fix:** Replace `span_context=None` with `span_context=_LLMObs.export_span()`. The function is always called while the `_llmobs_prediction_span` workflow span is still active (it's called inside the `with` block at lines 824-826 and 893), so `export_span()` with no argument correctly exports the currently active span.

### Step 1: Edit `_llmobs_submit_evaluation` in `backend/agent.py`

Find lines 80-96 (the `try` block inside `_llmobs_submit_evaluation`). Replace:

```python
    try:
        for i, pred in enumerate(predictions):
            predicted = pred.get("opponentMove", "")
            was_correct = predicted == actual_move
            _LLMObs.submit_evaluation(
                span_context=None,
                label=f"prediction_{i}_accuracy",
                metric_type="score",
                value=1.0 if was_correct else 0.0,
                tags={
                    "agent": agent_name,
                    "predicted_move": predicted,
                    "actual_move": actual_move,
                    "confidence": str(pred.get("confidence", 0)),
                },
            )
    except Exception as e:
        logger.debug("LLMObs evaluation submit failed: %s", e)
```

With:

```python
    try:
        exported_span = _LLMObs.export_span()
        for i, pred in enumerate(predictions):
            predicted = pred.get("opponentMove", "")
            was_correct = predicted == actual_move
            _LLMObs.submit_evaluation(
                span_context=exported_span,
                label=f"prediction_{i}_accuracy",
                metric_type="score",
                value=1.0 if was_correct else 0.0,
                tags={
                    "agent": agent_name,
                    "predicted_move": predicted,
                    "actual_move": actual_move,
                    "confidence": str(pred.get("confidence", 0)),
                },
            )
    except Exception as e:
        logger.debug("LLMObs evaluation submit failed: %s", e)
```

### Step 2: Verify Python syntax

```bash
cd /Users/nihalnihalani/Desktop/Github/dtadog/agent-colosseum/backend
python3 -c "import ast; ast.parse(open('agent.py').read()); print('OK')"
```
Expected: `OK`

### Step 3: Commit

```bash
cd /Users/nihalnihalani/Desktop/Github/dtadog/agent-colosseum
git add backend/agent.py
git commit -m "fix: link LLMObs evaluations to active span via export_span() instead of None"
```

---

## Task 3: Add `LLMObs.llm()` span to `_predict_bedrock` + log token usage

**File:** `backend/agent.py:778-832`

**Bug A:** The Bedrock `invoke_model` call is wrapped in a `workflow` span but not an `llm` span. Datadog LLM Obs needs `LLMObs.llm()` to capture the prompt (input), response (output), token counts, and model name in the trace UI.

**Bug B:** Bedrock responses contain `body["usage"]["input_tokens"]` and `body["usage"]["output_tokens"]`, but `arena_metrics.log_token_usage()` is never called.

### Step 1: Import `arena_metrics` at the top of `_predict_bedrock`'s scope

Check if `arena_metrics` is already imported in `agent.py`. Look at the top-level imports (lines 1-30). If it's not imported, it's available via `from backend.datadog_metrics import arena_metrics` inside the method (lazy import pattern already used for `neo4j_client`).

### Step 2: Rewrite `_predict_bedrock` — wrap Bedrock call in `LLMObs.llm()` + extract tokens

Find the method `_predict_bedrock` (lines 778-832). The inner `try` block starting at line 792 needs to be restructured. Replace the entire method body with:

```python
    async def _predict_bedrock(
        self,
        game_state,
        opponent_history: list[dict],
        my_history: list[dict],
    ) -> PredictionResult:
        """Call Amazon Bedrock Claude for opponent prediction, wrapped with LLM Obs."""
        client = self._get_bedrock_client()
        model_id = os.getenv("BEDROCK_MODEL_ID", "anthropic.claude-sonnet-4-5-20250929-v1:0")
        config = AGENT_PERSONALITIES.get(self.personality, AGENT_PERSONALITIES["adaptive"])

        prompt = self._build_prompt(game_state, my_history, opponent_history)

        with _llmobs_prediction_span(self.agent_name, self.personality, game_state.to_dict()):
            try:
                # --- LLM span: wraps the actual Bedrock invocation ---
                if _llmobs_enabled:
                    llm_ctx = _LLMObs.llm(
                        model_name=model_id,
                        model_provider="bedrock",
                        name="bedrock_prediction",
                    )
                else:
                    from contextlib import nullcontext
                    llm_ctx = nullcontext()

                with llm_ctx:
                    if _llmobs_enabled:
                        _LLMObs.annotate(
                            input_data=[{"role": "user", "content": prompt}],
                        )

                    response = await asyncio.to_thread(
                        client.invoke_model,
                        modelId=model_id,
                        contentType="application/json",
                        body=json.dumps({
                            "anthropic_version": "bedrock-2023-05-31",
                            "max_tokens": 1024,
                            "temperature": config["temperature"],
                            "messages": [{"role": "user", "content": prompt}],
                        }),
                    )

                    body = json.loads(response["body"].read())
                    content = body.get("content", [{}])[0].get("text", "{}")

                    # Extract token usage
                    usage = body.get("usage", {})
                    input_tokens = usage.get("input_tokens", 0)
                    output_tokens = usage.get("output_tokens", 0)

                    if _llmobs_enabled:
                        _LLMObs.annotate(
                            output_data=[{"role": "assistant", "content": content}],
                            metrics={"input_tokens": input_tokens, "output_tokens": output_tokens},
                        )

                # Log token usage to DogStatsD
                try:
                    from backend.datadog_metrics import arena_metrics
                    arena_metrics.log_token_usage(
                        self.agent_name, input_tokens, output_tokens
                    )
                except Exception:
                    pass

                # Parse JSON from response (handle markdown code blocks)
                if "```json" in content:
                    content = content.split("```json")[1].split("```")[0]
                elif "```" in content:
                    content = content.split("```")[1].split("```")[0]

                parsed = json.loads(content.strip())
                chosen_move = self._parse_chosen_move(parsed)

                result = PredictionResult(
                    predictions=parsed.get("predictions", []),
                    chosen_move=chosen_move,
                    reasoning=parsed.get("reasoning", ""),
                )

                # Submit evaluation for each prediction branch
                _llmobs_submit_evaluation(
                    self.agent_name, result.predictions
                )

                return result

            except Exception as e:
                logger.error("Bedrock prediction failed for %s: %s", self.agent_name, e)
                return self._fallback_mock(game_state, opponent_history, my_history)
```

### Step 3: Verify Python syntax

```bash
cd /Users/nihalnihalani/Desktop/Github/dtadog/agent-colosseum/backend
python3 -c "import ast; ast.parse(open('agent.py').read()); print('OK')"
```
Expected: `OK`

### Step 4: Commit

```bash
cd /Users/nihalnihalani/Desktop/Github/dtadog/agent-colosseum
git add backend/agent.py
git commit -m "fix: add LLMObs.llm() span to Bedrock call and wire log_token_usage in _predict_bedrock"
```

---

## Task 4: Add LLM Obs workflow span + token logging to `predict_opponent_streaming`

**File:** `backend/agent.py:834-904`

**Bug:** The streaming Bedrock path (`predict_opponent_streaming`) has no LLM Obs tracing at all — it calls Bedrock and submits evaluations but the entire operation is invisible to Datadog.

**Fix:** Wrap the Bedrock streaming path in a `_llmobs_prediction_span` workflow span (same as `_predict_bedrock`). Inside, add `LLMObs.annotate()` for the input prompt. Extract token counts from the final streaming chunk (`message_delta` with `usage` field) and log them.

Note: `predict_opponent_streaming` is an `async def` that uses `yield` (async generator), so it cannot use `with` + `return` in the same way. The `_llmobs_prediction_span` context manager must be entered before the Bedrock call and exited cleanly. The span must be exited before the method returns. Since `yield` is used inside the `try` block, the context manager will stay open across yields — this is acceptable for streaming scenarios.

### Step 1: Rewrite the Bedrock branch of `predict_opponent_streaming` (lines 850-904)

Find the section starting at line 850 (`client = self._get_bedrock_client()`). Replace lines 850-904 with:

```python
        client = self._get_bedrock_client()
        model_id = os.getenv("BEDROCK_MODEL_ID", "anthropic.claude-sonnet-4-5-20250929-v1:0")
        config = AGENT_PERSONALITIES.get(self.personality, AGENT_PERSONALITIES["adaptive"])

        prompt = self._build_prompt(game_state, my_history, opponent_history)

        # Open LLMObs workflow span for the streaming prediction
        with _llmobs_prediction_span(self.agent_name, self.personality, game_state.to_dict()):
            if _llmobs_enabled:
                try:
                    _LLMObs.annotate(
                        input_data=[{"role": "user", "content": prompt}],
                    )
                except Exception:
                    pass

            try:
                response = await asyncio.to_thread(
                    client.invoke_model_with_response_stream,
                    modelId=model_id,
                    contentType="application/json",
                    body=json.dumps({
                        "anthropic_version": "bedrock-2023-05-31",
                        "max_tokens": 1024,
                        "temperature": config["temperature"],
                        "messages": [{"role": "user", "content": prompt}],
                    }),
                )

                full_text = ""
                input_tokens = 0
                output_tokens = 0
                for event in response["body"]:
                    chunk = json.loads(event["chunk"]["bytes"])
                    if chunk.get("type") == "content_block_delta":
                        delta = chunk.get("delta", {}).get("text", "")
                        full_text += delta
                        yield {"type": "stream_chunk", "text": delta}
                    # Final chunk contains token usage
                    if chunk.get("type") == "message_delta":
                        usage = chunk.get("usage", {})
                        input_tokens = usage.get("input_tokens", 0)
                        output_tokens = usage.get("output_tokens", 0)

                # Parse final result
                if "```json" in full_text:
                    full_text = full_text.split("```json")[1].split("```")[0]
                elif "```" in full_text:
                    full_text = full_text.split("```")[1].split("```")[0]

                parsed = json.loads(full_text.strip())
                chosen_move = self._parse_chosen_move(parsed)

                result = PredictionResult(
                    predictions=parsed.get("predictions", []),
                    chosen_move=chosen_move,
                    reasoning=parsed.get("reasoning", ""),
                )

                # Annotate output + token counts
                if _llmobs_enabled:
                    try:
                        _LLMObs.annotate(
                            output_data=[{"role": "assistant", "content": full_text}],
                            metrics={"input_tokens": input_tokens, "output_tokens": output_tokens},
                        )
                    except Exception:
                        pass

                # Log token usage to DogStatsD
                try:
                    from backend.datadog_metrics import arena_metrics
                    arena_metrics.log_token_usage(
                        self.agent_name, input_tokens, output_tokens
                    )
                except Exception:
                    pass

                # Submit LLM Obs evaluations for streamed predictions
                _llmobs_submit_evaluation(self.agent_name, result.predictions)

                for i, pred in enumerate(result.predictions):
                    yield {"type": "prediction_branch", "index": i, "prediction": pred}
                yield {"type": "prediction_complete", "result": result}

            except Exception as e:
                logger.error("Bedrock streaming failed for %s: %s", self.agent_name, e)
                result = self._fallback_mock(game_state, opponent_history, my_history)
                for i, pred in enumerate(result.predictions):
                    yield {"type": "prediction_branch", "index": i, "prediction": pred}
                yield {"type": "prediction_complete", "result": result}
```

### Step 2: Verify Python syntax

```bash
cd /Users/nihalnihalani/Desktop/Github/dtadog/agent-colosseum/backend
python3 -c "import ast; ast.parse(open('agent.py').read()); print('OK')"
```
Expected: `OK`

### Step 3: Smoke-test imports in mock mode (no Datadog credentials needed)

```bash
cd /Users/nihalnihalani/Desktop/Github/dtadog/agent-colosseum
MOCK_MODE=true python3 -c "
from backend.agent import AgentPredictor
p = AgentPredictor('red', 'aggressive', 'resource_wars')
print('AgentPredictor import OK, mock_mode =', p.mock_mode)
"
```
Expected: `AgentPredictor import OK, mock_mode = True`

### Step 4: Commit

```bash
cd /Users/nihalnihalani/Desktop/Github/dtadog/agent-colosseum
git add backend/agent.py
git commit -m "fix: add LLMObs workflow span and token logging to streaming Bedrock prediction path"
```

---

## Files Changed

| File | Tasks |
|------|-------|
| `backend/datadog_metrics.py` | Task 1 — `setup_llmobs()` api_key + site |
| `backend/agent.py` | Task 2 — `span_context=export_span()` |
| `backend/agent.py` | Task 3 — `LLMObs.llm()` span + token logging in `_predict_bedrock` |
| `backend/agent.py` | Task 4 — LLMObs workflow + token logging in `predict_opponent_streaming` |

**Total: 2 files, ~80 lines changed, 0 new files.**
