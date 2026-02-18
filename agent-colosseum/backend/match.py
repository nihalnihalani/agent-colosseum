"""Match orchestration — runs a complete match and yields WebSocket events."""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, AsyncGenerator, Optional

from backend.agent import AgentPredictor, PredictionResult
from backend.game_engine import (
    GameState,
    Move,
    RoundResolution,
    default_move,
    get_winner,
    is_game_over,
    resolve_round,
)
from backend import negotiation_engine
from backend import auction_engine

logger = logging.getLogger(__name__)


@dataclass
class MatchConfig:
    match_id: str = ""
    game_type: str = "resource_wars"
    red_personality: str = "aggressive"
    blue_personality: str = "defensive"
    total_rounds: int = 10
    round_delay: float = 0.5  # seconds between rounds

    def __post_init__(self):
        if not self.match_id:
            self.match_id = f"match_{uuid.uuid4().hex[:8]}"


@dataclass
class Match:
    """Runs a complete match between two agents."""

    config: MatchConfig
    game_state: Any = field(default=None)  # GameState | NegotiationState | AuctionState
    red_agent: AgentPredictor = field(default=None)
    blue_agent: AgentPredictor = field(default=None)
    red_history: list[dict] = field(default_factory=list)
    blue_history: list[dict] = field(default_factory=list)
    total_futures_simulated: int = 0
    red_correct: int = 0
    blue_correct: int = 0
    red_total_predictions: int = 0
    blue_total_predictions: int = 0
    _neo4j_client: Any = None
    _mongodb_client: Any = None
    _metrics: Any = None

    def __post_init__(self):
        gt = self.config.game_type
        if self.game_state is None:
            if gt == "negotiation":
                self.game_state = negotiation_engine.NegotiationState(
                    total_rounds=self.config.total_rounds,
                )
            elif gt == "auction":
                self.game_state = auction_engine.AuctionState(
                    total_rounds=min(self.config.total_rounds, auction_engine.TOTAL_ITEMS),
                )
            else:
                self.game_state = GameState(total_rounds=self.config.total_rounds)
        if self.red_agent is None:
            self.red_agent = AgentPredictor("red", self.config.red_personality, game_type=gt)
        if self.blue_agent is None:
            self.blue_agent = AgentPredictor("blue", self.config.blue_personality, game_type=gt)

        # Lazy-load optional integrations
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

    async def run_match(self) -> AsyncGenerator[dict, None]:
        """Run the complete match, yielding WebSocket-ready event dicts."""

        # --- match_start ---
        match_start_event = {
            "type": "match_start",
            "matchId": self.config.match_id,
            "gameType": self.config.game_type,
            "agents": {
                "red": {"personality": self.config.red_personality},
                "blue": {"personality": self.config.blue_personality},
            },
            "totalRounds": self.config.total_rounds,
        }

        # Initialize match document in MongoDB
        if self._mongodb_client:
            try:
                from datetime import datetime, timezone
                self._mongodb_client.store_match({
                    "match_id": self.config.match_id,
                    "game_type": self.config.game_type,
                    "agents": {
                        "red": {"personality": self.config.red_personality, "model": "mock"},
                        "blue": {"personality": self.config.blue_personality, "model": "mock"},
                    },
                    "total_rounds": self.config.total_rounds,
                    "started_at": datetime.now(timezone.utc).isoformat(),
                    "state": "running",
                    "rounds": [],
                })
            except Exception as e:
                logger.warning("MongoDB match init failed: %s", e)

        yield match_start_event

        while not self._is_game_over():
            async for event in self._run_round():
                yield event

            self.game_state.round_number += 1
            await asyncio.sleep(self.config.round_delay)

        # --- match_end ---
        winner = self._get_winner()
        red_accuracy = (
            self.red_correct / self.red_total_predictions
            if self.red_total_predictions > 0
            else 0.0
        )
        blue_accuracy = (
            self.blue_correct / self.blue_total_predictions
            if self.blue_total_predictions > 0
            else 0.0
        )

        match_end_event = {
            "type": "match_end",
            "winner": winner,
            "finalScores": dict(self.game_state.scores),
            "totalFuturesSimulated": self.total_futures_simulated,
            "predictionAccuracy": {
                "red": round(red_accuracy, 2),
                "blue": round(blue_accuracy, 2),
            },
        }

        if self._metrics:
            self._metrics.log_match_result(
                winner,
                self.config.total_rounds,
                abs(self.game_state.scores["red"] - self.game_state.scores["blue"]),
            )

        # Finalize match in MongoDB
        if self._mongodb_client:
            try:
                self._mongodb_client.finalize_match(self.config.match_id, match_end_event)
            except Exception as e:
                logger.warning("MongoDB match finalize failed: %s", e)

        yield match_end_event

    def _is_game_over(self) -> bool:
        gt = self.config.game_type
        if gt == "negotiation":
            return negotiation_engine.is_game_over(self.game_state)
        elif gt == "auction":
            return auction_engine.is_game_over(self.game_state)
        return is_game_over(self.game_state)

    def _get_winner(self) -> str:
        gt = self.config.game_type
        if gt == "negotiation":
            return negotiation_engine.get_winner(self.game_state)
        elif gt == "auction":
            return auction_engine.get_winner(self.game_state)
        return get_winner(self.game_state)

    def _default_move(self):
        gt = self.config.game_type
        if gt == "negotiation":
            return negotiation_engine.default_move()
        elif gt == "auction":
            return auction_engine.default_move()
        return default_move()

    def _resolve_round(self, red_move, blue_move):
        gt = self.config.game_type
        if gt == "negotiation":
            return negotiation_engine.resolve_round(red_move, blue_move, self.game_state)
        elif gt == "auction":
            return auction_engine.resolve_round(red_move, blue_move, self.game_state)
        return resolve_round(red_move, blue_move, self.game_state)

    async def _run_round(self) -> AsyncGenerator[dict, None]:
        """Run a single round of the match."""
        round_num = self.game_state.round_number
        round_start_time = time.time()

        # --- round_start ---
        round_start_event = {
            "type": "round_start",
            "round": round_num,
            "gameState": self.game_state.to_dict(),
        }
        if self.config.game_type == "negotiation":
            round_start_event["negotiationState"] = self.game_state.to_dict()
        elif self.config.game_type == "auction":
            round_start_event["auctionState"] = self.game_state.to_dict()
        yield round_start_event

        # --- thinking phase (parallel) ---
        yield {"type": "thinking_start", "agent": "red"}
        yield {"type": "thinking_start", "agent": "blue"}

        # Run both agents in parallel
        red_task = asyncio.create_task(
            self._get_prediction("red")
        )
        blue_task = asyncio.create_task(
            self._get_prediction("blue")
        )

        red_result, blue_result = await asyncio.gather(red_task, blue_task)

        # --- Stream predictions as events ---
        for i, pred in enumerate(red_result.predictions):
            yield {
                "type": "prediction",
                "agent": "red",
                "branchIndex": i,
                "prediction": pred,
            }
        for i, pred in enumerate(blue_result.predictions):
            yield {
                "type": "prediction",
                "agent": "blue",
                "branchIndex": i,
                "prediction": pred,
            }

        self.total_futures_simulated += len(red_result.predictions) + len(blue_result.predictions)

        # --- thinking_end ---
        yield {
            "type": "thinking_end",
            "agent": "red",
            "predictions": red_result.predictions,
            "chosenMove": red_result.chosen_move.to_dict() if red_result.chosen_move else None,
        }
        yield {
            "type": "thinking_end",
            "agent": "blue",
            "predictions": blue_result.predictions,
            "chosenMove": blue_result.chosen_move.to_dict() if blue_result.chosen_move else None,
        }

        # --- Resolve the round ---
        red_move = red_result.chosen_move or self._default_move()
        blue_move = blue_result.chosen_move or self._default_move()

        state_before = self.game_state.copy()
        resolution = self._resolve_round(red_move, blue_move)

        # --- Check prediction accuracy ---
        red_preds_annotated = self._annotate_predictions(
            red_result.predictions, blue_move, "red"
        )
        blue_preds_annotated = self._annotate_predictions(
            blue_result.predictions, red_move, "blue"
        )

        # --- collapse event ---
        yield {
            "type": "collapse",
            "redPredictions": red_preds_annotated,
            "bluePredictions": blue_preds_annotated,
            "resolution": resolution.to_dict(),
        }

        # Store move history
        self.red_history.append(red_move.to_dict())
        self.blue_history.append(blue_move.to_dict())

        # Calculate accuracy for this round
        red_round_correct = sum(1 for p in red_preds_annotated if p.get("wasCorrect"))
        blue_round_correct = sum(1 for p in blue_preds_annotated if p.get("wasCorrect"))
        red_round_accuracy = (
            red_round_correct / len(red_preds_annotated) if red_preds_annotated else 0.0
        )
        blue_round_accuracy = (
            blue_round_correct / len(blue_preds_annotated) if blue_preds_annotated else 0.0
        )

        # --- round_end ---
        round_end_event = {
            "type": "round_end",
            "round": round_num,
            "scores": dict(self.game_state.scores),
            "accuracy": {
                "red": round(red_round_accuracy, 2),
                "blue": round(blue_round_accuracy, 2),
            },
            "gameState": self.game_state.to_dict(),
        }
        if self.config.game_type == "negotiation":
            round_end_event["negotiationState"] = self.game_state.to_dict()
        elif self.config.game_type == "auction":
            round_end_event["auctionState"] = self.game_state.to_dict()
        yield round_end_event

        # --- Metrics ---
        round_latency = time.time() - round_start_time
        if self._metrics:
            self._metrics.log_round_latency_value("red", round_latency)
            self._metrics.log_round_latency_value("blue", round_latency)

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

        # --- MongoDB round storage ---
        if self._mongodb_client:
            try:
                self._mongodb_client.store_round(
                    match_id=self.config.match_id,
                    round_data={
                        "round": round_num,
                        "game_state": state_before.to_dict(),
                        "red": {
                            "predictions": red_preds_annotated,
                            "chosen_move": red_move.to_dict(),
                        },
                        "blue": {
                            "predictions": blue_preds_annotated,
                            "chosen_move": blue_move.to_dict(),
                        },
                        "resolution": resolution.to_dict(),
                    },
                )
            except Exception as e:
                logger.warning("MongoDB round storage failed: %s", e)

    async def _get_prediction(self, agent: str) -> PredictionResult:
        """Get prediction from an agent with error handling."""
        try:
            if agent == "red":
                return await self.red_agent.predict_opponent(
                    self.game_state, self.blue_history, self.red_history
                )
            else:
                return await self.blue_agent.predict_opponent(
                    self.game_state, self.red_history, self.blue_history
                )
        except Exception as e:
            logger.error("Agent %s prediction failed: %s", agent, e)
            return PredictionResult(
                predictions=[],
                chosen_move=self._default_move(),
                reasoning=f"Fallback: prediction error ({e})",
            )

    def _annotate_predictions(
        self,
        predictions: list[dict],
        actual_opponent_move,
        agent: str,
    ) -> list[dict]:
        """Annotate each prediction with wasCorrect based on the actual opponent move."""
        # Build actual_str depending on game type
        gt = self.config.game_type
        if gt == "negotiation":
            actual_str = f"{actual_opponent_move.type.value}_{actual_opponent_move.price}"
        elif gt == "auction":
            actual_str = f"{actual_opponent_move.type.value}_{actual_opponent_move.amount}"
        else:
            actual_str = f"{actual_opponent_move.type.value}_{actual_opponent_move.target.value}"
        annotated = []
        for pred in predictions:
            pred_copy = dict(pred)
            predicted_move = pred_copy.get("opponentMove", "")
            # Check if the move type matches
            was_correct = False
            partial_match = False
            if predicted_move == actual_str:
                was_correct = True
            elif actual_opponent_move.type.value in predicted_move:
                partial_match = True

            pred_copy["wasCorrect"] = was_correct
            pred_copy["partialMatch"] = partial_match
            if was_correct:
                if agent == "red":
                    self.red_correct += 1
                else:
                    self.blue_correct += 1

            if agent == "red":
                self.red_total_predictions += 1
            else:
                self.blue_total_predictions += 1

            # Log to metrics
            if self._metrics:
                confidence = pred_copy.get("confidence", 0.5)
                self._metrics.log_prediction(agent, confidence, was_correct)

            annotated.append(pred_copy)
        return annotated
