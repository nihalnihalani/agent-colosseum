"""Negotiation game engine — 5-round sequential offer negotiation."""

from __future__ import annotations

import hashlib
import json
import random
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class NegotiationMoveType(str, Enum):
    PROPOSE = "propose"
    ACCEPT = "accept"
    REJECT = "reject"
    COUNTER_OFFER = "counter_offer"
    BLUFF_WALKAWAY = "bluff_walkaway"


@dataclass
class NegotiationMove:
    type: NegotiationMoveType
    price: int = 0  # proposed/counter price (0-100)
    terms: str = ""  # optional terms modifier

    def to_dict(self) -> dict:
        return {"type": self.type.value, "price": self.price, "terms": self.terms}

    @classmethod
    def from_dict(cls, d: dict) -> "NegotiationMove":
        return cls(
            type=NegotiationMoveType(d["type"]),
            price=int(d.get("price", 0)),
            terms=d.get("terms", ""),
        )


@dataclass
class NegotiationState:
    """State for a negotiation game.

    Red is the "seller" (wants high price), blue is the "buyer" (wants low price).
    Each has a hidden walkaway price.
    Score = value captured above/below their walkaway price.
    """

    round_number: int = 1
    total_rounds: int = 5
    # Hidden walkaway prices (set at game start)
    red_walkaway: int = 0   # seller's minimum acceptable price
    blue_walkaway: int = 0  # buyer's maximum acceptable price
    # Current offer on the table
    current_offer: Optional[int] = None
    offer_by: Optional[str] = None  # "red" or "blue"
    # Deal tracking
    deal_price: Optional[int] = None  # if deal was struck
    deal_round: Optional[int] = None
    # Scores: value captured above walkaway
    scores: dict[str, int] = field(default_factory=lambda: {"red": 0, "blue": 0})
    # Bluff tracking
    bluffs_used: dict[str, int] = field(default_factory=lambda: {"red": 0, "blue": 0})

    def __post_init__(self):
        if self.red_walkaway == 0 and self.blue_walkaway == 0:
            # Generate walkaway prices ensuring a zone of possible agreement
            self.red_walkaway = random.randint(20, 45)   # seller floor
            self.blue_walkaway = random.randint(55, 80)   # buyer ceiling

    def to_dict(self) -> dict:
        return {
            "round": self.round_number,
            "totalRounds": self.total_rounds,
            "currentOffer": self.current_offer,
            "offerBy": self.offer_by,
            "dealPrice": self.deal_price,
            "dealRound": self.deal_round,
            "scores": dict(self.scores),
            "bluffsUsed": dict(self.bluffs_used),
        }

    def to_dict_for_agent(self, agent: str) -> dict:
        """Return state visible to a specific agent (hides opponent walkaway)."""
        d = self.to_dict()
        if agent == "red":
            d["myWalkaway"] = self.red_walkaway
        else:
            d["myWalkaway"] = self.blue_walkaway
        return d

    def state_hash(self) -> str:
        data = json.dumps(
            {"round": self.round_number, "scores": self.scores, "offer": self.current_offer},
            sort_keys=True,
        )
        return hashlib.sha256(data.encode()).hexdigest()[:16]

    def copy(self) -> "NegotiationState":
        return NegotiationState(
            round_number=self.round_number,
            total_rounds=self.total_rounds,
            red_walkaway=self.red_walkaway,
            blue_walkaway=self.blue_walkaway,
            current_offer=self.current_offer,
            offer_by=self.offer_by,
            deal_price=self.deal_price,
            deal_round=self.deal_round,
            scores=dict(self.scores),
            bluffs_used=dict(self.bluffs_used),
        )


@dataclass
class NegotiationRoundResolution:
    round_winner: Optional[str]
    description: str = ""
    deal_struck: bool = False
    deal_price: Optional[int] = None

    def to_dict(self) -> dict:
        return {
            "roundWinner": self.round_winner,
            "description": self.description,
            "dealStruck": self.deal_struck,
            "dealPrice": self.deal_price,
            "resourceChanges": {},
        }


def get_valid_moves(game_state: NegotiationState) -> list[dict]:
    """Return all valid moves for the current negotiation state."""
    moves = []
    for price in range(10, 100, 10):
        moves.append({"type": "propose", "price": price, "terms": ""})
        moves.append({"type": "counter_offer", "price": price, "terms": ""})
    moves.append({"type": "accept", "price": 0, "terms": ""})
    moves.append({"type": "reject", "price": 0, "terms": ""})
    moves.append({"type": "bluff_walkaway", "price": 0, "terms": ""})
    return moves


def resolve_round(
    red_move: NegotiationMove,
    blue_move: NegotiationMove,
    game_state: NegotiationState,
) -> NegotiationRoundResolution:
    """Resolve a negotiation round given both players' moves."""

    description_parts = []
    deal_struck = False
    deal_price = None
    round_winner = None

    # Track bluffs
    if red_move.type == NegotiationMoveType.BLUFF_WALKAWAY:
        game_state.bluffs_used["red"] += 1
        description_parts.append("Red bluffs a walkaway!")
    if blue_move.type == NegotiationMoveType.BLUFF_WALKAWAY:
        game_state.bluffs_used["blue"] += 1
        description_parts.append("Blue bluffs a walkaway!")

    # Both bluff = mutual walkaway, no deal possible this round
    if (red_move.type == NegotiationMoveType.BLUFF_WALKAWAY
            and blue_move.type == NegotiationMoveType.BLUFF_WALKAWAY):
        description_parts.append("Both sides walk away from the table. Tensions rise.")
        return NegotiationRoundResolution(
            round_winner=None,
            description=" ".join(description_parts),
        )

    # Check for acceptance of current offer
    if red_move.type == NegotiationMoveType.ACCEPT and game_state.current_offer is not None:
        deal_struck = True
        deal_price = game_state.current_offer
    elif blue_move.type == NegotiationMoveType.ACCEPT and game_state.current_offer is not None:
        deal_struck = True
        deal_price = game_state.current_offer

    # Both accept = deal at current offer
    if (red_move.type == NegotiationMoveType.ACCEPT
            and blue_move.type == NegotiationMoveType.ACCEPT
            and game_state.current_offer is not None):
        deal_struck = True
        deal_price = game_state.current_offer

    # If one proposes and other accepts, deal at proposed price
    if not deal_struck:
        if (red_move.type in (NegotiationMoveType.PROPOSE, NegotiationMoveType.COUNTER_OFFER)
                and blue_move.type == NegotiationMoveType.ACCEPT):
            deal_struck = True
            deal_price = red_move.price
        elif (blue_move.type in (NegotiationMoveType.PROPOSE, NegotiationMoveType.COUNTER_OFFER)
              and red_move.type == NegotiationMoveType.ACCEPT):
            deal_struck = True
            deal_price = blue_move.price

    # If both propose/counter, check if prices cross (deal at midpoint)
    if not deal_struck:
        red_price = None
        blue_price = None
        if red_move.type in (NegotiationMoveType.PROPOSE, NegotiationMoveType.COUNTER_OFFER):
            red_price = red_move.price
        if blue_move.type in (NegotiationMoveType.PROPOSE, NegotiationMoveType.COUNTER_OFFER):
            blue_price = blue_move.price

        if red_price is not None and blue_price is not None:
            # Red is seller (wants high), blue is buyer (wants low)
            # If seller's ask <= buyer's bid, deal at midpoint
            if red_price <= blue_price:
                deal_struck = True
                deal_price = (red_price + blue_price) // 2
                description_parts.append(
                    f"Prices cross! Red asks {red_price}, Blue offers {blue_price}."
                )

    if deal_struck and deal_price is not None:
        game_state.deal_price = deal_price
        game_state.deal_round = game_state.round_number

        # Score: value captured above walkaway
        # Red (seller) gains: deal_price - red_walkaway
        # Blue (buyer) gains: blue_walkaway - deal_price
        red_gain = max(0, deal_price - game_state.red_walkaway)
        blue_gain = max(0, game_state.blue_walkaway - deal_price)
        game_state.scores["red"] += red_gain
        game_state.scores["blue"] += blue_gain

        if red_gain > blue_gain:
            round_winner = "red"
        elif blue_gain > red_gain:
            round_winner = "blue"

        description_parts.append(
            f"Deal struck at {deal_price}! Red gains {red_gain}, Blue gains {blue_gain}."
        )
    else:
        # Update current offer on the table
        if red_move.type in (NegotiationMoveType.PROPOSE, NegotiationMoveType.COUNTER_OFFER):
            game_state.current_offer = red_move.price
            game_state.offer_by = "red"
            description_parts.append(f"Red {'proposes' if red_move.type == NegotiationMoveType.PROPOSE else 'counters at'} {red_move.price}.")
        elif blue_move.type in (NegotiationMoveType.PROPOSE, NegotiationMoveType.COUNTER_OFFER):
            game_state.current_offer = blue_move.price
            game_state.offer_by = "blue"
            description_parts.append(f"Blue {'proposes' if blue_move.type == NegotiationMoveType.PROPOSE else 'counters at'} {blue_move.price}.")

        if red_move.type == NegotiationMoveType.REJECT:
            description_parts.append("Red rejects the offer.")
        if blue_move.type == NegotiationMoveType.REJECT:
            description_parts.append("Blue rejects the offer.")

    description = " ".join(description_parts) if description_parts else "Negotiations continue."

    return NegotiationRoundResolution(
        round_winner=round_winner,
        description=description,
        deal_struck=deal_struck,
        deal_price=deal_price,
    )


def is_game_over(game_state: NegotiationState) -> bool:
    """Game over if all rounds played or deal was struck."""
    if game_state.deal_price is not None:
        return True
    if game_state.round_number > game_state.total_rounds:
        return True
    return False


def get_winner(game_state: NegotiationState) -> str:
    """Return the winner based on final scores."""
    if game_state.deal_price is None:
        # No deal struck -- both lose, but less bluffs = less penalty
        return "draw"
    if game_state.scores["red"] > game_state.scores["blue"]:
        return "red"
    elif game_state.scores["blue"] > game_state.scores["red"]:
        return "blue"
    return "draw"


def default_move() -> NegotiationMove:
    """Fallback move if an agent fails."""
    return NegotiationMove(type=NegotiationMoveType.PROPOSE, price=50)
