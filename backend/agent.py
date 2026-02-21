"""Agent prediction logic — Bedrock integration + mock mode + LLM Observability."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import random
import time
from contextlib import contextmanager, nullcontext
from dataclasses import dataclass, field
from typing import Any, Optional

from backend.game_engine import GameState, Move, MoveType, Resource
from backend.negotiation_engine import (
    NegotiationMoveType,
    NegotiationMove,
    NegotiationState,
)
from backend.auction_engine import (
    AuctionMoveType,
    AuctionMove,
    AuctionState,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# LLM Observability helpers — graceful no-op when DD_API_KEY is absent
# ---------------------------------------------------------------------------

_llmobs_enabled = False
_LLMObs: Any = None

try:
    if os.getenv("DD_API_KEY"):
        from ddtrace.llmobs import LLMObs as _LLMObsImport
        _LLMObs = _LLMObsImport
        _llmobs_enabled = True
except Exception:
    pass


@contextmanager
def _llmobs_prediction_span(agent_name: str, personality: str, game_state_dict: dict):
    """Wrap a prediction call in an LLMObs workflow span, or no-op."""
    if not _llmobs_enabled:
        yield None
        return

    with _LLMObs.workflow("opponent_prediction") as span:
        try:
            _LLMObs.annotate(
                tags={
                    "agent": agent_name,
                    "personality": personality,
                    "round": str(game_state_dict.get("round_number", 0)),
                    "total_rounds": str(game_state_dict.get("total_rounds", 0)),
                },
                metrics={
                    "round_number": game_state_dict.get("round_number", 0),
                    "agent_score": game_state_dict.get("scores", {}).get(agent_name, 0),
                },
            )
        except Exception as e:
            logger.debug("LLMObs annotation failed: %s", e)
        yield span


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

    No-ops silently when LLMObs is disabled, span_context is None (e.g. mock
    mode where PredictionResult.llmobs_span is never populated), or actual_move
    is empty.
    """
    if not _llmobs_enabled or span_context is None or not actual_move:
        return

    try:
        for i, pred in enumerate(predictions):
            predicted = pred.get("opponentMove", "")
            # Compare move type only — predictions use "aggressive_bid" while
            # actual moves include target suffix like "aggressive_bid_A"
            predicted_type = predicted.split("_")[0] if "_" in predicted else predicted
            actual_type = actual_move.split("_")[0] if "_" in actual_move else actual_move
            was_correct = predicted == actual_move or predicted_type == actual_type
            _LLMObs.submit_evaluation(
                span_context=span_context,
                label=f"prediction_{i}_accuracy",
                metric_type="score",
                value=1.0 if was_correct else 0.0,
                tags={
                    "agent": agent_name,
                    "predicted_move": predicted,
                    "actual_move": actual_move,
                    "confidence": str(pred.get("confidence", 0.0)),
                },
            )
    except Exception as e:
        logger.debug("LLMObs evaluation submit failed: %s", e)


# ---------------------------------------------------------------------------
# Personality configurations
# ---------------------------------------------------------------------------

AGENT_PERSONALITIES: dict[str, dict[str, Any]] = {
    "aggressive": {
        "description": "Favors high-risk, high-reward moves. Bluffs often.",
        "temperature": 0.9,
        "risk_tolerance": 0.8,
        "bluff_frequency": 0.3,
        "system_prompt_modifier": "You are an aggressive competitor who takes bold risks.",
        "move_weights": {
            MoveType.AGGRESSIVE_BID: 0.45,
            MoveType.DEFENSIVE_SPREAD: 0.10,
            MoveType.BLUFF: 0.25,
            MoveType.COUNTER: 0.10,
            MoveType.RETREAT: 0.10,
        },
    },
    "defensive": {
        "description": "Conservative, methodical. Waits for opponent mistakes.",
        "temperature": 0.3,
        "risk_tolerance": 0.3,
        "bluff_frequency": 0.05,
        "system_prompt_modifier": "You are a cautious, defensive player who exploits mistakes.",
        "move_weights": {
            MoveType.AGGRESSIVE_BID: 0.10,
            MoveType.DEFENSIVE_SPREAD: 0.40,
            MoveType.BLUFF: 0.05,
            MoveType.COUNTER: 0.35,
            MoveType.RETREAT: 0.10,
        },
    },
    "adaptive": {
        "description": "Mirrors opponent's style. Adapts based on memory.",
        "temperature": 0.6,
        "risk_tolerance": 0.5,
        "bluff_frequency": 0.15,
        "system_prompt_modifier": "You adapt your strategy based on what's working.",
        "move_weights": {
            MoveType.AGGRESSIVE_BID: 0.25,
            MoveType.DEFENSIVE_SPREAD: 0.25,
            MoveType.BLUFF: 0.15,
            MoveType.COUNTER: 0.25,
            MoveType.RETREAT: 0.10,
        },
    },
    "chaotic": {
        "description": "Unpredictable. Maximizes opponent uncertainty.",
        "temperature": 1.0,
        "risk_tolerance": 0.6,
        "bluff_frequency": 0.4,
        "system_prompt_modifier": "You are deliberately unpredictable to confuse opponents.",
        "move_weights": {
            MoveType.AGGRESSIVE_BID: 0.20,
            MoveType.DEFENSIVE_SPREAD: 0.15,
            MoveType.BLUFF: 0.30,
            MoveType.COUNTER: 0.15,
            MoveType.RETREAT: 0.20,
        },
    },
}


def _build_intelligence_block(context: dict) -> str:
    """Format Neo4j patterns and accuracy into a prompt block. Returns '' if empty."""
    lines = []
    patterns = context.get("counter_patterns") or []
    accuracy = context.get("recent_accuracy")

    if patterns:
        lines.append("\n[INTELLIGENCE CONTEXT]")
        lines.append("Counter-strategy patterns from historical matches:")
        for p in patterns[:3]:
            lines.append(f"  - {p}")

    if accuracy is not None:
        if not lines:
            lines.append("\n[INTELLIGENCE CONTEXT]")
        lines.append(f"Your recent prediction accuracy: {accuracy}%")

    return "\n".join(lines)


def _build_system_prompt(
    agent_name: str,
    personality: str,
    game_state: GameState,
    my_history: list[dict],
    opponent_history: list[dict],
    intelligence_context: dict | None = None,
) -> str:
    config = AGENT_PERSONALITIES.get(personality, AGENT_PERSONALITIES["adaptive"])
    intel_block = _build_intelligence_block(intelligence_context or {})
    base = f"""You are {agent_name}, a competitor in Agent Colosseum.

GAME: resource_wars
YOUR PERSONALITY: {config['description']}
{config['system_prompt_modifier']}
CURRENT ROUND: {game_state.round_number}/{game_state.total_rounds}
CURRENT SCORE: You: {game_state.scores.get(agent_name, 0)} | Opponent: {game_state.scores.get('blue' if agent_name == 'red' else 'red', 0)}

GAME STATE:
{json.dumps(game_state.to_dict())}

YOUR MOVE HISTORY:
{json.dumps(my_history[-5:])}

OPPONENT'S MOVE HISTORY:
{json.dumps(opponent_history[-5:])}

VALID MOVE TYPES: aggressive_bid, defensive_spread, bluff, counter, retreat
VALID RESOURCES: A, B, C
AMOUNT: integer between 20 and 100

TASK: Predict your opponent's 3 most likely next moves with confidence scores.
For each, plan your optimal counter-strategy.
Then choose your final move.

Return ONLY valid JSON:
{{
  "predictions": [
    {{
      "opponentMove": "<move_type>_<resource>",
      "confidence": <0.0-1.0>,
      "counter": "<move_type>_<resource>",
      "reasoning": "<short explanation>"
    }},
    {{
      "opponentMove": "<move_type>_<resource>",
      "confidence": <0.0-1.0>,
      "counter": "<move_type>_<resource>",
      "reasoning": "<short explanation>"
    }},
    {{
      "opponentMove": "<move_type>_<resource>",
      "confidence": <0.0-1.0>,
      "counter": "<move_type>_<resource>",
      "reasoning": "<short explanation>"
    }}
  ],
  "chosenMove": {{
    "type": "<move_type>",
    "target": "<resource>",
    "amount": <20-100>
  }},
  "reasoning": "<why you chose this move>"
}}"""
    return f"{base}{intel_block}" if intel_block else base


# ---------------------------------------------------------------------------
# Prediction result
# ---------------------------------------------------------------------------

@dataclass
class PredictionResult:
    predictions: list[dict] = field(default_factory=list)
    chosen_move: Optional[Move] = None
    reasoning: str = ""
    llmobs_span: Any = None  # exported span context for deferred evaluation submission

    def to_dict(self) -> dict:
        return {
            "predictions": self.predictions,
            "chosenMove": self.chosen_move.to_dict() if self.chosen_move else None,
            "reasoning": self.reasoning,
        }


# ---------------------------------------------------------------------------
# Mock prediction engine — produces realistic-feeling results
# ---------------------------------------------------------------------------

def _weighted_choice(weights: dict[MoveType, float]) -> MoveType:
    types = list(weights.keys())
    probs = list(weights.values())
    return random.choices(types, weights=probs, k=1)[0]


def _pick_resource(game_state: GameState, personality: str) -> Resource:
    """Pick a resource — aggressive agents target the richest, defensive protect the most valuable."""
    resources = game_state.resources
    config = AGENT_PERSONALITIES.get(personality, AGENT_PERSONALITIES["adaptive"])
    if config["risk_tolerance"] > 0.5:
        target = max(resources, key=resources.get)
    elif config["risk_tolerance"] < 0.4:
        target = min(resources, key=resources.get)
    else:
        target = random.choice(list(Resource)).value
    return Resource(target)


def _generate_mock_predictions(
    agent_name: str,
    personality: str,
    game_state: GameState,
    opponent_history: list[dict],
    my_history: list[dict],
) -> PredictionResult:
    """Generate realistic mock predictions based on personality and game state."""
    config = AGENT_PERSONALITIES.get(personality, AGENT_PERSONALITIES["adaptive"])
    weights = config["move_weights"]

    # Determine what we think the opponent will do (influenced by their history)
    opponent_personality_guess = "adaptive"
    if opponent_history:
        last_moves = [h.get("type", "") for h in opponent_history[-3:]]
        aggressive_count = sum(1 for m in last_moves if "aggressive" in m)
        defensive_count = sum(1 for m in last_moves if "defensive" in m or "counter" in m)
        if aggressive_count > defensive_count:
            opponent_personality_guess = "aggressive"
        elif defensive_count > aggressive_count:
            opponent_personality_guess = "defensive"

    opponent_weights = AGENT_PERSONALITIES.get(
        opponent_personality_guess, AGENT_PERSONALITIES["adaptive"]
    )["move_weights"]

    predictions = []
    for i in range(3):
        predicted_move_type = _weighted_choice(opponent_weights)
        predicted_resource = _pick_resource(game_state, opponent_personality_guess)

        # Confidence decreases for each subsequent prediction
        if i == 0:
            conf = round(random.uniform(0.45, 0.70), 2)
        elif i == 1:
            conf = round(random.uniform(0.15, 0.35), 2)
        else:
            conf = round(max(0.05, 1.0 - sum(p["confidence"] for p in predictions)), 2)

        # Pick a counter-move
        counter_type = _weighted_choice(weights)
        counter_resource = predicted_resource  # counter the same resource

        reasoning_options = [
            f"Opponent likely to {predicted_move_type.value} based on recent pattern",
            f"Historical data suggests {predicted_move_type.value} on {predicted_resource.value}",
            f"Game state favors opponent playing {predicted_move_type.value}",
            f"Based on score differential, expect {predicted_move_type.value}",
        ]

        predictions.append({
            "opponentMove": f"{predicted_move_type.value}_{predicted_resource.value}",
            "confidence": conf,
            "counter": f"{counter_type.value}_{counter_resource.value}",
            "reasoning": random.choice(reasoning_options),
        })

    # Choose our actual move
    chosen_type = _weighted_choice(weights)
    chosen_resource = _pick_resource(game_state, personality)

    # Amount influenced by personality
    base_amount = random.randint(30, 80)
    risk_factor = config["risk_tolerance"]
    amount = min(100, max(20, int(base_amount * (0.5 + risk_factor))))

    chosen_move = Move(type=chosen_type, target=chosen_resource, amount=amount)

    reasoning_pool = [
        f"Playing {chosen_type.value} on {chosen_resource.value} to maximize advantage",
        f"Given opponent's likely {predictions[0]['opponentMove']}, best counter is {chosen_type.value}",
        f"Score is {'ahead' if game_state.scores.get(agent_name, 0) > game_state.scores.get('blue' if agent_name == 'red' else 'red', 0) else 'behind'}, adjusting strategy accordingly",
        f"Round {game_state.round_number} — {'early game aggression' if game_state.round_number <= 3 else 'mid-game adaptation' if game_state.round_number <= 7 else 'end-game push'}",
    ]

    return PredictionResult(
        predictions=predictions,
        chosen_move=chosen_move,
        reasoning=random.choice(reasoning_pool),
    )


# ---------------------------------------------------------------------------
# Negotiation personality weights
# ---------------------------------------------------------------------------

NEGOTIATION_WEIGHTS: dict[str, dict[NegotiationMoveType, float]] = {
    "aggressive": {
        NegotiationMoveType.PROPOSE: 0.30,
        NegotiationMoveType.ACCEPT: 0.05,
        NegotiationMoveType.REJECT: 0.15,
        NegotiationMoveType.COUNTER_OFFER: 0.20,
        NegotiationMoveType.BLUFF_WALKAWAY: 0.30,
    },
    "defensive": {
        NegotiationMoveType.PROPOSE: 0.20,
        NegotiationMoveType.ACCEPT: 0.20,
        NegotiationMoveType.REJECT: 0.10,
        NegotiationMoveType.COUNTER_OFFER: 0.40,
        NegotiationMoveType.BLUFF_WALKAWAY: 0.10,
    },
    "adaptive": {
        NegotiationMoveType.PROPOSE: 0.25,
        NegotiationMoveType.ACCEPT: 0.15,
        NegotiationMoveType.REJECT: 0.10,
        NegotiationMoveType.COUNTER_OFFER: 0.35,
        NegotiationMoveType.BLUFF_WALKAWAY: 0.15,
    },
    "chaotic": {
        NegotiationMoveType.PROPOSE: 0.20,
        NegotiationMoveType.ACCEPT: 0.10,
        NegotiationMoveType.REJECT: 0.20,
        NegotiationMoveType.COUNTER_OFFER: 0.20,
        NegotiationMoveType.BLUFF_WALKAWAY: 0.30,
    },
}

# ---------------------------------------------------------------------------
# Auction personality weights
# ---------------------------------------------------------------------------

AUCTION_WEIGHTS: dict[str, dict[AuctionMoveType, float]] = {
    "aggressive": {
        AuctionMoveType.BID: 0.60,
        AuctionMoveType.PASS: 0.10,
        AuctionMoveType.BLUFF_BID: 0.30,
    },
    "defensive": {
        AuctionMoveType.BID: 0.50,
        AuctionMoveType.PASS: 0.35,
        AuctionMoveType.BLUFF_BID: 0.15,
    },
    "adaptive": {
        AuctionMoveType.BID: 0.55,
        AuctionMoveType.PASS: 0.25,
        AuctionMoveType.BLUFF_BID: 0.20,
    },
    "chaotic": {
        AuctionMoveType.BID: 0.40,
        AuctionMoveType.PASS: 0.20,
        AuctionMoveType.BLUFF_BID: 0.40,
    },
}


# ---------------------------------------------------------------------------
# Negotiation prompt builder
# ---------------------------------------------------------------------------

def _build_negotiation_prompt(
    agent_name: str,
    personality: str,
    game_state: NegotiationState,
    my_history: list[dict],
    opponent_history: list[dict],
    intelligence_context: dict | None = None,
) -> str:
    config = AGENT_PERSONALITIES.get(personality, AGENT_PERSONALITIES["adaptive"])
    intel_block = _build_intelligence_block(intelligence_context or {})
    role = "seller (wants HIGH price)" if agent_name == "red" else "buyer (wants LOW price)"
    base = f"""You are {agent_name}, a competitor in Agent Colosseum.

GAME: negotiation
YOUR ROLE: {role}
YOUR PERSONALITY: {config['description']}
{config['system_prompt_modifier']}
CURRENT ROUND: {game_state.round_number}/{game_state.total_rounds}
YOUR WALKAWAY PRICE: {game_state.red_walkaway if agent_name == 'red' else game_state.blue_walkaway}

GAME STATE:
{json.dumps(game_state.to_dict_for_agent(agent_name))}

YOUR MOVE HISTORY:
{json.dumps(my_history[-5:])}

OPPONENT'S MOVE HISTORY:
{json.dumps(opponent_history[-5:])}

VALID MOVE TYPES: propose, accept, reject, counter_offer, bluff_walkaway
PRICE: integer between 10 and 90

TASK: Predict your opponent's 3 most likely next moves with confidence scores.
Then choose your final move.

Return ONLY valid JSON:
{{
  "predictions": [
    {{"opponentMove": "<move_type>_<price>", "confidence": <0.0-1.0>, "counter": "<move_type>_<price>", "reasoning": "<short>"}},
    {{"opponentMove": "<move_type>_<price>", "confidence": <0.0-1.0>, "counter": "<move_type>_<price>", "reasoning": "<short>"}},
    {{"opponentMove": "<move_type>_<price>", "confidence": <0.0-1.0>, "counter": "<move_type>_<price>", "reasoning": "<short>"}}
  ],
  "chosenMove": {{
    "type": "<move_type>",
    "price": <10-90>,
    "terms": ""
  }},
  "reasoning": "<why you chose this move>"
}}"""
    return f"{base}{intel_block}" if intel_block else base


# ---------------------------------------------------------------------------
# Auction prompt builder
# ---------------------------------------------------------------------------

def _build_auction_prompt(
    agent_name: str,
    personality: str,
    game_state: AuctionState,
    my_history: list[dict],
    opponent_history: list[dict],
    intelligence_context: dict | None = None,
) -> str:
    config = AGENT_PERSONALITIES.get(personality, AGENT_PERSONALITIES["adaptive"])
    intel_block = _build_intelligence_block(intelligence_context or {})
    base = f"""You are {agent_name}, a competitor in Agent Colosseum.

GAME: auction
YOUR PERSONALITY: {config['description']}
{config['system_prompt_modifier']}
CURRENT ITEM: {game_state.round_number}/{game_state.total_rounds}
YOUR CREDITS: {game_state.credits.get(agent_name, 0)}

GAME STATE:
{json.dumps(game_state.to_dict_for_agent(agent_name))}

YOUR MOVE HISTORY:
{json.dumps(my_history[-5:])}

OPPONENT'S MOVE HISTORY:
{json.dumps(opponent_history[-5:])}

VALID MOVE TYPES: bid, pass, bluff_bid
AMOUNT: integer (your bid amount, up to your remaining credits)

TASK: Predict your opponent's 3 most likely bids with confidence scores.
Then choose your final move.

Return ONLY valid JSON:
{{
  "predictions": [
    {{"opponentMove": "<move_type>_<amount>", "confidence": <0.0-1.0>, "counter": "<move_type>_<amount>", "reasoning": "<short>"}},
    {{"opponentMove": "<move_type>_<amount>", "confidence": <0.0-1.0>, "counter": "<move_type>_<amount>", "reasoning": "<short>"}},
    {{"opponentMove": "<move_type>_<amount>", "confidence": <0.0-1.0>, "counter": "<move_type>_<amount>", "reasoning": "<short>"}}
  ],
  "chosenMove": {{
    "type": "<move_type>",
    "amount": <bid_amount>
  }},
  "reasoning": "<why you chose this move>"
}}"""
    return f"{base}{intel_block}" if intel_block else base


# ---------------------------------------------------------------------------
# Negotiation mock predictions
# ---------------------------------------------------------------------------

def _generate_negotiation_mock_predictions(
    agent_name: str,
    personality: str,
    game_state: NegotiationState,
    opponent_history: list[dict],
    my_history: list[dict],
) -> PredictionResult:
    """Generate mock predictions for the negotiation game."""
    config = AGENT_PERSONALITIES.get(personality, AGENT_PERSONALITIES["adaptive"])
    weights = NEGOTIATION_WEIGHTS.get(personality, NEGOTIATION_WEIGHTS["adaptive"])

    def _neg_weighted_choice(w: dict) -> NegotiationMoveType:
        types = list(w.keys())
        probs = list(w.values())
        return random.choices(types, weights=probs, k=1)[0]

    opp_weights = NEGOTIATION_WEIGHTS.get("adaptive")

    predictions = []
    for i in range(3):
        pred_type = _neg_weighted_choice(opp_weights)
        pred_price = random.randint(20, 80)
        if i == 0:
            conf = round(random.uniform(0.45, 0.70), 2)
        elif i == 1:
            conf = round(random.uniform(0.15, 0.35), 2)
        else:
            conf = round(max(0.05, 1.0 - sum(p["confidence"] for p in predictions)), 2)

        counter_type = _neg_weighted_choice(weights)
        counter_price = random.randint(20, 80)

        predictions.append({
            "opponentMove": f"{pred_type.value}_{pred_price}",
            "confidence": conf,
            "counter": f"{counter_type.value}_{counter_price}",
            "reasoning": random.choice([
                f"Opponent likely to {pred_type.value} around {pred_price}",
                f"Based on history, expect {pred_type.value}",
                f"Score pressure suggests {pred_type.value}",
            ]),
        })

    # Choose our move
    chosen_type = _neg_weighted_choice(weights)

    # Price strategy based on role and personality
    is_seller = agent_name == "red"
    walkaway = game_state.red_walkaway if is_seller else game_state.blue_walkaway
    risk = config["risk_tolerance"]

    if is_seller:
        # Seller wants high price
        price = walkaway + random.randint(int(10 * risk), int(40 * risk + 10))
    else:
        # Buyer wants low price
        price = walkaway - random.randint(int(10 * risk), int(40 * risk + 10))
    price = max(10, min(90, price))

    # If accepting or rejecting, price doesn't matter much
    if chosen_type in (NegotiationMoveType.ACCEPT, NegotiationMoveType.REJECT,
                       NegotiationMoveType.BLUFF_WALKAWAY):
        price = game_state.current_offer or price

    chosen_move = NegotiationMove(type=chosen_type, price=price)

    return PredictionResult(
        predictions=predictions,
        chosen_move=chosen_move,
        reasoning=random.choice([
            f"Playing {chosen_type.value} at {price} to maximize deal value",
            f"Round {game_state.round_number} strategy: {chosen_type.value}",
            f"Adjusting based on opponent's recent moves",
        ]),
    )


# ---------------------------------------------------------------------------
# Auction mock predictions
# ---------------------------------------------------------------------------

def _generate_auction_mock_predictions(
    agent_name: str,
    personality: str,
    game_state: AuctionState,
    opponent_history: list[dict],
    my_history: list[dict],
) -> PredictionResult:
    """Generate mock predictions for the auction game."""
    config = AGENT_PERSONALITIES.get(personality, AGENT_PERSONALITIES["adaptive"])
    weights = AUCTION_WEIGHTS.get(personality, AUCTION_WEIGHTS["adaptive"])

    def _auc_weighted_choice(w: dict) -> AuctionMoveType:
        types = list(w.keys())
        probs = list(w.values())
        return random.choices(types, weights=probs, k=1)[0]

    current_item = game_state.current_item()
    my_valuation = 0
    if current_item:
        my_valuation = current_item.red_valuation if agent_name == "red" else current_item.blue_valuation

    opp_weights = AUCTION_WEIGHTS.get("adaptive")

    predictions = []
    for i in range(3):
        pred_type = _auc_weighted_choice(opp_weights)
        pred_amount = random.randint(20, 200) if pred_type != AuctionMoveType.PASS else 0
        if i == 0:
            conf = round(random.uniform(0.45, 0.70), 2)
        elif i == 1:
            conf = round(random.uniform(0.15, 0.35), 2)
        else:
            conf = round(max(0.05, 1.0 - sum(p["confidence"] for p in predictions)), 2)

        counter_type = _auc_weighted_choice(weights)
        counter_amount = random.randint(20, 200) if counter_type != AuctionMoveType.PASS else 0

        predictions.append({
            "opponentMove": f"{pred_type.value}_{pred_amount}",
            "confidence": conf,
            "counter": f"{counter_type.value}_{counter_amount}",
            "reasoning": random.choice([
                f"Opponent likely to {pred_type.value} around {pred_amount}",
                f"Item value suggests opponent bids {pred_amount}",
                f"Credits remaining favor {pred_type.value}",
            ]),
        })

    # Choose our move
    chosen_type = _auc_weighted_choice(weights)
    risk = config["risk_tolerance"]
    credits_available = game_state.credits.get(agent_name, 0)

    if chosen_type == AuctionMoveType.PASS:
        amount = 0
    else:
        # Bid proportional to valuation and risk tolerance
        base_bid = int(my_valuation * (0.5 + risk * 0.5))
        amount = min(credits_available, max(10, base_bid + random.randint(-20, 30)))

    chosen_move = AuctionMove(type=chosen_type, amount=amount)

    return PredictionResult(
        predictions=predictions,
        chosen_move=chosen_move,
        reasoning=random.choice([
            f"Bidding {amount} on {current_item.name if current_item else 'item'} (valued at {my_valuation})",
            f"Round {game_state.round_number}: {chosen_type.value} strategy with {credits_available} credits left",
            f"Risk-adjusted bid based on remaining items",
        ]),
    )


# ---------------------------------------------------------------------------
# AgentPredictor — main class
# ---------------------------------------------------------------------------

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
        self.mock_mode = os.getenv("MOCK_MODE", "false").lower() == "true"
        self._bedrock_client = None
        self.neo4j_client = neo4j_client
        self.metrics = metrics

    def _get_bedrock_client(self):
        if self._bedrock_client is None:
            try:
                import boto3
                region = os.getenv("AWS_REGION", os.getenv("AWS_DEFAULT_REGION", "us-west-2"))
                self._bedrock_client = boto3.client(
                    "bedrock-runtime",
                    region_name=region,
                    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
                    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
                    aws_session_token=os.getenv("AWS_SESSION_TOKEN"),
                )
            except Exception as e:
                logger.warning("Bedrock client init failed, falling back to mock: %s", e)
                self.mock_mode = True
                return None
        return self._bedrock_client

    async def predict_opponent(
        self,
        game_state,
        opponent_history: list[dict],
        my_history: list[dict],
        opponent_personality: str = "adaptive",
    ) -> PredictionResult:
        """Predict opponent's next move and choose our response."""
        if self.mock_mode:
            return await self._predict_mock(game_state, opponent_history, my_history)
        return await self._predict_bedrock(game_state, opponent_history, my_history, opponent_personality)

    async def _predict_mock(
        self,
        game_state,
        opponent_history: list[dict],
        my_history: list[dict],
    ) -> PredictionResult:
        """Mock prediction with realistic delays to simulate Bedrock latency."""
        # Simulate thinking time (0.5 - 1.5 seconds)
        await asyncio.sleep(random.uniform(0.5, 1.5))
        if self.game_type == "negotiation":
            return _generate_negotiation_mock_predictions(
                self.agent_name, self.personality, game_state, opponent_history, my_history
            )
        elif self.game_type == "auction":
            return _generate_auction_mock_predictions(
                self.agent_name, self.personality, game_state, opponent_history, my_history
            )
        return _generate_mock_predictions(
            self.agent_name, self.personality, game_state, opponent_history, my_history
        )

    def _build_prompt(self, game_state, my_history, opponent_history, intelligence_context: dict | None = None) -> str:
        """Build the appropriate prompt based on game type."""
        if self.game_type == "negotiation":
            return _build_negotiation_prompt(
                self.agent_name, self.personality, game_state, my_history, opponent_history,
                intelligence_context=intelligence_context,
            )
        elif self.game_type == "auction":
            return _build_auction_prompt(
                self.agent_name, self.personality, game_state, my_history, opponent_history,
                intelligence_context=intelligence_context,
            )
        return _build_system_prompt(
            self.agent_name, self.personality, game_state, my_history, opponent_history,
            intelligence_context=intelligence_context,
        )

    def _parse_chosen_move(self, parsed: dict):
        """Parse a chosen move from LLM response based on game type."""
        chosen = parsed.get("chosenMove", {})
        if self.game_type == "negotiation":
            return NegotiationMove(
                type=NegotiationMoveType(chosen.get("type", "propose")),
                price=int(chosen.get("price", 50)),
                terms=chosen.get("terms", ""),
            )
        elif self.game_type == "auction":
            return AuctionMove(
                type=AuctionMoveType(chosen.get("type", "bid")),
                amount=int(chosen.get("amount", 50)),
            )
        return Move(
            type=MoveType(chosen.get("type", "defensive_spread")),
            target=Resource(chosen.get("target", "A")),
            amount=int(chosen.get("amount", 60)),
        )

    def _fallback_mock(self, game_state, opponent_history, my_history) -> PredictionResult:
        """Fall back to mock predictions on error."""
        if self.game_type == "negotiation":
            return _generate_negotiation_mock_predictions(
                self.agent_name, self.personality, game_state, opponent_history, my_history
            )
        elif self.game_type == "auction":
            return _generate_auction_mock_predictions(
                self.agent_name, self.personality, game_state, opponent_history, my_history
            )
        return _generate_mock_predictions(
            self.agent_name, self.personality, game_state, opponent_history, my_history
        )

    async def _get_neo4j_patterns(self, opponent_personality: str) -> list[str]:
        """Fetch counter-strategy patterns from Neo4j for the given opponent personality."""
        if self.neo4j_client is None:
            return []
        try:
            # Check which method exists on the client
            method = None
            if hasattr(self.neo4j_client, 'get_counter_strategies'):
                method = self.neo4j_client.get_counter_strategies
            elif hasattr(self.neo4j_client, 'get_counter_strategy'):
                method = self.neo4j_client.get_counter_strategy
            if method is None:
                return []
            patterns = await asyncio.wait_for(
                asyncio.to_thread(method, self.agent_name, opponent_personality),
                timeout=0.5,
            )
            # Normalize: patterns may be list of strings or list of dicts
            if not patterns:
                return []
            result = []
            for p in patterns:
                if isinstance(p, str):
                    result.append(p)
                elif isinstance(p, dict):
                    result.append(str(p.get('pattern') or p.get('description') or p))
            return result
        except Exception as e:
            logger.debug("Neo4j pattern fetch failed: %s", e)
            return []

    def _get_self_accuracy(self) -> Optional[dict]:
        """Return recent prediction accuracy if metrics available. Currently a stub."""
        if self.metrics is None:
            return None
        # ArenaMetrics is write-only (DogStatsD). Accuracy tracking via
        # round-level counters on AgentPredictor is a future enhancement.
        return None

    async def _fetch_intelligence_context(self, opponent_personality: str) -> dict:
        """Fetch Neo4j patterns and self accuracy. Never raises."""
        neo4j_patterns = await self._get_neo4j_patterns(opponent_personality)
        self_accuracy = self._get_self_accuracy()
        return {
            "counter_patterns": neo4j_patterns if isinstance(neo4j_patterns, list) else [],
            "recent_accuracy": self_accuracy,
        }

    async def _predict_bedrock(
        self,
        game_state,
        opponent_history: list[dict],
        my_history: list[dict],
        opponent_personality: str = "adaptive",
    ) -> PredictionResult:
        """Call Amazon Bedrock Claude for opponent prediction, wrapped with LLM Obs."""
        client = self._get_bedrock_client()
        if client is None:
            return await self._predict_mock(game_state, opponent_history, my_history)
        model_id = os.getenv("BEDROCK_MODEL_ID", "us.anthropic.claude-sonnet-4-5-20250929-v1:0")
        config = AGENT_PERSONALITIES.get(self.personality, AGENT_PERSONALITIES["adaptive"])

        intelligence_context = await self._fetch_intelligence_context(opponent_personality)
        prompt = self._build_prompt(
            game_state,
            my_history=my_history,
            opponent_history=opponent_history,
            intelligence_context=intelligence_context,
        )

        with _llmobs_prediction_span(self.agent_name, self.personality, game_state.to_dict()):
            try:
                # --- LLM span: wraps the actual Bedrock invocation ---
                llm_ctx = (
                    _LLMObs.llm(
                        model_name=model_id,
                        model_provider="bedrock",
                        name="bedrock_prediction",
                    )
                    if _llmobs_enabled
                    else nullcontext()
                )

                with llm_ctx:
                    if _llmobs_enabled:
                        try:
                            _LLMObs.annotate(
                                input_data=[{"role": "user", "content": prompt}],
                            )
                        except Exception:
                            pass

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

                    # Extract token usage from Bedrock response
                    usage = body.get("usage", {})
                    input_tokens = usage.get("input_tokens", 0)
                    output_tokens = usage.get("output_tokens", 0)

                    if _llmobs_enabled:
                        try:
                            _LLMObs.annotate(
                                output_data=[{"role": "assistant", "content": content}],
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

                # Export the active span so match.py can submit evaluations
                # after round resolution, when the actual opponent move is known.
                if _llmobs_enabled:
                    try:
                        result.llmobs_span = _LLMObs.export_span()
                    except Exception:
                        pass

                return result

            except Exception as e:
                logger.error("Bedrock prediction failed for %s: %s", self.agent_name, e)
                return self._fallback_mock(game_state, opponent_history, my_history)

    async def predict_opponent_streaming(
        self,
        game_state,
        opponent_history: list[dict],
        my_history: list[dict],
    ):
        """Stream predictions from Bedrock for real-time branch rendering."""
        if self.mock_mode:
            result = await self._predict_mock(game_state, opponent_history, my_history)
            # Yield predictions one at a time with delays to simulate streaming
            for i, pred in enumerate(result.predictions):
                await asyncio.sleep(random.uniform(0.3, 0.8))
                yield {"type": "prediction_branch", "index": i, "prediction": pred}
            yield {"type": "prediction_complete", "result": result}
            return

        client = self._get_bedrock_client()
        if client is None:
            result = await self._predict_mock(game_state, opponent_history, my_history)
            for i, pred in enumerate(result.predictions):
                await asyncio.sleep(random.uniform(0.3, 0.8))
                yield {"type": "prediction_branch", "index": i, "prediction": pred}
            yield {"type": "prediction_complete", "result": result}
            return
        model_id = os.getenv("BEDROCK_MODEL_ID", "us.anthropic.claude-sonnet-4-5-20250929-v1:0")
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
                    # message_start carries input token count
                    if chunk.get("type") == "message_start":
                        usage = chunk.get("message", {}).get("usage", {})
                        input_tokens = usage.get("input_tokens", 0)
                    # message_delta carries output token count
                    if chunk.get("type") == "message_delta":
                        usage = chunk.get("usage", {})
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

                # Annotate output + token counts on the workflow span
                if _llmobs_enabled:
                    try:
                        _LLMObs.annotate(
                            output_data=[{"role": "assistant", "content": full_text}],
                            metrics={"input_tokens": input_tokens, "output_tokens": output_tokens},
                        )
                    except Exception:
                        pass

                # Export span for deferred evaluation (same as non-streaming path)
                if _llmobs_enabled:
                    try:
                        result.llmobs_span = _LLMObs.export_span()
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

                for i, pred in enumerate(result.predictions):
                    yield {"type": "prediction_branch", "index": i, "prediction": pred}
                yield {"type": "prediction_complete", "result": result}

            except Exception as e:
                logger.error("Bedrock streaming failed for %s: %s", self.agent_name, e)
                result = self._fallback_mock(game_state, opponent_history, my_history)
                for i, pred in enumerate(result.predictions):
                    yield {"type": "prediction_branch", "index": i, "prediction": pred}
                yield {"type": "prediction_complete", "result": result}
