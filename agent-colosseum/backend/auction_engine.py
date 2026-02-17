"""Auction game engine — 8-item sequential sealed-bid auction."""

from __future__ import annotations

import hashlib
import json
import random
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class AuctionMoveType(str, Enum):
    BID = "bid"
    PASS = "pass"
    BLUFF_BID = "bluff_bid"  # inflated bid to scare opponent into overpaying later


TOTAL_ITEMS = 8
STARTING_CREDITS = 1000


@dataclass
class AuctionMove:
    type: AuctionMoveType
    amount: int = 0  # bid amount (0 for pass)

    def to_dict(self) -> dict:
        return {"type": self.type.value, "amount": self.amount}

    @classmethod
    def from_dict(cls, d: dict) -> "AuctionMove":
        return cls(
            type=AuctionMoveType(d["type"]),
            amount=int(d.get("amount", 0)),
        )


@dataclass
class AuctionItem:
    """An item up for auction with hidden valuations per agent."""

    name: str
    base_value: int  # public base value
    red_valuation: int  # hidden: what item is worth to red
    blue_valuation: int  # hidden: what item is worth to blue

    def to_dict(self) -> dict:
        return {"name": self.name, "baseValue": self.base_value}

    def to_dict_for_agent(self, agent: str) -> dict:
        d = self.to_dict()
        d["myValuation"] = self.red_valuation if agent == "red" else self.blue_valuation
        return d


def _generate_items() -> list[AuctionItem]:
    """Generate 8 auction items with varied valuations."""
    item_templates = [
        ("Alpha Core", 100),
        ("Beta Shield", 80),
        ("Gamma Drive", 120),
        ("Delta Array", 90),
        ("Epsilon Node", 110),
        ("Zeta Link", 70),
        ("Eta Pulse", 130),
        ("Theta Grid", 95),
    ]
    items = []
    for name, base in item_templates:
        # Each agent has a private valuation that varies from the base
        red_val = base + random.randint(-30, 50)
        blue_val = base + random.randint(-30, 50)
        items.append(AuctionItem(name=name, base_value=base, red_valuation=red_val, blue_valuation=blue_val))
    return items


@dataclass
class AuctionState:
    """State for an auction game."""

    round_number: int = 1
    total_rounds: int = TOTAL_ITEMS  # one round per item
    credits: dict[str, int] = field(default_factory=lambda: {"red": STARTING_CREDITS, "blue": STARTING_CREDITS})
    items: list[AuctionItem] = field(default_factory=_generate_items)
    # Tracking which items were won and at what price
    won_items: dict[str, list[dict]] = field(default_factory=lambda: {"red": [], "blue": []})
    # Scores: total valuation of won items minus total spent
    scores: dict[str, int] = field(default_factory=lambda: {"red": 0, "blue": 0})
    # Total spent tracking
    total_spent: dict[str, int] = field(default_factory=lambda: {"red": 0, "blue": 0})
    # Bluff tracking
    bluffs_used: dict[str, int] = field(default_factory=lambda: {"red": 0, "blue": 0})

    def current_item(self) -> Optional[AuctionItem]:
        idx = self.round_number - 1
        if 0 <= idx < len(self.items):
            return self.items[idx]
        return None

    def to_dict(self) -> dict:
        current = self.current_item()
        return {
            "round": self.round_number,
            "totalRounds": self.total_rounds,
            "credits": dict(self.credits),
            "scores": dict(self.scores),
            "totalSpent": dict(self.total_spent),
            "currentItem": current.to_dict() if current else None,
            "itemsRemaining": max(0, len(self.items) - self.round_number),
            "wonItems": {
                k: [wi for wi in v] for k, v in self.won_items.items()
            },
            "bluffsUsed": dict(self.bluffs_used),
        }

    def to_dict_for_agent(self, agent: str) -> dict:
        """Return state visible to a specific agent (includes private valuation)."""
        d = self.to_dict()
        current = self.current_item()
        if current:
            d["currentItem"] = current.to_dict_for_agent(agent)
        # Show upcoming items (base values only, no private valuations)
        upcoming_idx = self.round_number  # next item index (0-based)
        d["upcomingItems"] = [
            self.items[i].to_dict() for i in range(upcoming_idx, len(self.items))
        ]
        return d

    def state_hash(self) -> str:
        data = json.dumps(
            {"round": self.round_number, "scores": self.scores, "credits": self.credits},
            sort_keys=True,
        )
        return hashlib.sha256(data.encode()).hexdigest()[:16]

    def copy(self) -> "AuctionState":
        return AuctionState(
            round_number=self.round_number,
            total_rounds=self.total_rounds,
            credits=dict(self.credits),
            items=list(self.items),  # items are immutable after creation
            won_items={k: list(v) for k, v in self.won_items.items()},
            scores=dict(self.scores),
            total_spent=dict(self.total_spent),
            bluffs_used=dict(self.bluffs_used),
        )


@dataclass
class AuctionRoundResolution:
    round_winner: Optional[str]
    item_name: str = ""
    winning_bid: int = 0
    description: str = ""

    def to_dict(self) -> dict:
        return {
            "roundWinner": self.round_winner,
            "itemName": self.item_name,
            "winningBid": self.winning_bid,
            "description": self.description,
            "resourceChanges": {},
        }


def get_valid_moves(game_state: AuctionState) -> list[dict]:
    """Return all valid moves for the current auction state."""
    moves = [{"type": "pass", "amount": 0}]
    current = game_state.current_item()
    if not current:
        return moves

    # Bid amounts in increments, capped by available credits
    for agent in ["red", "blue"]:
        max_bid = game_state.credits[agent]
        for amount in range(10, min(max_bid + 1, 501), 10):
            moves.append({"type": "bid", "amount": amount})
        # Bluff bid (will be revealed as a bluff -- bid is halved)
        for amount in range(50, min(max_bid + 1, 501), 50):
            moves.append({"type": "bluff_bid", "amount": amount})

    return moves


def resolve_round(
    red_move: AuctionMove,
    blue_move: AuctionMove,
    game_state: AuctionState,
) -> AuctionRoundResolution:
    """Resolve a sealed-bid auction round."""

    current_item = game_state.current_item()
    if current_item is None:
        return AuctionRoundResolution(
            round_winner=None,
            description="No item to auction.",
        )

    item_name = current_item.name
    description_parts = []

    # Calculate effective bids
    def effective_bid(move: AuctionMove, agent: str) -> int:
        if move.type == AuctionMoveType.PASS:
            return 0
        if move.type == AuctionMoveType.BLUFF_BID:
            game_state.bluffs_used[agent] += 1
            # Bluff bid: the agent only actually pays half, but bid is shown at full
            # The "effective" bid for winning purposes is the full amount
            return move.amount
        return move.amount

    red_bid = effective_bid(red_move, "red")
    blue_bid = effective_bid(blue_move, "blue")

    # Cap bids at available credits
    red_bid = min(red_bid, game_state.credits["red"])
    blue_bid = min(blue_bid, game_state.credits["blue"])

    description_parts.append(f"Item: {item_name} (base value: {current_item.base_value}).")

    round_winner = None

    if red_bid == 0 and blue_bid == 0:
        description_parts.append("Both agents pass. Item goes unsold.")
    elif red_bid > blue_bid:
        round_winner = "red"
        # Actual payment: full bid for normal, half for bluff
        actual_payment = red_bid // 2 if red_move.type == AuctionMoveType.BLUFF_BID else red_bid
        actual_payment = min(actual_payment, game_state.credits["red"])

        game_state.credits["red"] -= actual_payment
        game_state.total_spent["red"] += actual_payment
        game_state.won_items["red"].append({
            "name": item_name,
            "bid": red_bid,
            "paid": actual_payment,
            "valuation": current_item.red_valuation,
        })
        # Score: valuation minus what was paid
        net_value = current_item.red_valuation - actual_payment
        game_state.scores["red"] += net_value
        description_parts.append(
            f"Red wins with bid {red_bid} (paid {actual_payment}). Net value: {net_value}."
        )
    elif blue_bid > red_bid:
        round_winner = "blue"
        actual_payment = blue_bid // 2 if blue_move.type == AuctionMoveType.BLUFF_BID else blue_bid
        actual_payment = min(actual_payment, game_state.credits["blue"])

        game_state.credits["blue"] -= actual_payment
        game_state.total_spent["blue"] += actual_payment
        game_state.won_items["blue"].append({
            "name": item_name,
            "bid": blue_bid,
            "paid": actual_payment,
            "valuation": current_item.blue_valuation,
        })
        net_value = current_item.blue_valuation - actual_payment
        game_state.scores["blue"] += net_value
        description_parts.append(
            f"Blue wins with bid {blue_bid} (paid {actual_payment}). Net value: {net_value}."
        )
    else:
        # Tie: random winner (coin flip)
        winner = random.choice(["red", "blue"])
        round_winner = winner
        move = red_move if winner == "red" else blue_move
        bid = red_bid if winner == "red" else blue_bid
        actual_payment = bid // 2 if move.type == AuctionMoveType.BLUFF_BID else bid
        actual_payment = min(actual_payment, game_state.credits[winner])

        valuation = current_item.red_valuation if winner == "red" else current_item.blue_valuation

        game_state.credits[winner] -= actual_payment
        game_state.total_spent[winner] += actual_payment
        game_state.won_items[winner].append({
            "name": item_name,
            "bid": bid,
            "paid": actual_payment,
            "valuation": valuation,
        })
        net_value = valuation - actual_payment
        game_state.scores[winner] += net_value
        description_parts.append(
            f"Tied bids at {bid}! {winner.capitalize()} wins the tiebreak (paid {actual_payment}). Net value: {net_value}."
        )

    return AuctionRoundResolution(
        round_winner=round_winner,
        item_name=item_name,
        winning_bid=max(red_bid, blue_bid),
        description=" ".join(description_parts),
    )


def is_game_over(game_state: AuctionState) -> bool:
    """Game over when all items have been auctioned."""
    if game_state.round_number > game_state.total_rounds:
        return True
    # Also end if both agents are out of credits
    if game_state.credits["red"] <= 0 and game_state.credits["blue"] <= 0:
        return True
    return False


def get_winner(game_state: AuctionState) -> str:
    """Return the winner based on final scores (total valuation - total spent)."""
    if game_state.scores["red"] > game_state.scores["blue"]:
        return "red"
    elif game_state.scores["blue"] > game_state.scores["red"]:
        return "blue"
    return "draw"


def default_move() -> AuctionMove:
    """Fallback move if an agent fails."""
    return AuctionMove(type=AuctionMoveType.BID, amount=50)
