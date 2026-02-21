"""LangGraph commentator agent for Agent Colosseum.

Implements a 5-node LangGraph graph that:
  - Analyzes the current match and builds rich state
  - Emits state via CopilotKit
  - Checks for tiebreaker conditions (uses interrupt)
  - Generates commentary via Bedrock or mock mode
  - Emits insight tool calls via CopilotKit

The module exposes:
  - commentator_graph: compiled CompiledGraph instance
  - set_match_store(store): shared match state setter (mirrors copilotkit_runtime.py)
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import interrupt
from typing_extensions import TypedDict

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Optional CopilotKit imports — degrade gracefully if unavailable
# ---------------------------------------------------------------------------

try:
    from copilotkit.langgraph import copilotkit_emit_state as _copilotkit_emit_state  # type: ignore
    _EMIT_STATE_AVAILABLE = True
except Exception:
    _EMIT_STATE_AVAILABLE = False
    _copilotkit_emit_state = None

try:
    from copilotkit.langgraph import copilotkit_emit_tool_call as _copilotkit_emit_tool_call  # type: ignore
    _EMIT_TOOL_CALL_AVAILABLE = True
except Exception:
    _EMIT_TOOL_CALL_AVAILABLE = False
    _copilotkit_emit_tool_call = None


# ---------------------------------------------------------------------------
# Shared match store (set by main.py, mirrors copilotkit_runtime.py)
# ---------------------------------------------------------------------------

_match_store: dict[str, dict[str, Any]] = {}


def set_match_store(store: dict[str, dict[str, Any]]) -> None:
    """Allow main.py to share its in-memory match store with this agent."""
    global _match_store
    _match_store = store


# ---------------------------------------------------------------------------
# Import helper functions from copilotkit_runtime
# ---------------------------------------------------------------------------

# We import these at function-call time to avoid circular import issues
# and to make the module importable even when copilotkit_runtime isn't wired yet.

def _get_helpers():
    """Lazily import helper functions from copilotkit_runtime."""
    from backend.copilotkit_runtime import (  # type: ignore
        _find_current_match,
        _build_agent_state,
        _generate_commentary,
        _build_insight_card,
        _extract_user_message,
    )
    return (
        _find_current_match,
        _build_agent_state,
        _generate_commentary,
        _build_insight_card,
        _extract_user_message,
    )


# ---------------------------------------------------------------------------
# CommentatorState TypedDict
# ---------------------------------------------------------------------------

class CommentatorState(TypedDict, total=False):
    """State for the LangGraph commentator agent.

    Required by CopilotKit:
      messages  -- conversation message list (managed by CopilotKit)
      copilotkit -- CopilotKit metadata dict (actions list, etc.)

    Match analysis fields (mirrors _build_agent_state output keys):
      strategy_analysis  -- per-agent style/tactic/risk data
      momentum           -- current match momentum leader + confidence
      prediction_trends  -- per-agent prediction accuracy history
      key_moments        -- list of notable in-match events
      current_insight    -- latest commentary text
      match_progress     -- {round, totalRounds, phase}

    Interaction fields:
      audience_votes     -- dict of votes sent from frontend via useCoAgent setState
      special_mode       -- set by the interrupt node after tiebreaker resolution
    """

    # CopilotKit-required fields
    messages: list
    copilotkit: dict

    # Match analysis
    strategy_analysis: dict
    momentum: dict
    prediction_trends: dict
    key_moments: list
    current_insight: str
    match_progress: dict

    # Interaction
    audience_votes: dict
    special_mode: Optional[str]


# ---------------------------------------------------------------------------
# Node: analyze_match_node
# ---------------------------------------------------------------------------

def analyze_match_node(state: CommentatorState, config: dict) -> dict:
    """Build rich agent state from the current match data.

    Preserves existing audience_votes and special_mode so they are not
    overwritten when match analysis is refreshed.
    """
    try:
        (
            _find_current_match,
            _build_agent_state,
            _generate_commentary,
            _build_insight_card,
            _extract_user_message,
        ) = _get_helpers()

        match_id, match_data = _find_current_match()
        agent_state = _build_agent_state(match_id, match_data)

        return {
            "strategy_analysis": agent_state.get("strategyAnalysis", {}),
            "momentum": agent_state.get("momentum", {}),
            "prediction_trends": agent_state.get("predictionTrends", {}),
            "key_moments": agent_state.get("keyMoments", []),
            "match_progress": agent_state.get("matchProgress", {}),
            "current_insight": agent_state.get("currentInsight", ""),
            # Preserve fields set by the frontend / prior nodes
            "audience_votes": state.get("audience_votes", {}),
            "special_mode": state.get("special_mode", None),
        }
    except Exception as exc:
        logger.error("analyze_match_node error: %s", exc, exc_info=True)
        return {}


# ---------------------------------------------------------------------------
# Node: emit_state_node
# ---------------------------------------------------------------------------

async def emit_state_node(state: CommentatorState, config: dict) -> dict:
    """Emit the current analysis state to CopilotKit so the frontend receives it.

    copilotkit_emit_state is a coroutine — await it directly.
    This is a no-op if copilotkit_emit_state is not available.
    """
    if _EMIT_STATE_AVAILABLE and _copilotkit_emit_state is not None:
        try:
            await _copilotkit_emit_state(config, dict(state))
        except Exception as exc:
            logger.warning("emit_state_node: copilotkit_emit_state failed: %s", exc)
    return {}


# ---------------------------------------------------------------------------
# Node: check_tiebreaker_node
# ---------------------------------------------------------------------------

def check_tiebreaker_node(state: CommentatorState, config: dict) -> dict:
    """Check if the match is tied at round >= 5 and trigger an interrupt.

    If the match is tied AND we are past round 5 AND the phase is active,
    we call interrupt() to ask the human (frontend) for a special_mode choice.

    Returns {"special_mode": <choice>} after interrupt resolves, or {} if
    no interrupt is needed.
    """
    try:
        momentum = state.get("momentum", {})
        progress = state.get("match_progress", {})

        leader = momentum.get("leader", "none")
        current_round = progress.get("round", 0)
        phase = progress.get("phase", "idle")

        is_tied = leader in ("tied", "none")
        is_late_game = current_round >= 5
        is_active = phase not in ("idle", "completed")

        if is_tied and is_late_game and is_active:
            # Ask the frontend to pick a tiebreaker mode
            choice = interrupt(
                {
                    "type": "tiebreaker_vote",
                    "message": (
                        f"The match is dead even after {current_round} rounds! "
                        "Choose a tiebreaker mode: 'sudden_death', 'overtime', or 'audience_choice'."
                    ),
                    "options": ["sudden_death", "overtime", "audience_choice"],
                    "round": current_round,
                }
            )
            return {"special_mode": str(choice)}
    except Exception as exc:
        logger.warning("check_tiebreaker_node error: %s", exc, exc_info=True)

    return {}


# ---------------------------------------------------------------------------
# Node: generate_commentary_node
# ---------------------------------------------------------------------------

def generate_commentary_node(state: CommentatorState, config: dict) -> dict:
    """Extract user message and generate commentary from the current match state."""
    try:
        (
            _find_current_match,
            _build_agent_state,
            _generate_commentary,
            _build_insight_card,
            _extract_user_message,
        ) = _get_helpers()

        messages = state.get("messages", [])
        user_message = _extract_user_message(messages)

        # Reconstruct the agent_state dict that _generate_commentary expects
        # (camelCase keys, as returned by _build_agent_state)
        agent_state_for_commentary = {
            "strategyAnalysis": state.get("strategy_analysis", {}),
            "momentum": state.get("momentum", {}),
            "predictionTrends": state.get("prediction_trends", {}),
            "keyMoments": state.get("key_moments", []),
            "currentInsight": state.get("current_insight", ""),
            "matchProgress": state.get("match_progress", {}),
        }

        # Include special_mode context in user_message if present
        special_mode = state.get("special_mode")
        if special_mode:
            user_message = f"[Tiebreaker mode: {special_mode}] {user_message}"

        commentary = _generate_commentary(user_message, agent_state_for_commentary)
        return {"current_insight": commentary}
    except Exception as exc:
        logger.error("generate_commentary_node error: %s", exc, exc_info=True)
        return {"current_insight": "Commentary temporarily unavailable."}


# ---------------------------------------------------------------------------
# Node: emit_insight_node
# ---------------------------------------------------------------------------

async def emit_insight_node(state: CommentatorState, config: dict) -> dict:
    """Emit tool calls for showInsightCard and highlight_prediction.

    copilotkit_emit_tool_call is a coroutine — await it directly.
    Uses copilotkit_emit_tool_call if available; otherwise no-op.
    """
    if not (_EMIT_TOOL_CALL_AVAILABLE and _copilotkit_emit_tool_call is not None):
        return {}

    try:
        (
            _find_current_match,
            _build_agent_state,
            _generate_commentary,
            _build_insight_card,
            _extract_user_message,
        ) = _get_helpers()

        # Reconstruct agent_state in camelCase for _build_insight_card
        agent_state_for_insight = {
            "strategyAnalysis": state.get("strategy_analysis", {}),
            "momentum": state.get("momentum", {}),
            "predictionTrends": state.get("prediction_trends", {}),
            "keyMoments": state.get("key_moments", []),
            "currentInsight": state.get("current_insight", ""),
            "matchProgress": state.get("match_progress", {}),
        }

        insight = _build_insight_card(agent_state_for_insight)

        # Emit showInsightCard if there is an insight
        if insight:
            try:
                await _copilotkit_emit_tool_call(
                    config,
                    name="showInsightCard",
                    args=insight,
                )
            except Exception as exc:
                logger.warning("emit_insight_node: showInsightCard failed: %s", exc)

        # Emit highlight_prediction if leader has a prediction trend
        momentum = state.get("momentum", {})
        leader = momentum.get("leader", "none")
        prediction_trends = state.get("prediction_trends", {})

        if leader not in ("none", "tied") and prediction_trends.get(leader):
            trends = prediction_trends[leader]
            latest_accuracy = trends[-1] if trends else None
            if latest_accuracy is not None:
                try:
                    await _copilotkit_emit_tool_call(
                        config,
                        name="highlight_prediction",
                        args={
                            "agent": leader,
                            "accuracy": latest_accuracy,
                            "round": state.get("match_progress", {}).get("round", 0),
                        },
                    )
                except Exception as exc:
                    logger.warning(
                        "emit_insight_node: highlight_prediction failed: %s", exc
                    )

    except Exception as exc:
        logger.error("emit_insight_node error: %s", exc, exc_info=True)

    return {}


# ---------------------------------------------------------------------------
# Build and compile the LangGraph graph
# ---------------------------------------------------------------------------

def _build_commentator_graph():
    """Construct and compile the commentator LangGraph."""
    builder = StateGraph(CommentatorState)

    # Register nodes
    builder.add_node("analyze_match", analyze_match_node)
    builder.add_node("emit_state", emit_state_node)
    builder.add_node("check_tiebreaker", check_tiebreaker_node)
    builder.add_node("generate_commentary", generate_commentary_node)
    builder.add_node("emit_insight", emit_insight_node)

    # Wire edges: linear pipeline
    builder.set_entry_point("analyze_match")
    builder.add_edge("analyze_match", "emit_state")
    builder.add_edge("emit_state", "check_tiebreaker")
    builder.add_edge("check_tiebreaker", "generate_commentary")
    builder.add_edge("generate_commentary", "emit_insight")
    builder.add_edge("emit_insight", END)

    # Compile with MemorySaver checkpointer for interrupt support
    checkpointer = MemorySaver()
    return builder.compile(checkpointer=checkpointer)


# Module-level compiled graph instance
commentator_graph = _build_commentator_graph()
