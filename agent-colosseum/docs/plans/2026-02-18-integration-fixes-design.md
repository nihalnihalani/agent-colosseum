# Integration Fixes Design — Agent Colosseum
**Date:** 2026-02-18
**Scope:** Option B — Fix all four broken integrations + remove debug artifact pollution + fix TypeScript cast

---

## Problem Summary

All four integrations (WebSocket, Neo4j, MongoDB connectivity, CopilotKit/AG-UI) have bugs
that prevent the application from working correctly end-to-end. Separately, debug logging code
left over from a Cursor session pollutes three backend files.

---

## Fix 1 — WebSocket: Wrong Default Port

**File:** `frontend/hooks/useMatchWebSocket.ts:466`

**Bug:** Default WS host is `ws://localhost:8888` but the backend runs on port `8000`.
Any deployment without `NEXT_PUBLIC_WS_URL` explicitly set silently connects to the wrong port.

**Fix:** Change the fallback to `ws://localhost:8000`.

---

## Fix 2 — WebSocket: Race Condition (match never starts)

**File:** `frontend/hooks/useMatchWebSocket.ts`

**Bug:** `arena/page.tsx` calls `startMatch(config)` in a 500 ms `setTimeout`. At that point
the WebSocket may still be in `CONNECTING` state (readyState = 0). The `send()` inside
`startMatch` checks `readyState === WebSocket.OPEN` and silently drops the message if the
connection isn't ready. The backend never receives `start_match`, so the match never begins.

**Fix:** Add a `pendingConfigRef` to the hook. When `startMatch()` fires before the socket
is open, store the config in `pendingConfigRef`. In `ws.onopen`, drain the pending config and
send the `start_match` message immediately. This removes the race entirely — the hook sends
the message as soon as the connection is established, regardless of when `startMatch()` was
called.

---

## Fix 3 — Neo4j: Wrong Method Dispatched for Negotiation/Auction

**File:** `backend/match.py` (the Neo4j storage section of `_run_round`)

**Bug:** `match.py` always calls `neo4j_client.store_round()` for all three game types.
That method is written for Resource Wars and expects the move dict to contain `target` and
`amount` fields. For Negotiation games, `NegotiationMove.to_dict()` returns `{type, price, terms}`.
Accessing `round_data["red_move"]["target"]` raises a `KeyError` that is caught by the outer
`try/except`, so Neo4j silently receives nothing for negotiation and auction rounds.
The dedicated `store_negotiation_round()` and `store_auction_round()` methods exist but are
never called.

**Fix:** Add game-type dispatch inside the Neo4j storage block:
- `negotiation` → `store_negotiation_round()`
- `auction` → `store_auction_round()` (pass `item_name` from the current item)
- `resource_wars` → `store_round()` (existing behaviour, unchanged)

---

## Fix 4 — CopilotKit/AG-UI: Impact Icons Never Render in StrategyInsightCard

**File:** `frontend/components/StrategyInsightCard.tsx:121-127`

**Bug:** The backend (`copilotkit_runtime.py:_find_key_moments` and `_build_insight_card`)
sends key moment objects with `"impact": "high" | "medium" | "low"`. The frontend renders
`TrendingUp` only when `moment.impact === 'positive'` and `TrendingDown` only when it equals
`'negative'`. These strings never match, so the entire icon block is permanently inert.

**Fix:** Update the icon branch to match the values the backend actually sends:
- `"high"` → `TrendingUp` (green, positive signal)
- `"medium"` → `Zap` (amber, notable event)
- `"low"` / anything else → no icon

Also retain the legacy `"positive"` / `"negative"` paths so that any external tool calling
`showInsightCard` with those values still renders icons.

---

## Fix 5 — Remove Debug Log Pollution

**Files:** `backend/main.py`, `backend/agent.py`, `backend/neo4j_client.py`

**Bug:** All three files contain `#region agent log` / `#endregion` blocks that were inserted
during a debugging session. They write JSON to a hardcoded absolute path:
`/Users/nihalnihalani/Desktop/Github/dtadog/.cursor/debug-2b3299.log`

This path is machine-specific, clutters the code, and will silently fail (and be swallowed
by the bare `except Exception: pass`) on any other machine. The blocks should be completely
removed.

Affected locations:
- `main.py`: lines 22-28, 54-60, 337-343, 349-353
- `agent.py`: lines 706-711
- `neo4j_client.py`: lines 32-38, 41-47, 524-530

---

## Fix 6 — TypeScript: `as any` Cast in CopilotKit Route

**File:** `frontend/app/api/copilotkit/route.ts:19`

**Bug:** `arenaCommentator as any` silences a legitimate type mismatch between `HttpAgent`
from `@ag-ui/client` and the `Agent` type expected by `CopilotRuntime.agents`. While this
doesn't cause a runtime crash, it disables type-checking for the agent registration and can
hide future breaking changes.

**Fix:** Import `Agent` from `@copilotkit/runtime` and cast `arenaCommentator` to `Agent`
instead of `any`. If the package versions still disagree, use `unknown as Agent` which is
type-safe while still satisfying the compiler.

---

## Execution Order

1. Fix 5 first (removes noise, makes diffs on the other backend files cleaner)
2. Fix 3 (Neo4j dispatch — backend only)
3. Fix 1 + Fix 2 together (both in `useMatchWebSocket.ts`)
4. Fix 4 (StrategyInsightCard)
5. Fix 6 (TS cast — lowest risk, last)

---

## Files Changed

| File | Fixes Applied |
|------|--------------|
| `backend/main.py` | Fix 5 (remove debug blocks) |
| `backend/agent.py` | Fix 5 (remove debug block) |
| `backend/neo4j_client.py` | Fix 5 (remove debug blocks) |
| `backend/match.py` | Fix 3 (Neo4j game-type dispatch) |
| `frontend/hooks/useMatchWebSocket.ts` | Fix 1 + Fix 2 (WS port + race condition) |
| `frontend/components/StrategyInsightCard.tsx` | Fix 4 (impact icon values) |
| `frontend/app/api/copilotkit/route.ts` | Fix 6 (TS cast) |

Total: **7 files**, **~50 lines changed**, no new files created.
