"""AG-UI protocol backend -- streams match analysis with state management and tool calls."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import uuid
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from ag_ui.core import (
    RunAgentInput,
    EventType,
    RunStartedEvent,
    RunFinishedEvent,
    RunErrorEvent,
    TextMessageStartEvent,
    TextMessageContentEvent,
    TextMessageEndEvent,
    StateSnapshotEvent,
    StateDeltaEvent,
    ToolCallStartEvent,
    ToolCallArgsEvent,
    ToolCallEndEvent,
)
from ag_ui.encoder import EventEncoder

logger = logging.getLogger(__name__)

router = APIRouter()

# Shared match state reference (set by main.py)
_match_store: dict[str, dict[str, Any]] = {}


def set_match_store(store: dict[str, dict[str, Any]]) -> None:
    """Allow main.py to share its in-memory match store."""
    global _match_store
    _match_store = store


# ---------------------------------------------------------------------------
# Match data helpers
# ---------------------------------------------------------------------------

def _find_current_match() -> tuple[str | None, dict]:
    """Find the most recent running or completed match and return (match_id, data)."""
    for mid, data in reversed(list(_match_store.items())):
        if data.get("state") in ("running", "completed"):
            return mid, data
    return None, {}


def _get_round_ends(events: list[dict]) -> list[dict]:
    """Extract all round_end events."""
    return [e for e in events if e.get("type") == "round_end"]


def _get_match_end(events: list[dict]) -> dict | None:
    """Extract the match_end event if present."""
    for e in reversed(events):
        if e.get("type") == "match_end":
            return e
    return None


# ---------------------------------------------------------------------------
# Agent state builder -- analyzes match data to build rich state
# ---------------------------------------------------------------------------

def _infer_style(personality: str) -> str:
    """Map personality name to a style label."""
    mapping = {
        "aggressive": "aggressive",
        "defensive": "defensive",
        "balanced": "balanced",
        "random": "chaotic",
        "adaptive": "adaptive",
    }
    return mapping.get(personality.lower(), personality)


def _infer_tactic(personality: str, recent_rounds: list[dict], agent: str) -> str:
    """Infer current tactic from personality and recent round outcomes."""
    if not recent_rounds:
        return f"{personality} opening"

    # Look at last 3 rounds for the agent's scoring trend
    last_scores = []
    for r in recent_rounds[-3:]:
        scores = r.get("scores", {})
        last_scores.append(scores.get(agent, 0))

    if len(last_scores) >= 2:
        trend = last_scores[-1] - last_scores[0]
        if trend > 5:
            return "aggressive push"
        elif trend < -3:
            return "damage control"

    tactics = {
        "aggressive": "high-risk bluffing",
        "defensive": "counter-play exploitation",
        "balanced": "calculated positioning",
        "random": "unpredictable chaos",
        "adaptive": "pattern exploitation",
    }
    return tactics.get(personality.lower(), f"{personality} tactics")


def _compute_risk_level(personality: str, recent_rounds: list[dict], agent: str) -> float:
    """Compute a risk level 0-1 based on personality and recent accuracy."""
    base = {"aggressive": 0.8, "defensive": 0.3, "balanced": 0.5, "random": 0.6, "adaptive": 0.5}
    risk = base.get(personality.lower(), 0.5)

    # Adjust based on recent accuracy -- low accuracy means higher risk
    if recent_rounds:
        accuracies = []
        for r in recent_rounds[-3:]:
            acc = r.get("accuracy", {})
            if agent in acc:
                accuracies.append(acc[agent])
        if accuracies:
            avg_acc = sum(accuracies) / len(accuracies)
            risk = max(0.1, min(1.0, risk + (0.5 - avg_acc) * 0.4))

    return round(risk, 2)


def _compute_prediction_trends(round_ends: list[dict], agent: str) -> list[float]:
    """Build a list of prediction accuracy values per round for an agent."""
    trends = []
    for r in round_ends:
        acc = r.get("accuracy", {})
        trends.append(round(acc.get(agent, 0.0), 2))
    return trends


def _determine_momentum(round_ends: list[dict]) -> dict:
    """Determine which agent has momentum based on recent rounds."""
    if not round_ends:
        return {"leader": "none", "confidence": 0.5, "reason": "Match just started"}

    recent = round_ends[-3:]
    red_wins = 0
    blue_wins = 0
    for r in recent:
        scores = r.get("scores", {})
        if scores.get("red", 0) > scores.get("blue", 0):
            red_wins += 1
        elif scores.get("blue", 0) > scores.get("red", 0):
            blue_wins += 1

    total = len(recent)
    if red_wins > blue_wins:
        return {
            "leader": "red",
            "confidence": round(red_wins / total, 2),
            "reason": f"Won {red_wins} of last {total} rounds",
        }
    elif blue_wins > red_wins:
        return {
            "leader": "blue",
            "confidence": round(blue_wins / total, 2),
            "reason": f"Won {blue_wins} of last {total} rounds",
        }
    return {"leader": "tied", "confidence": 0.5, "reason": "Even performance recently"}


def _find_key_moments(round_ends: list[dict]) -> list[dict]:
    """Identify key moments in the match: big score swings, perfect predictions, lead changes."""
    moments = []
    prev_leader = None

    for r in round_ends:
        rnd = r.get("round", 0)
        scores = r.get("scores", {})
        accuracy = r.get("accuracy", {})

        # Lead change detection
        red_s = scores.get("red", 0)
        blue_s = scores.get("blue", 0)
        leader = "red" if red_s > blue_s else ("blue" if blue_s > red_s else "tied")
        if prev_leader and leader != prev_leader and leader != "tied":
            moments.append({"round": rnd, "event": "Lead change", "impact": "high"})
        prev_leader = leader

        # Perfect prediction
        for agent in ("red", "blue"):
            if accuracy.get(agent, 0) >= 0.95:
                moments.append({"round": rnd, "event": f"{agent.capitalize()} perfect prediction", "impact": "medium"})

    return moments[-5:]  # Keep last 5 moments


def _build_agent_state(match_id: str | None, data: dict) -> dict:
    """Build the full agent state from match data."""
    if not match_id or not data:
        return {
            "strategyAnalysis": {
                "red": {"style": "unknown", "currentTactic": "waiting", "riskLevel": 0.5},
                "blue": {"style": "unknown", "currentTactic": "waiting", "riskLevel": 0.5},
            },
            "momentum": {"leader": "none", "confidence": 0.5, "reason": "No active match"},
            "predictionTrends": {"red": [], "blue": []},
            "keyMoments": [],
            "currentInsight": "No match data available. Start a match to see analysis!",
            "matchProgress": {"round": 0, "totalRounds": 0, "phase": "idle"},
        }

    config = data.get("config", {})
    events = data.get("events", [])
    round_ends = _get_round_ends(events)
    match_end = _get_match_end(events)

    red_personality = config.get("red_personality", "aggressive")
    blue_personality = config.get("blue_personality", "defensive")
    total_rounds = config.get("total_rounds", 10)
    current_round = round_ends[-1].get("round", 0) if round_ends else 0

    phase = "completed" if match_end else ("thinking" if data.get("state") == "running" else "idle")

    return {
        "strategyAnalysis": {
            "red": {
                "style": _infer_style(red_personality),
                "currentTactic": _infer_tactic(red_personality, round_ends, "red"),
                "riskLevel": _compute_risk_level(red_personality, round_ends, "red"),
            },
            "blue": {
                "style": _infer_style(blue_personality),
                "currentTactic": _infer_tactic(blue_personality, round_ends, "blue"),
                "riskLevel": _compute_risk_level(blue_personality, round_ends, "blue"),
            },
        },
        "momentum": _determine_momentum(round_ends),
        "predictionTrends": {
            "red": _compute_prediction_trends(round_ends, "red"),
            "blue": _compute_prediction_trends(round_ends, "blue"),
        },
        "keyMoments": _find_key_moments(round_ends),
        "currentInsight": "",
        "matchProgress": {
            "round": current_round,
            "totalRounds": total_rounds,
            "phase": phase,
        },
    }


# ---------------------------------------------------------------------------
# Commentary generation
# ---------------------------------------------------------------------------

def _build_commentary_prompt(user_message: str, agent_state: dict) -> str:
    """Build a prompt for the arena commentator."""
    state_desc = json.dumps(agent_state, indent=2, default=str)
    return (
        "You are the Arena Commentator for Agent Colosseum, an AI-vs-AI battle arena. "
        "Your job is to provide exciting, insightful commentary about the matches. "
        "Be dramatic but accurate. Reference specific scores, strategies, and predictions.\n\n"
        f"Current analysis state:\n{state_desc}\n\n"
        f"User asks: {user_message}\n\n"
        "Provide your commentary:"
    )


def _generate_mock_commentary(user_message: str, agent_state: dict) -> str:
    """Generate commentary without Bedrock (mock mode)."""
    progress = agent_state.get("matchProgress", {})
    phase = progress.get("phase", "idle")
    momentum = agent_state.get("momentum", {})
    strategy = agent_state.get("strategyAnalysis", {})

    if phase == "idle":
        return (
            "Welcome to Agent Colosseum! No match is currently active. "
            "Start a new match to see two AI agents battle it out in strategic combat. "
            "Choose your game type, set the agent personalities, and watch the sparks fly!"
        )

    current_round = progress.get("round", 0)
    total_rounds = progress.get("totalRounds", 10)
    leader = momentum.get("leader", "none")
    confidence = momentum.get("confidence", 0.5)
    red_tactic = strategy.get("red", {}).get("currentTactic", "unknown")
    blue_tactic = strategy.get("blue", {}).get("currentTactic", "unknown")

    # Check if user is asking about a specific round
    lower_msg = user_message.lower()
    if "round" in lower_msg:
        for word in lower_msg.split():
            if word.isdigit():
                round_num = int(word)
                match_id, data = _find_current_match()
                if match_id:
                    return _explain_round(match_id, round_num, data)

    # Check if user is asking for analysis
    if any(kw in lower_msg for kw in ("performance", "analyze", "analysis", "stats", "summary")):
        match_id, data = _find_current_match()
        if match_id:
            return _analyze_performance(match_id, data)

    if phase == "completed":
        return (
            f"What a match! After {total_rounds} rounds of intense combat, "
            f"the dust has settled. {leader.upper() if leader != 'tied' else 'Neither agent'} "
            f"claimed victory with {confidence:.0%} dominance in the final stretch. "
            f"Red deployed {red_tactic} while Blue countered with {blue_tactic}. "
            "What a display of strategic AI combat!"
        )

    # Match is running
    return (
        f"We're live -- round {current_round} of {total_rounds}! "
        f"{'The ' + leader.upper() + ' agent has momentum' if leader not in ('none', 'tied') else 'The agents are locked in a dead heat'} "
        f"({confidence:.0%} confidence). "
        f"Red is running {red_tactic} against Blue's {blue_tactic}. "
        "The tension is electric! Stay tuned for more action!"
    )


def _explain_round(match_id: str, round_number: int, data: dict | None = None) -> str:
    """Generate explanation for a specific round."""
    if data is None:
        data = _match_store.get(match_id)
    if not data:
        return f"Match {match_id} not found."

    events = data.get("events", [])
    round_end = None
    for e in events:
        if e.get("type") == "round_end" and e.get("round") == round_number:
            round_end = e

    if not round_end:
        return f"Round {round_number} data not available."

    scores = round_end.get("scores", {})
    accuracy = round_end.get("accuracy", {})

    explanation = f"Round {round_number}: "
    explanation += f"Red scored {scores.get('red', 0)}, Blue scored {scores.get('blue', 0)}. "
    explanation += f"Prediction accuracy - Red: {accuracy.get('red', 0):.0%}, Blue: {accuracy.get('blue', 0):.0%}."
    return explanation


def _analyze_performance(match_id: str, data: dict | None = None) -> str:
    """Analyze overall match performance."""
    if data is None:
        data = _match_store.get(match_id)
    if not data:
        return f"Match {match_id} not found."

    events = data.get("events", [])
    match_end = _get_match_end(events)

    if not match_end:
        round_ends = _get_round_ends(events)
        if not round_ends:
            return "Match has not started yet."
        latest = round_ends[-1]
        scores = latest.get("scores", {})
        return (
            f"Match in progress. After {latest.get('round', 0)} rounds: "
            f"Red {scores.get('red', 0)} - Blue {scores.get('blue', 0)}."
        )

    winner = match_end.get("winner", "draw")
    scores = match_end.get("finalScores", {})
    accuracy = match_end.get("predictionAccuracy", {})
    futures = match_end.get("totalFuturesSimulated", 0)

    analysis = f"Match complete. Winner: {winner.upper()}. "
    analysis += f"Final scores: Red {scores.get('red', 0)} - Blue {scores.get('blue', 0)}. "
    analysis += f"Prediction accuracy: Red {accuracy.get('red', 0):.0%}, Blue {accuracy.get('blue', 0):.0%}. "
    analysis += f"Total futures simulated: {futures}."
    return analysis


def _generate_bedrock_commentary(user_message: str, agent_state: dict) -> str:
    """Generate commentary using AWS Bedrock."""
    try:
        import boto3
        client = boto3.client("bedrock-runtime", region_name=os.getenv("AWS_REGION", "us-east-1"))
        prompt = _build_commentary_prompt(user_message, agent_state)
        response = client.invoke_model(
            modelId=os.getenv("BEDROCK_MODEL_ID", "anthropic.claude-3-haiku-20240307-v1:0"),
            contentType="application/json",
            accept="application/json",
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 512,
                "messages": [{"role": "user", "content": prompt}],
            }),
        )
        result = json.loads(response["body"].read())
        return result.get("content", [{}])[0].get("text", "No commentary generated.")
    except Exception as e:
        logger.warning("Bedrock call failed, falling back to mock: %s", e)
        return _generate_mock_commentary(user_message, agent_state)


def _extract_user_message(messages: list) -> str:
    """Pull the latest user message from the AG-UI messages list."""
    if messages:
        for msg in reversed(messages):
            role = getattr(msg, "role", None) or (msg.get("role") if isinstance(msg, dict) else None)
            if role == "user":
                content = getattr(msg, "content", None) or (msg.get("content") if isinstance(msg, dict) else None)
                if content:
                    return content if isinstance(content, str) else str(content)
    return "What's happening in the match?"


def _generate_commentary(user_message: str, agent_state: dict) -> str:
    """Generate commentary using Bedrock or mock mode."""
    mock_mode = os.getenv("MOCK_MODE", "true").lower() == "true"
    if mock_mode:
        return _generate_mock_commentary(user_message, agent_state)
    return _generate_bedrock_commentary(user_message, agent_state)


def _chunk_text(text: str, chunk_size: int = 20) -> list[str]:
    """Split text into word-based chunks for streaming."""
    words = text.split()
    chunks = []
    for i in range(0, len(words), chunk_size):
        chunk = " ".join(words[i : i + chunk_size])
        if i > 0:
            chunk = " " + chunk
        chunks.append(chunk)
    return chunks if chunks else [text]


def _build_insight_card(agent_state: dict) -> dict | None:
    """Build an insight card payload from the current state, or None if nothing interesting."""
    momentum = agent_state.get("momentum", {})
    key_moments = agent_state.get("keyMoments", [])
    strategy = agent_state.get("strategyAnalysis", {})
    progress = agent_state.get("matchProgress", {})

    if progress.get("phase") == "idle":
        return None

    # Pick the most interesting insight to surface
    leader = momentum.get("leader", "none")
    confidence = momentum.get("confidence", 0.5)

    if key_moments:
        latest_moment = key_moments[-1]
        return {
            "title": latest_moment["event"],
            "content": (
                f"Round {latest_moment['round']}: {latest_moment['event']}. "
                f"{'Momentum now with ' + leader.upper() if leader not in ('none', 'tied') else 'Match is evenly contested'} "
                f"({confidence:.0%} confidence)."
            ),
            "severity": latest_moment.get("impact", "medium"),
        }

    # Fallback: strategy comparison insight
    red_risk = strategy.get("red", {}).get("riskLevel", 0.5)
    blue_risk = strategy.get("blue", {}).get("riskLevel", 0.5)
    risk_diff = abs(red_risk - blue_risk)

    if risk_diff > 0.3:
        higher = "Red" if red_risk > blue_risk else "Blue"
        return {
            "title": "Risk Divergence Detected",
            "content": f"{higher} is playing significantly more aggressively (risk gap: {risk_diff:.0%}). This could lead to a decisive swing.",
            "severity": "high" if risk_diff > 0.5 else "medium",
        }

    return {
        "title": "Match Analysis",
        "content": f"Round {progress.get('round', 0)} of {progress.get('totalRounds', 10)}. Both agents are executing their strategies.",
        "severity": "low",
    }


# ---------------------------------------------------------------------------
# AG-UI streaming endpoint
# ---------------------------------------------------------------------------

@router.post("/agent")
async def agent_endpoint(input_data: RunAgentInput, request: Request):
    """AG-UI protocol endpoint -- streams analysis with state, deltas, and tool calls."""
    accept = request.headers.get("accept", "")
    encoder = EventEncoder(accept=accept)

    async def event_generator():
        run_id = input_data.run_id or str(uuid.uuid4())
        thread_id = input_data.thread_id or str(uuid.uuid4())

        try:
            # 1. RUN_STARTED
            yield encoder.encode(RunStartedEvent(
                type=EventType.RUN_STARTED,
                thread_id=thread_id,
                run_id=run_id,
            ))

            # 2. Build agent state from match data
            match_id, match_data = _find_current_match()
            agent_state = _build_agent_state(match_id, match_data)

            # 3. STATE_SNAPSHOT -- full state at the start
            yield encoder.encode(StateSnapshotEvent(
                type=EventType.STATE_SNAPSHOT,
                snapshot=agent_state,
            ))
            await asyncio.sleep(0.05)

            # 4. STATE_DELTA -- update strategyAnalysis (simulate deeper analysis)
            user_message = _extract_user_message(
                input_data.messages if input_data.messages else []
            )

            # Simulate refining the strategy analysis
            refined_red_tactic = agent_state["strategyAnalysis"]["red"]["currentTactic"]
            refined_blue_tactic = agent_state["strategyAnalysis"]["blue"]["currentTactic"]
            if agent_state["matchProgress"]["phase"] not in ("idle",):
                # Refine tactics based on momentum
                leader = agent_state["momentum"].get("leader", "none")
                if leader == "red":
                    refined_red_tactic = "pressing advantage"
                    refined_blue_tactic = "defensive regrouping"
                elif leader == "blue":
                    refined_red_tactic = "desperate recovery"
                    refined_blue_tactic = "pressing advantage"

            yield encoder.encode(StateDeltaEvent(
                type=EventType.STATE_DELTA,
                delta=[
                    {"op": "replace", "path": "/strategyAnalysis/red/currentTactic", "value": refined_red_tactic},
                    {"op": "replace", "path": "/strategyAnalysis/blue/currentTactic", "value": refined_blue_tactic},
                ],
            ))
            await asyncio.sleep(0.1)

            # 5. STATE_DELTA -- update momentum with refined analysis
            momentum = agent_state["momentum"]
            yield encoder.encode(StateDeltaEvent(
                type=EventType.STATE_DELTA,
                delta=[
                    {"op": "replace", "path": "/momentum/confidence", "value": min(1.0, momentum["confidence"] + 0.05)},
                ],
            ))
            await asyncio.sleep(0.05)

            # 6. Generate commentary text
            # Update agent state with refinements before generating commentary
            agent_state["strategyAnalysis"]["red"]["currentTactic"] = refined_red_tactic
            agent_state["strategyAnalysis"]["blue"]["currentTactic"] = refined_blue_tactic
            commentary = _generate_commentary(user_message, agent_state)

            # Update currentInsight in state
            yield encoder.encode(StateDeltaEvent(
                type=EventType.STATE_DELTA,
                delta=[
                    {"op": "replace", "path": "/currentInsight", "value": commentary[:120]},
                ],
            ))
            await asyncio.sleep(0.05)

            # 7. TEXT_MESSAGE_START
            message_id = str(uuid.uuid4())
            yield encoder.encode(TextMessageStartEvent(
                type=EventType.TEXT_MESSAGE_START,
                message_id=message_id,
                role="assistant",
            ))

            # 8. TEXT_MESSAGE_CONTENT -- stream in chunks
            for chunk in _chunk_text(commentary, 12):
                yield encoder.encode(TextMessageContentEvent(
                    type=EventType.TEXT_MESSAGE_CONTENT,
                    message_id=message_id,
                    delta=chunk,
                ))
                await asyncio.sleep(0.03)

            # 9. TEXT_MESSAGE_END
            yield encoder.encode(TextMessageEndEvent(
                type=EventType.TEXT_MESSAGE_END,
                message_id=message_id,
            ))
            await asyncio.sleep(0.05)

            # 10. TOOL_CALL -- showInsightCard (if there is an insight to show)
            insight = _build_insight_card(agent_state)
            if insight:
                tool_call_id = f"tc_{uuid.uuid4().hex[:8]}"
                yield encoder.encode(ToolCallStartEvent(
                    type=EventType.TOOL_CALL_START,
                    tool_call_id=tool_call_id,
                    tool_call_name="showInsightCard",
                ))
                yield encoder.encode(ToolCallArgsEvent(
                    type=EventType.TOOL_CALL_ARGS,
                    tool_call_id=tool_call_id,
                    delta=json.dumps(insight),
                ))
                yield encoder.encode(ToolCallEndEvent(
                    type=EventType.TOOL_CALL_END,
                    tool_call_id=tool_call_id,
                ))
                await asyncio.sleep(0.05)

            # 11. STATE_DELTA -- update keyMoments with the latest insight
            if insight:
                new_moment = {
                    "round": agent_state["matchProgress"].get("round", 0),
                    "event": insight["title"],
                    "impact": insight["severity"],
                }
                current_moments = agent_state.get("keyMoments", [])
                updated_moments = current_moments + [new_moment]
                yield encoder.encode(StateDeltaEvent(
                    type=EventType.STATE_DELTA,
                    delta=[
                        {"op": "replace", "path": "/keyMoments", "value": updated_moments},
                    ],
                ))
                await asyncio.sleep(0.05)

            # 12. RUN_FINISHED
            yield encoder.encode(RunFinishedEvent(
                type=EventType.RUN_FINISHED,
                thread_id=thread_id,
                run_id=run_id,
            ))

        except Exception as e:
            logger.error("AG-UI agent error: %s", e, exc_info=True)
            yield encoder.encode(RunErrorEvent(
                type=EventType.RUN_ERROR,
                message=str(e),
                code="INTERNAL_ERROR",
            ))

    return StreamingResponse(
        event_generator(),
        media_type=encoder.get_content_type(),
    )
