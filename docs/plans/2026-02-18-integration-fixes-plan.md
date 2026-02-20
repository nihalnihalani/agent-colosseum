# Integration Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all four broken integrations (WebSocket, Neo4j, CopilotKit/AG-UI impact icons, TypeScript cast) and remove debug artifact pollution across the Agent Colosseum codebase.

**Architecture:** Seven targeted file edits — no new files. Each fix is isolated to the exact lines identified in the design doc. Execution order is chosen to clean up noise first so subsequent diffs are readable.

**Tech Stack:** FastAPI + Python 3.12 (backend), Next.js 16 + React 19 + TypeScript (frontend), CopilotKit 1.51 + AG-UI protocol, Neo4j async driver, WebSocket.

---

## Task 1: Remove Debug Logging — `main.py`

**Files:**
- Modify: `agent-colosseum/backend/main.py`

**Background:** Three `#region agent log` / `#endregion` blocks write JSON to a hardcoded
absolute path (`/Users/nihalnihalani/.../debug-2b3299.log`). They must all be removed.

**Step 1: Remove the top-level import block (lines 22–28)**

Find and delete this block in `main.py`:
```python
# #region agent log
import json, time
try:
    with open("/Users/nihalnihalani/Desktop/Github/dtadog/.cursor/debug-2b3299.log", "a") as f:
        f.write(json.dumps({"sessionId": "2b3299", "timestamp": int(time.time() * 1000), "location": "backend/main.py:top_level", "message": "Backend module imported", "data": {}, "hypothesisId": "A"}) + "\n")
except Exception: pass
# #endregion
```

**Step 2: Remove the lifespan block (lines 54–60)**

Find and delete this block inside the `lifespan` function:
```python
    # #region agent log
    import json, time
    try:
        with open("/Users/nihalnihalani/Desktop/Github/dtadog/.cursor/debug-2b3299.log", "a") as f:
            f.write(json.dumps({"sessionId": "2b3299", "timestamp": int(time.time() * 1000), "location": "backend/main.py:lifespan", "message": "Backend starting up", "data": {"mock_mode": os.getenv("MOCK_MODE")}, "hypothesisId": "A"}) + "\n")
    except Exception: pass
    # #endregion
```

**Step 3: Remove the WebSocket block (two blocks inside `websocket_match`)**

Find and delete both blocks inside `websocket_match` (the `WebSocket connected` and `Received start message` ones):
```python
    # #region agent log
    import json, time
    try:
        with open("/Users/nihalnihalani/Desktop/Github/dtadog/.cursor/debug-2b3299.log", "a") as f:
            f.write(json.dumps({"sessionId": "2b3299", "timestamp": int(time.time() * 1000), "location": "backend/main.py:websocket_match", "message": "WebSocket connected", "data": {"match_id": match_id}, "hypothesisId": "C"}) + "\n")
    except Exception: pass
    # #endregion
```
and:
```python
        # #region agent log
        try:
            with open("/Users/nihalnihalani/Desktop/Github/dtadog/.cursor/debug-2b3299.log", "a") as f:
                f.write(json.dumps({"sessionId": "2b3299", "timestamp": int(time.time() * 1000), "location": "backend/main.py:websocket_match", "message": "Received start message", "data": {"start_msg": start_msg}, "hypothesisId": "C"}) + "\n")
        except Exception: pass
        # #endregion
```

**Step 4: Verify no debug references remain**

```bash
grep -n "debug-2b3299\|#region agent log\|#endregion" agent-colosseum/backend/main.py
```
Expected: no output.

**Step 5: Commit**
```bash
git add agent-colosseum/backend/main.py
git commit -m "chore: remove debug logging artifacts from main.py"
```

---

## Task 2: Remove Debug Logging — `agent.py`

**Files:**
- Modify: `agent-colosseum/backend/agent.py`

**Step 1: Remove the single debug block inside `predict_opponent` (lines 706–711)**

Find and delete this block inside the `predict_opponent` method:
```python
        # #region agent log
        import json, time
        try:
            with open("/Users/nihalnihalani/Desktop/Github/dtadog/.cursor/debug-2b3299.log", "a") as f:
                f.write(json.dumps({"sessionId": "2b3299", "timestamp": int(time.time() * 1000), "location": "backend/agent.py:predict_opponent", "message": "Predicting opponent", "data": {"mock_mode": self.mock_mode, "agent": self.agent_name}, "hypothesisId": "D"}) + "\n")
        except Exception: pass
        # #endregion
```

**Step 2: Verify**
```bash
grep -n "debug-2b3299\|#region agent log" agent-colosseum/backend/agent.py
```
Expected: no output.

**Step 3: Commit**
```bash
git add agent-colosseum/backend/agent.py
git commit -m "chore: remove debug logging artifact from agent.py"
```

---

## Task 3: Remove Debug Logging — `neo4j_client.py`

**Files:**
- Modify: `agent-colosseum/backend/neo4j_client.py`

**Step 1: Remove the three debug blocks**

Inside `verify_connectivity` (success path, ~lines 32–38):
```python
            # #region agent log
            import json, time
            try:
                with open("/Users/nihalnihalani/Desktop/Github/dtadog/.cursor/debug-2b3299.log", "a") as f:
                    f.write(json.dumps({"sessionId": "2b3299", "timestamp": int(time.time() * 1000), "location": "backend/neo4j_client.py:verify_connectivity", "message": "Neo4j connectivity verified", "data": {}, "hypothesisId": "B"}) + "\n")
            except Exception: pass
            # #endregion
```

Inside `verify_connectivity` (failure path, ~lines 41–47):
```python
            # #region agent log
            import json, time
            try:
                with open("/Users/nihalnihalani/Desktop/Github/dtadog/.cursor/debug-2b3299.log", "a") as f:
                    f.write(json.dumps({"sessionId": "2b3299", "timestamp": int(time.time() * 1000), "location": "backend/neo4j_client.py:verify_connectivity", "message": "Neo4j connectivity failed", "data": {"error": str(e)}, "hypothesisId": "B"}) + "\n")
            except Exception: pass
            # #endregion
```

Inside `get_neo4j_client` (~lines 524–530):
```python
    # #region agent log
    import json, time
    try:
        with open("/Users/nihalnihalani/Desktop/Github/dtadog/.cursor/debug-2b3299.log", "a") as f:
            f.write(json.dumps({"sessionId": "2b3299", "timestamp": int(time.time() * 1000), "location": "backend/neo4j_client.py:get_neo4j_client", "message": "Initializing Neo4j client", "data": {"uri_set": bool(uri)}, "hypothesisId": "B"}) + "\n")
    except Exception: pass
    # #endregion
```

**Step 2: Verify**
```bash
grep -n "debug-2b3299\|#region agent log" agent-colosseum/backend/neo4j_client.py
```
Expected: no output.

**Step 3: Commit**
```bash
git add agent-colosseum/backend/neo4j_client.py
git commit -m "chore: remove debug logging artifacts from neo4j_client.py"
```

---

## Task 4: Fix Neo4j Game-Type Dispatch in `match.py`

**Files:**
- Modify: `agent-colosseum/backend/match.py`

**Background:** The Neo4j storage block in `_run_round` always calls `store_round()` (Resource
Wars only). For negotiation and auction matches it passes the wrong move shape causing a
`KeyError` silently swallowed by `try/except`. The dedicated `store_negotiation_round()` and
`store_auction_round()` methods already exist on `Neo4jClient` and `NoOpNeo4jClient`.

**Step 1: Locate the Neo4j storage block in `_run_round`**

Find this section (~lines 337–352):
```python
        # --- Neo4j storage ---
        if self._neo4j_client:
            try:
                await self._neo4j_client.store_round(
                    match_id=self.config.match_id,
                    round_data={
                        "round": round_num,
                        "state_hash": state_before.state_hash(),
                        "red_move": red_move.to_dict(),
                        "blue_move": blue_move.to_dict(),
                        "red_predictions": red_preds_annotated,
                        "blue_predictions": blue_preds_annotated,
                        "resolution": resolution.to_dict(),
                    },
                )
            except Exception as e:
                logger.warning("Neo4j storage failed: %s", e)
```

**Step 2: Replace with game-type-aware dispatch**

Replace the entire block with:
```python
        # --- Neo4j storage ---
        if self._neo4j_client:
            try:
                gt = self.config.game_type
                if gt == "negotiation":
                    await self._neo4j_client.store_negotiation_round(
                        match_id=self.config.match_id,
                        round_data={
                            "round": round_num,
                            "state_hash": state_before.state_hash(),
                            "red_move": red_move.to_dict(),
                            "blue_move": blue_move.to_dict(),
                        },
                    )
                elif gt == "auction":
                    current_item = state_before.current_item()
                    await self._neo4j_client.store_auction_round(
                        match_id=self.config.match_id,
                        round_data={
                            "round": round_num,
                            "item_name": current_item.name if current_item else "",
                            "red_move": red_move.to_dict(),
                            "blue_move": blue_move.to_dict(),
                        },
                    )
                else:
                    await self._neo4j_client.store_round(
                        match_id=self.config.match_id,
                        round_data={
                            "round": round_num,
                            "state_hash": state_before.state_hash(),
                            "red_move": red_move.to_dict(),
                            "blue_move": blue_move.to_dict(),
                            "red_predictions": red_preds_annotated,
                            "blue_predictions": blue_preds_annotated,
                            "resolution": resolution.to_dict(),
                        },
                    )
            except Exception as e:
                logger.warning("Neo4j storage failed: %s", e)
```

**Step 3: Verify the file is syntactically valid**
```bash
cd agent-colosseum && python -c "from backend.match import Match" && echo "OK"
```
Expected: `OK`

**Step 4: Commit**
```bash
git add agent-colosseum/backend/match.py
git commit -m "fix: dispatch correct Neo4j method per game type in match runner"
```

---

## Task 5: Fix WebSocket Port + Race Condition in `useMatchWebSocket.ts`

**Files:**
- Modify: `agent-colosseum/frontend/hooks/useMatchWebSocket.ts`

This task contains two related fixes applied together in one file.

### Fix A — Wrong default port

**Step 1: Find line ~466**
```ts
const wsHost = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8888';
```

**Step 2: Change `8888` to `8000`**
```ts
const wsHost = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
```

### Fix B — Race condition: startMatch fires before WebSocket is OPEN

**Step 1: Add `pendingConfigRef` to the hook**

After the existing refs (after the line declaring `reconnectAttempts`), add:
```ts
const pendingConfigRef = useRef<MatchConfig | null>(null);
```

**Step 2: Drain the pending config in `ws.onopen`**

Find the `ws.onopen` handler:
```ts
    ws.onopen = () => {
      setIsConnected(true);
      setError(null);
      reconnectAttempts.current = 0;
    };
```

Replace with:
```ts
    ws.onopen = () => {
      setIsConnected(true);
      setError(null);
      reconnectAttempts.current = 0;
      if (pendingConfigRef.current) {
        const cfg = pendingConfigRef.current;
        pendingConfigRef.current = null;
        ws.send(
          JSON.stringify({
            type: 'start_match',
            gameType: cfg.gameType,
            redPersonality: cfg.redPersonality,
            bluePersonality: cfg.bluePersonality,
            rounds: cfg.totalRounds,
          })
        );
      }
    };
```

**Step 3: Update `startMatch` to queue config when not yet open**

Find the `startMatch` callback. The `else` branch (when `ws.readyState !== WebSocket.OPEN`) is currently silent — it just does nothing. Replace the entire callback with:
```ts
  const startMatch = useCallback(
    (config: MatchConfig) => {
      if (isMock) {
        setIsConnected(true);
        runMockMatch(config);
        return;
      }
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'start_match',
            gameType: config.gameType,
            redPersonality: config.redPersonality,
            bluePersonality: config.bluePersonality,
            rounds: config.totalRounds,
          })
        );
      } else {
        // Socket is still connecting — queue and send when onopen fires
        pendingConfigRef.current = config;
      }
    },
    [isMock, runMockMatch]
  );
```

**Step 4: Verify TypeScript compilation**
```bash
cd agent-colosseum/frontend && npx tsc --noEmit 2>&1 | head -30
```
Expected: No errors related to `useMatchWebSocket.ts`.

**Step 5: Verify no `8888` references remain**
```bash
grep -n "8888" agent-colosseum/frontend/hooks/useMatchWebSocket.ts
```
Expected: no output.

**Step 6: Commit**
```bash
git add agent-colosseum/frontend/hooks/useMatchWebSocket.ts
git commit -m "fix: correct WebSocket default port and resolve startMatch race condition"
```

---

## Task 6: Fix Impact Icons in `StrategyInsightCard.tsx`

**Files:**
- Modify: `agent-colosseum/frontend/components/StrategyInsightCard.tsx`

**Background:** The backend sends `impact: "high" | "medium" | "low"`. The icon branch
currently checks for `"positive"` and `"negative"` which never match. `Zap` is already
imported; `TrendingUp` and `TrendingDown` are already imported.

**Step 1: Locate the impact icon branch (~lines 121–127)**
```tsx
              {moment.impact === 'positive' ? (
                <TrendingUp className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
              ) : moment.impact === 'negative' ? (
                <TrendingDown className="w-2.5 h-2.5 text-rose-400 shrink-0" />
              ) : null}
```

**Step 2: Replace with the correct values**

Replace the entire ternary with:
```tsx
              {(moment.impact === 'high' || moment.impact === 'positive') ? (
                <TrendingUp className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
              ) : (moment.impact === 'low' || moment.impact === 'negative') ? (
                <TrendingDown className="w-2.5 h-2.5 text-rose-400 shrink-0" />
              ) : moment.impact === 'medium' ? (
                <Zap className="w-2.5 h-2.5 text-amber-400 shrink-0" />
              ) : null}
```

**Step 3: Verify TypeScript**
```bash
cd agent-colosseum/frontend && npx tsc --noEmit 2>&1 | grep StrategyInsightCard
```
Expected: no output.

**Step 4: Commit**
```bash
git add agent-colosseum/frontend/components/StrategyInsightCard.tsx
git commit -m "fix: map backend impact values (high/medium/low) to AG-UI insight card icons"
```

---

## Task 7: Fix TypeScript `as any` Cast in `copilotkit/route.ts`

**Files:**
- Modify: `agent-colosseum/frontend/app/api/copilotkit/route.ts`

**Background:** `arenaCommentator as any` silences a type mismatch between `HttpAgent`
from `@ag-ui/client` and the `Agent` type in `@copilotkit/runtime`. Using `unknown as Agent`
is strictly safer — it forces an explicit declaration of intent without suppressing the
type system entirely.

**Step 1: Add the `Agent` type import**

Current imports:
```ts
import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
```

Add `type Agent` to the import:
```ts
import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
  type Agent,
} from "@copilotkit/runtime";
```

**Step 2: Replace `as any` with `as unknown as Agent`**

Find:
```ts
    "arena-commentator": arenaCommentator as any,
```

Replace with:
```ts
    "arena-commentator": arenaCommentator as unknown as Agent,
```

**Step 3: Remove the eslint-disable comment** (it's no longer needed)

Delete:
```ts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
```

**Step 4: Verify TypeScript**
```bash
cd agent-colosseum/frontend && npx tsc --noEmit 2>&1 | grep route
```
Expected: no output, or only pre-existing errors unrelated to this file.

**Step 5: Commit**
```bash
git add agent-colosseum/frontend/app/api/copilotkit/route.ts
git commit -m "fix: replace unsafe 'as any' with typed cast for CopilotKit agent registration"
```

---

## End-to-End Smoke Test

After all tasks are committed, verify the full integration:

**Backend:**
```bash
cd agent-colosseum
PYTHONPATH=. MOCK_MODE=true uvicorn backend.main:app --reload --port 8000
```
Expected log: `AG-UI agent endpoint mounted at /agent` (not "AG-UI runtime not available")

**Frontend:**
```bash
cd agent-colosseum/frontend
npm run dev
```
Open `http://localhost:3000` → select Resource Wars → Aggressive vs Defensive → Initialize Simulation.

**WebSocket check:** Open browser DevTools → Network → WS tab. You should see a connection
to `ws://localhost:8000/ws/match/match_XXXXXXXX` and a stream of JSON events
(`round_start`, `prediction`, `collapse`, `round_end`, ...).

**CopilotKit check:** The AI Commentator panel should appear. Type "What's happening?" in
the chat. You should receive a streamed text response within 2 seconds.

**StrategyInsightCard check:** After a round completes, the Strategy Analysis panel should
show icons next to key moments (green TrendingUp, amber Zap, red TrendingDown).

---

## Summary

| Task | File | Type |
|------|------|------|
| 1 | `backend/main.py` | chore |
| 2 | `backend/agent.py` | chore |
| 3 | `backend/neo4j_client.py` | chore |
| 4 | `backend/match.py` | fix |
| 5 | `frontend/hooks/useMatchWebSocket.ts` | fix |
| 6 | `frontend/components/StrategyInsightCard.tsx` | fix |
| 7 | `frontend/app/api/copilotkit/route.ts` | fix |

**7 files, ~50 lines changed, 7 commits, no new files.**
