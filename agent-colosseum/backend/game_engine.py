"""Resource Wars game engine — rules, state, resolution."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class MoveType(str, Enum):
    AGGRESSIVE_BID = "aggressive_bid"
    DEFENSIVE_SPREAD = "defensive_spread"
    BLUFF = "bluff"
    COUNTER = "counter"
    RETREAT = "retreat"


class Resource(str, Enum):
    A = "A"
    B = "B"
    C = "C"


@dataclass
class Move:
    type: MoveType
    target: Resource
    amount: int  # 0-100 budget allocation

    def to_dict(self) -> dict:
        return {"type": self.type.value, "target": self.target.value, "amount": self.amount}

    @classmethod
    def from_dict(cls, d: dict) -> "Move":
        return cls(
            type=MoveType(d["type"]),
            target=Resource(d["target"]),
            amount=int(d["amount"]),
        )


@dataclass
class GameState:
    resources: dict[str, int] = field(default_factory=lambda: {"A": 100, "B": 100, "C": 100})
    scores: dict[str, int] = field(default_factory=lambda: {"red": 0, "blue": 0})
    round_number: int = 1
    total_rounds: int = 10
    # Accumulated economy bonus per agent (compounds each retreat/economy move)
    economy_bonus: dict[str, float] = field(default_factory=lambda: {"red": 0.0, "blue": 0.0})

    def to_dict(self) -> dict:
        return {
            "resources": dict(self.resources),
            "scores": dict(self.scores),
            "round": self.round_number,
            "totalRounds": self.total_rounds,
        }

    def state_hash(self) -> str:
        data = json.dumps(
            {"resources": self.resources, "scores": self.scores, "round": self.round_number},
            sort_keys=True,
        )
        return hashlib.sha256(data.encode()).hexdigest()[:16]

    def copy(self) -> "GameState":
        return GameState(
            resources=dict(self.resources),
            scores=dict(self.scores),
            round_number=self.round_number,
            total_rounds=self.total_rounds,
            economy_bonus=dict(self.economy_bonus),
        )


@dataclass
class RoundResolution:
    round_winner: Optional[str]  # "red", "blue", or None for draw
    resource_changes: dict[str, dict[str, int]]  # {resource: {red: delta, blue: delta}}
    description: str = ""

    def to_dict(self) -> dict:
        return {
            "roundWinner": self.round_winner,
            "resourceChanges": self.resource_changes,
            "description": self.description,
        }


BUDGET = 100


def get_valid_moves(game_state: GameState) -> list[dict]:
    """Return all valid moves for the current game state."""
    moves = []
    for move_type in MoveType:
        for resource in Resource:
            # Amount can vary; provide a few standard allocations
            for amount in [20, 40, 60, 80, 100]:
                if amount <= BUDGET:
                    moves.append(
                        {"type": move_type.value, "target": resource.value, "amount": amount}
                    )
    return moves


def resolve_round(
    red_move: Move, blue_move: Move, game_state: GameState
) -> RoundResolution:
    """Resolve a round given both players' moves. Returns resolution with resource changes."""
    resource_changes: dict[str, dict[str, int]] = {}
    red_score_delta = 0
    blue_score_delta = 0

    # --- Handle retreat / economy moves first (10% compound bonus) ---
    for agent, move in [("red", red_move), ("blue", blue_move)]:
        if move.type == MoveType.RETREAT:
            bonus = int(move.amount * 0.10)
            game_state.economy_bonus[agent] += bonus

    # --- Determine contested resources ---
    # Collect effective attack/defense power per resource per agent
    red_power: dict[str, int] = {"A": 0, "B": 0, "C": 0}
    blue_power: dict[str, int] = {"A": 0, "B": 0, "C": 0}

    def apply_move(power: dict, move: Move, agent: str) -> None:
        economy_boost = int(game_state.economy_bonus[agent])
        if move.type == MoveType.AGGRESSIVE_BID:
            power[move.target.value] += move.amount + economy_boost
        elif move.type == MoveType.DEFENSIVE_SPREAD:
            # Spread defense across all resources
            per_resource = (move.amount + economy_boost) // 3
            for r in ["A", "B", "C"]:
                power[r] += per_resource
        elif move.type == MoveType.BLUFF:
            # Bluff: looks like an attack but puts only 25% real power
            power[move.target.value] += (move.amount // 4) + economy_boost
        elif move.type == MoveType.COUNTER:
            # Counter: strong defense on targeted resource (1.5x)
            power[move.target.value] += int((move.amount + economy_boost) * 1.5)
        elif move.type == MoveType.RETREAT:
            # Retreat: no power committed, economy grows (handled above)
            pass

    apply_move(red_power, red_move, "red")
    apply_move(blue_power, blue_move, "blue")

    # --- Resolve each resource ---
    for r in ["A", "B", "C"]:
        rp = red_power[r]
        bp = blue_power[r]
        if rp == 0 and bp == 0:
            continue

        if rp > bp:
            # Red captures from the resource pool
            capture = min(game_state.resources[r], max(5, (rp - bp) // 2))
            red_score_delta += capture
            game_state.resources[r] -= capture
            resource_changes[r] = {"red": capture, "blue": 0}
        elif bp > rp:
            capture = min(game_state.resources[r], max(5, (bp - rp) // 2))
            blue_score_delta += capture
            game_state.resources[r] -= capture
            resource_changes[r] = {"red": 0, "blue": capture}
        else:
            # Equal = defender holds (no change)
            resource_changes[r] = {"red": 0, "blue": 0}

    # Apply score deltas
    game_state.scores["red"] += red_score_delta
    game_state.scores["blue"] += blue_score_delta

    # Determine round winner
    if red_score_delta > blue_score_delta:
        round_winner = "red"
    elif blue_score_delta > red_score_delta:
        round_winner = "blue"
    else:
        round_winner = None

    description = (
        f"Red played {red_move.type.value} on {red_move.target.value} ({red_move.amount}), "
        f"Blue played {blue_move.type.value} on {blue_move.target.value} ({blue_move.amount}). "
    )
    if round_winner:
        description += f"{round_winner.capitalize()} wins the round."
    else:
        description += "Round is a draw."

    return RoundResolution(
        round_winner=round_winner,
        resource_changes=resource_changes,
        description=description,
    )


def is_game_over(game_state: GameState) -> bool:
    """Check if the game is over (all rounds played or all resources depleted)."""
    if game_state.round_number > game_state.total_rounds:
        return True
    if all(v <= 0 for v in game_state.resources.values()):
        return True
    return False


def get_winner(game_state: GameState) -> str:
    """Return the winner based on final scores."""
    if game_state.scores["red"] > game_state.scores["blue"]:
        return "red"
    elif game_state.scores["blue"] > game_state.scores["red"]:
        return "blue"
    return "draw"


def default_move() -> Move:
    """Fallback move if an agent fails."""
    return Move(type=MoveType.DEFENSIVE_SPREAD, target=Resource.A, amount=60)
