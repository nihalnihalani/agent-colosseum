"""Datadog metrics integration — DogStatsD singleton + ArenaMetrics."""

from __future__ import annotations

import logging
import os
import time
from contextlib import contextmanager
from typing import Optional

logger = logging.getLogger(__name__)


class NoOpStatsd:
    """No-op DogStatsD client when Datadog is not configured."""

    def increment(self, metric: str, value: int = 1, tags: list[str] | None = None) -> None:
        pass

    def gauge(self, metric: str, value: float, tags: list[str] | None = None) -> None:
        pass

    def histogram(self, metric: str, value: float, tags: list[str] | None = None) -> None:
        pass

    def timing(self, metric: str, value: float, tags: list[str] | None = None) -> None:
        pass

    def timed(self, metric: str, tags: list[str] | None = None):
        @contextmanager
        def _noop_ctx():
            yield
        return _noop_ctx()


_dd_instance: Optional[object] = None


def connect_datadog():
    """Connect to DogStatsD. Returns a no-op client if DD_AGENT_HOST is not set."""
    global _dd_instance
    if _dd_instance is not None:
        return _dd_instance

    host = os.getenv("DD_AGENT_HOST", "")
    if not host:
        logger.warning("DD_AGENT_HOST not set — Datadog metrics disabled, using no-op client")
        _dd_instance = NoOpStatsd()
        return _dd_instance

    try:
        from datadog import DogStatsd

        port = int(os.getenv("DD_PORT", "8125"))
        _dd_instance = DogStatsd(host=host, port=port)
        logger.info("DogStatsD connected: %s:%d", host, port)
    except Exception as e:
        logger.warning("Failed to connect DogStatsD: %s — using no-op client", e)
        _dd_instance = NoOpStatsd()

    return _dd_instance


# Singleton
dd = connect_datadog()


class ArenaMetrics:
    """All custom metrics for Agent Colosseum."""

    def __init__(self):
        self._dd = dd

    def log_prediction(self, agent: str, confidence: float, was_correct: bool) -> None:
        tags = [f"agent:{agent}"]
        self._dd.increment("arena.predictions.total", tags=tags)
        self._dd.gauge("arena.prediction.confidence", confidence, tags=tags)
        if was_correct:
            self._dd.increment("arena.predictions.correct", tags=tags)
        else:
            self._dd.increment("arena.predictions.wrong", tags=tags)

    def log_round_latency_value(self, agent: str, latency_seconds: float) -> None:
        tags = [f"agent:{agent}"]
        self._dd.timing("arena.round.latency", latency_seconds * 1000, tags=tags)

    def log_round_latency(self, agent: str):
        """Use as context manager: with metrics.log_round_latency('red'):"""
        return self._dd.timed("arena.round.latency", tags=[f"agent:{agent}"])

    def log_imagination_depth(self, agent: str, branch_count: int, max_depth: int) -> None:
        tags = [f"agent:{agent}"]
        self._dd.gauge("arena.imagination.branches", branch_count, tags=tags)
        self._dd.gauge("arena.imagination.depth", max_depth, tags=tags)

    def log_strategy_shift(self, agent: str, from_strategy: str, to_strategy: str) -> None:
        self._dd.increment(
            "arena.strategy.shifts",
            tags=[f"agent:{agent}", f"from:{from_strategy}", f"to:{to_strategy}"],
        )

    def log_match_result(self, winner: str, rounds: int, final_score_diff: float) -> None:
        self._dd.increment("arena.matches.completed")
        self._dd.gauge("arena.match.rounds", rounds)
        self._dd.gauge("arena.match.score_diff", final_score_diff, tags=[f"winner:{winner}"])

    # --- Expanded metrics ---

    def log_token_usage(
        self, agent: str, input_tokens: int, output_tokens: int, prediction_count: int = 1
    ) -> None:
        """Track LLM token consumption per prediction and total."""
        tags = [f"agent:{agent}"]
        total = input_tokens + output_tokens
        per_prediction = total / max(prediction_count, 1)
        self._dd.histogram("arena.tokens.per_prediction", per_prediction, tags=tags)
        self._dd.increment("arena.tokens.total", value=total, tags=tags)
        self._dd.gauge("arena.tokens.input", input_tokens, tags=tags)
        self._dd.gauge("arena.tokens.output", output_tokens, tags=tags)

    def log_strategy_distribution(self, agent: str, strategy: str) -> None:
        """Record which strategy was chosen for distribution tracking."""
        self._dd.increment(
            "arena.strategy.distribution",
            tags=[f"agent:{agent}", f"strategy:{strategy}"],
        )

    def log_game_type(self, game_type: str, match_id: str) -> None:
        """Track which game types are being played."""
        self._dd.increment(
            "arena.game.type",
            tags=[f"game_type:{game_type}", f"match_id:{match_id}"],
        )

    def log_confidence_calibration(
        self, agent: str, predicted_confidence: float, actual_accuracy: float
    ) -> None:
        """Measure how well confidence scores predict actual accuracy."""
        calibration_error = abs(predicted_confidence - actual_accuracy)
        self._dd.histogram(
            "arena.confidence.calibration",
            calibration_error,
            tags=[f"agent:{agent}"],
        )
        self._dd.gauge(
            "arena.confidence.predicted", predicted_confidence, tags=[f"agent:{agent}"]
        )
        self._dd.gauge(
            "arena.confidence.actual", actual_accuracy, tags=[f"agent:{agent}"]
        )

    def log_match_duration(self, match_id: str, duration_ms: float) -> None:
        """Track total match wall-clock duration in milliseconds."""
        self._dd.histogram("arena.match.duration_ms", duration_ms, tags=[f"match_id:{match_id}"])

    def log_personality_win(self, personality: str, opponent_personality: str, won: bool) -> None:
        """Track win/loss by personality matchup for personality_win_rate."""
        tags = [f"personality:{personality}", f"opponent_personality:{opponent_personality}"]
        self._dd.increment("arena.agent.personality_win_rate.total", tags=tags)
        if won:
            self._dd.increment("arena.agent.personality_win_rate.wins", tags=tags)


# Singleton metrics instance
arena_metrics = ArenaMetrics()


def setup_llmobs() -> None:
    """Initialize Datadog LLM Observability if configured."""
    api_key = os.getenv("DD_API_KEY", "")
    if not api_key:
        logger.warning("DD_API_KEY not set — LLM Observability disabled")
        return

    try:
        from ddtrace.llmobs import LLMObs

        LLMObs.enable(
            ml_app="agent-colosseum",
            integrations_enabled=True,
            agentless_enabled=True,
        )
        logger.info("Datadog LLM Observability enabled")
    except Exception as e:
        logger.warning("Failed to enable LLM Observability: %s", e)
