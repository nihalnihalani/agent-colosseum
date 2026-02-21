# LLMObs Deferred Evaluation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Wire `_llmobs_submit_evaluation` so prediction accuracy evaluations are actually submitted to Datadog LLM Observability after round resolution, when the actual opponent move is known.

**Architecture:** `PredictionResult` carries the exported LLMObs span context captured at prediction time. After each round resolves in `match.py:_run_round()`, the actual opponent move string is built (same logic already used by `_annotate_predictions`) and `_llmobs_submit_evaluation` is called with the stored span + actual move. This is a deferred evaluation pattern — predict → store span → resolve → submit evaluation.

**Tech Stack:** Python 3.12, `ddtrace.llmobs.LLMObs`, FastAPI async, dataclasses.

---

## Background (read before implementing)

### Round flow in `match.py:_run_round()` (lines 213–397)

```
1. yield round_start
2. asyncio.gather → red_result, blue_result  ← PredictionResult objects, span closes here
3. yield thinking_end events
4. red_move, blue_move = chosen_moves
5. resolution = self._resolve_round(red_move, blue_move)  ← actual moves known NOW
6. red_preds_annotated = _annotate_predictions(red_result.predictions, blue_move, "red")
7. blue_preds_annotated = _annotate_predictions(blue_result.predictions, red_move, "blue")
8. yield collapse, round_end
9. Neo4j + MongoDB storage
```

After step 5, both `red_move` and `blue_move` are known. Red was predicting blue's move, and vice versa.

### `_annotate_predictions` already builds actual_str (match.py lines 427-432)

```python
if gt == "negotiation":
    actual_str = f"{actual_opponent_move.type.value}_{actual_opponent_move.price}"
elif gt == "auction":
    actual_str = f"{actual_opponent_move.type.value}_{actual_opponent_move.amount}"
else:
    actual_str = f"{actual_opponent_move.type.value}_{actual_opponent_move.target.value}"
```

We replicate this logic inline in `_run_round()` to get `blue_actual_str` and `red_actual_str`.

### Why `_LLMObs.export_span()` fails after the span closes

`_predict_bedrock` wraps the Bedrock call in `with _llmobs_prediction_span(...)`. When the function **returns**, the `with` block exits and the span closes. By the time `match.py` has the actual move (after round resolution), the span is gone. We must export the span **inside** the `with` block before returning, store it on `PredictionResult`, then use it later.

### `predict_opponent_streaming` is NOT used in `_run_round`

`match.py` calls `_get_prediction` → `predict_opponent` (non-streaming). The streaming path is separate (imagination tree UI). We clean up its dead `_llmobs_submit_evaluation` call too, but wiring is only needed for `_predict_bedrock`.

### Module-level guards in `agent.py`

```python
_llmobs_enabled = False   # True only when DD_API_KEY is set
_LLMObs: Any = None       # The LLMObs class, or None
```

All LLMObs operations must check `_llmobs_enabled` first.

---

## Task 1: Add `llmobs_span` field to `PredictionResult` and export span in `_predict_bedrock`

**Files:**
- Modify: `backend/agent.py` — `PredictionResult` dataclass (lines 232-243) and `_predict_bedrock` method (lines ~791-876)

### Step 1: Add `llmobs_span: Any = None` to `PredictionResult`

Find the `PredictionResult` dataclass (around line 232):

```python
@dataclass
class PredictionResult:
    predictions: list[dict] = field(default_factory=list)
    chosen_move: Optional[Move] = None
    reasoning: str = ""
```

Add the new field:

```python
@dataclass
class PredictionResult:
    predictions: list[dict] = field(default_factory=list)
    chosen_move: Optional[Move] = None
    reasoning: str = ""
    llmobs_span: Any = None  # exported span context for deferred evaluation submission
```

### Step 2: In `_predict_bedrock`, export the span before returning and remove the dead `_llmobs_submit_evaluation` call

Find the end of the `try` block inside `with _llmobs_prediction_span(...)` in `_predict_bedrock`. It currently looks like:

```python
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
```

Replace with:

```python
                result = PredictionResult(
                    predictions=parsed.get("predictions", []),
                    chosen_move=chosen_move,
                    reasoning=parsed.get("reasoning", ""),
                )

                # Export the active span so match.py can submit evaluations
                # after round resolution, when the actual opponent move is known.
                if _llmobs_enabled:
                    try:
                        result.llmobs_span = _LLMObs.export_span()
                    except Exception:
                        pass

                return result
```

(The `_llmobs_submit_evaluation` call is removed — it was dead code since `actual_move` was never passed.)

### Step 3: In `predict_opponent_streaming`, remove the dead `_llmobs_submit_evaluation` call

Find this line near the end of the Bedrock streaming branch:

```python
                # Submit LLM Obs evaluations for streamed predictions
                _llmobs_submit_evaluation(self.agent_name, result.predictions)
```

Remove those two lines. The streaming path is not tied to round resolution so deferred evaluation doesn't apply here.

### Step 4: Verify Python syntax

```bash
python3 -c "import ast; ast.parse(open('/Users/nihalnihalani/Desktop/Github/dtadog/agent-colosseum/backend/agent.py').read()); print('OK')"
```
Expected: `OK`

### Step 5: Commit

```bash
cd /Users/nihalnihalani/Desktop/Github/dtadog/agent-colosseum
git add backend/agent.py
git commit -m "feat: store exported LLMObs span on PredictionResult for deferred evaluation submission"
```

---

## Task 2: Update `_llmobs_submit_evaluation` to accept `span_context` parameter

**Files:**
- Modify: `backend/agent.py` — `_llmobs_submit_evaluation` function (lines 71-98)

### Step 1: Rewrite the function signature and body

Current signature:
```python
def _llmobs_submit_evaluation(
    agent_name: str,
    predictions: list[dict],
    actual_move: str | None = None,
) -> None:
    """Submit prediction accuracy evaluations to LLM Observability."""
    if not _llmobs_enabled or actual_move is None:
        return

    try:
        exported_span = _LLMObs.export_span()
        for i, pred in enumerate(predictions):
            ...
            _LLMObs.submit_evaluation(
                span_context=exported_span,
                ...
            )
    except Exception as e:
        logger.debug("LLMObs evaluation submit failed: %s", e)
```

Replace with:
```python
def _llmobs_submit_evaluation(
    agent_name: str,
    predictions: list[dict],
    actual_move: str,
    span_context: Any = None,
) -> None:
    """Submit prediction accuracy evaluations to LLM Observability.

    Must be called after round resolution when actual_move is known.
    span_context should be the LLMObs exported span from prediction time,
    stored on PredictionResult.llmobs_span.
    """
    if not _llmobs_enabled or span_context is None:
        return

    try:
        for i, pred in enumerate(predictions):
            predicted = pred.get("opponentMove", "")
            was_correct = predicted == actual_move
            _LLMObs.submit_evaluation(
                span_context=span_context,
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

Key changes:
- `actual_move` is now a required `str` (no default) — callers must pass it
- `span_context` is a new optional parameter (defaults to `None`)
- The guard now checks `span_context is None` instead of `actual_move is None`
- Removes the `_LLMObs.export_span()` call (span is passed in from outside)

### Step 2: Verify Python syntax

```bash
python3 -c "import ast; ast.parse(open('/Users/nihalnihalani/Desktop/Github/dtadog/agent-colosseum/backend/agent.py').read()); print('OK')"
```
Expected: `OK`

### Step 3: Commit

```bash
cd /Users/nihalnihalani/Desktop/Github/dtadog/agent-colosseum
git add backend/agent.py
git commit -m "refactor: _llmobs_submit_evaluation accepts span_context parameter instead of calling export_span internally"
```

---

## Task 3: Wire evaluation submission in `match.py:_run_round()` after resolution

**Files:**
- Modify: `backend/match.py` — `_run_round` method (lines 213–397) and imports (line 12)

### Step 1: Add `_llmobs_submit_evaluation` to the import from `backend.agent`

Find line 12:
```python
from backend.agent import AgentPredictor, PredictionResult
```

Change to:
```python
from backend.agent import AgentPredictor, PredictionResult, _llmobs_submit_evaluation
```

### Step 2: Add evaluation submission after `_annotate_predictions` in `_run_round()`

Find lines 284-297 (after both `_annotate_predictions` calls, before the `collapse` yield):

```python
        red_preds_annotated = self._annotate_predictions(
            red_result.predictions, blue_move, "red"
        )
        blue_preds_annotated = self._annotate_predictions(
            blue_result.predictions, red_move, "blue"
        )

        # --- collapse event ---
        yield {
            ...
        }
```

Insert a new block between `_annotate_predictions` calls and the `collapse` yield:

```python
        red_preds_annotated = self._annotate_predictions(
            red_result.predictions, blue_move, "red"
        )
        blue_preds_annotated = self._annotate_predictions(
            blue_result.predictions, red_move, "blue"
        )

        # --- LLMObs deferred evaluations: submit now that actual moves are known ---
        # Red predicted blue's move; blue predicted red's move.
        gt = self.config.game_type
        if gt == "negotiation":
            blue_actual_str = f"{blue_move.type.value}_{blue_move.price}"
            red_actual_str = f"{red_move.type.value}_{red_move.price}"
        elif gt == "auction":
            blue_actual_str = f"{blue_move.type.value}_{blue_move.amount}"
            red_actual_str = f"{red_move.type.value}_{red_move.amount}"
        else:
            blue_actual_str = f"{blue_move.type.value}_{blue_move.target.value}"
            red_actual_str = f"{red_move.type.value}_{red_move.target.value}"

        _llmobs_submit_evaluation(
            "red", red_result.predictions, blue_actual_str, red_result.llmobs_span
        )
        _llmobs_submit_evaluation(
            "blue", blue_result.predictions, red_actual_str, blue_result.llmobs_span
        )

        # --- collapse event ---
        yield {
            ...
        }
```

### Step 3: Verify Python syntax

```bash
python3 -c "import ast; ast.parse(open('/Users/nihalnihalani/Desktop/Github/dtadog/agent-colosseum/backend/match.py').read()); print('OK')"
```
Expected: `OK`

### Step 4: Smoke-test import

```bash
cd /Users/nihalnihalani/Desktop/Github/dtadog/agent-colosseum
MOCK_MODE=true python3 -c "
from backend.match import Match, MatchConfig
from backend.agent import AgentPredictor, PredictionResult, _llmobs_submit_evaluation
r = PredictionResult()
print('PredictionResult.llmobs_span field:', r.llmobs_span)
print('_llmobs_submit_evaluation imported OK')
"
```
Expected:
```
PredictionResult.llmobs_span field: None
_llmobs_submit_evaluation imported OK
```

### Step 5: Commit

```bash
cd /Users/nihalnihalani/Desktop/Github/dtadog/agent-colosseum
git add backend/match.py
git commit -m "feat: submit LLMObs prediction accuracy evaluations after round resolution in _run_round"
```

---

## Files Changed

| File | Task | Change |
|------|------|--------|
| `backend/agent.py` | 1 | `PredictionResult.llmobs_span` field; export span in `_predict_bedrock`; remove dead calls |
| `backend/agent.py` | 2 | `_llmobs_submit_evaluation` accepts `span_context`, requires `actual_move` |
| `backend/match.py` | 3 | Import `_llmobs_submit_evaluation`; call it post-resolution in `_run_round()` |

**Total: 2 files, ~40 lines changed, 0 new files.**

---

## Verification (after all 3 tasks)

When `DD_API_KEY` is NOT set (mock mode / no Datadog):
- `_llmobs_enabled = False` → `_llmobs_submit_evaluation` returns immediately
- `result.llmobs_span` is `None` → evaluation skipped silently
- **No errors, no behavior change for users without Datadog**

When `DD_API_KEY` IS set and `MOCK_MODE=false` (Bedrock path):
- Span is exported inside `_predict_bedrock` and stored on `result.llmobs_span`
- After resolution, `_llmobs_submit_evaluation` submits 3 evaluations per agent per round (one per prediction branch)
- Each evaluation is linked to the span trace in Datadog LLM Observability
