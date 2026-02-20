"""GPU Auction engine — Neocloud GPU resource bidding with dynamic pricing."""

from __future__ import annotations

import hashlib
import json
import random
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class GPUBidMoveType(str, Enum):
    BID = "bid"  # Place a bid for GPU resources
    PASS = "pass"  # Skip this round
    WAIT = "wait"  # Wait for better pricing (cost optimization)
    SURGE_BID = "surge_bid"  # Pay premium for guaranteed access


class NeocloudMoveType(str, Enum):
    SET_PRICE = "set_price"  # Set base price for resources
    SURGE_PRICING = "surge_pricing"  # Increase price due to demand
    DISCOUNT = "discount"  # Offer discount to attract users
    HOLD = "hold"  # Maintain current pricing


TOTAL_ROUNDS = 10
USER_STARTING_BUDGET = 10000  # User's budget in credits
NEOCLOUD_BASE_REVENUE = 0  # Neocloud starts with 0 revenue


# GPU Resource Types with compute units and base hourly rates
GPU_TYPES = [
    {"name": "NVIDIA H100", "compute_units": 100, "base_price": 400, "scarcity": 0.3},
    {"name": "NVIDIA A100", "compute_units": 80, "base_price": 300, "scarcity": 0.5},
    {"name": "NVIDIA A10G", "compute_units": 40, "base_price": 150, "scarcity": 0.7},
    {"name": "NVIDIA RTX 4090", "compute_units": 60, "base_price": 200, "scarcity": 0.6},
    {"name": "NVIDIA L4", "compute_units": 30, "base_price": 100, "scarcity": 0.8},
    {"name": "AMD MI300X", "compute_units": 90, "base_price": 350, "scarcity": 0.4},
]

# Cloud GPU Providers
NEOCLOUD_PROVIDERS = [
    {"name": "AWS", "pricing_style": "premium", "base_multiplier": 1.2},
    {"name": "Azure", "pricing_style": "enterprise", "base_multiplier": 1.15},
    {"name": "Google Cloud", "pricing_style": "competitive", "base_multiplier": 1.0},
    {"name": "Lambda Labs", "pricing_style": "budget", "base_multiplier": 0.85},
    {"name": "CoreWeave", "pricing_style": "dynamic", "base_multiplier": 0.9},
    {"name": "Nebius", "pricing_style": "value", "base_multiplier": 0.8},
]


@dataclass
class GPUBidMove:
    type: GPUBidMoveType
    amount: int = 0  # Bid amount
    gpu_type: str = ""  # Which GPU to bid on
    hours: int = 1  # Hours of compute requested

    def to_dict(self) -> dict:
        return {
            "type": self.type.value,
            "amount": self.amount,
            "gpuType": self.gpu_type,
            "hours": self.hours,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "GPUBidMove":
        return cls(
            type=GPUBidMoveType(d["type"]),
            amount=int(d.get("amount", 0)),
            gpu_type=d.get("gpuType", ""),
            hours=int(d.get("hours", 1)),
        )


@dataclass
class NeocloudMove:
    type: NeocloudMoveType
    price_adjustment: float = 0.0  # Percentage adjustment (-0.2 to +0.5)
    target_gpu: str = ""  # Which GPU this applies to

    def to_dict(self) -> dict:
        return {
            "type": self.type.value,
            "priceAdjustment": self.price_adjustment,
            "targetGpu": self.target_gpu,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "NeocloudMove":
        return cls(
            type=NeocloudMoveType(d["type"]),
            price_adjustment=float(d.get("priceAdjustment", 0.0)),
            target_gpu=d.get("targetGpu", ""),
        )


@dataclass
class GPUResource:
    """A GPU resource available for bidding."""
    name: str
    compute_units: int
    base_price: int
    scarcity: float  # 0-1, higher = more available
    current_price: int = 0
    demand_level: float = 0.5  # 0-1, current demand
    surge_active: bool = False

    def __post_init__(self):
        if self.current_price == 0:
            self.current_price = self.base_price

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "computeUnits": self.compute_units,
            "basePrice": self.base_price,
            "currentPrice": self.current_price,
            "scarcity": self.scarcity,
            "demandLevel": self.demand_level,
            "surgeActive": self.surge_active,
            "savingsPercent": round((1 - self.current_price / self.base_price) * 100, 1) if self.current_price < self.base_price else 0,
            "surgePercent": round((self.current_price / self.base_price - 1) * 100, 1) if self.current_price > self.base_price else 0,
        }


@dataclass
class ProviderPricing:
    """Pricing state for a Neocloud provider."""
    name: str
    pricing_style: str
    base_multiplier: float
    gpu_prices: dict = field(default_factory=dict)  # GPU name -> current price
    total_revenue: int = 0
    resources_sold: int = 0

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "pricingStyle": self.pricing_style,
            "gpuPrices": self.gpu_prices,
            "totalRevenue": self.total_revenue,
            "resourcesSold": self.resources_sold,
        }


@dataclass
class GPUAuctionState:
    """State for a GPU bidding game."""
    total_rounds: int = TOTAL_ROUNDS
    current_round: int = 0
    round_number: int = 0  # Alias for compatibility with match.py
    
    # User (bidder) state
    user_budget: int = USER_STARTING_BUDGET
    user_compute_acquired: int = 0
    user_cost_efficiency: float = 0.0  # Compute units per credit spent
    
    # Neocloud (seller) state  
    neocloud_revenue: int = 0
    neocloud_resources_sold: int = 0
    
    # Scores for compatibility with match.py
    scores: dict = field(default_factory=lambda: {"red": 0, "blue": 0})
    
    # Market state
    gpu_resources: list = field(default_factory=list)
    providers: list = field(default_factory=list)
    demand_history: list = field(default_factory=list)
    price_history: list = field(default_factory=list)
    
    # Current round state
    current_gpu: Optional[GPUResource] = None
    market_demand: float = 0.5  # Overall market demand 0-1
    
    # Round history
    round_results: list = field(default_factory=list)

    def __post_init__(self):
        if not self.gpu_resources:
            self._init_resources()
        if not self.providers:
            self._init_providers()

    def _init_resources(self):
        """Initialize GPU resources with randomized demand."""
        self.gpu_resources = []
        for gpu in GPU_TYPES:
            demand = random.uniform(0.3, 0.9)
            resource = GPUResource(
                name=gpu["name"],
                compute_units=gpu["compute_units"],
                base_price=gpu["base_price"],
                scarcity=gpu["scarcity"],
                demand_level=demand,
            )
            # Adjust price based on initial demand
            if demand > 0.7:
                resource.current_price = int(resource.base_price * (1 + (demand - 0.5) * 0.5))
                resource.surge_active = True
            self.gpu_resources.append(resource)

    def _init_providers(self):
        """Initialize Neocloud providers with their pricing."""
        self.providers = []
        for provider in NEOCLOUD_PROVIDERS:
            pricing = ProviderPricing(
                name=provider["name"],
                pricing_style=provider["pricing_style"],
                base_multiplier=provider["base_multiplier"],
            )
            # Set initial GPU prices for this provider
            for gpu in self.gpu_resources:
                base = int(gpu.base_price * pricing.base_multiplier)
                # Add some variance
                variance = random.uniform(-0.1, 0.1)
                pricing.gpu_prices[gpu.name] = int(base * (1 + variance))
            self.providers.append(pricing)

    def select_round_gpu(self) -> GPUResource:
        """Select a GPU for this round's bidding."""
        # Weight selection by demand (higher demand GPUs appear more often)
        weights = [gpu.demand_level for gpu in self.gpu_resources]
        self.current_gpu = random.choices(self.gpu_resources, weights=weights)[0]
        return self.current_gpu

    def update_market_demand(self):
        """Simulate market demand changes."""
        # Random walk with mean reversion
        change = random.uniform(-0.15, 0.15)
        self.market_demand = max(0.2, min(0.95, self.market_demand + change))
        
        # Update individual GPU demands
        for gpu in self.gpu_resources:
            gpu_change = random.uniform(-0.1, 0.1)
            gpu.demand_level = max(0.1, min(0.95, gpu.demand_level + gpu_change + change * 0.5))
            
            # Trigger surge pricing at high demand
            if gpu.demand_level > 0.75:
                gpu.surge_active = True
                surge_multiplier = 1 + (gpu.demand_level - 0.5) * 0.8
                gpu.current_price = int(gpu.base_price * surge_multiplier)
            elif gpu.demand_level < 0.4:
                gpu.surge_active = False
                discount = 1 - (0.4 - gpu.demand_level) * 0.3
                gpu.current_price = int(gpu.base_price * discount)
            else:
                gpu.surge_active = False
                gpu.current_price = gpu.base_price

        self.demand_history.append(self.market_demand)

    def get_cheapest_provider(self, gpu_name: str) -> tuple[str, int]:
        """Find the cheapest provider for a specific GPU."""
        cheapest = None
        cheapest_price = float('inf')
        for provider in self.providers:
            price = provider.gpu_prices.get(gpu_name, float('inf'))
            if price < cheapest_price:
                cheapest_price = price
                cheapest = provider.name
        return (cheapest, int(cheapest_price))

    def get_provider_comparison(self, gpu_name: str) -> list[dict]:
        """Get price comparison across all providers for a GPU."""
        comparison = []
        for provider in self.providers:
            price = provider.gpu_prices.get(gpu_name, 0)
            gpu = next((g for g in self.gpu_resources if g.name == gpu_name), None)
            base = gpu.base_price if gpu else price
            comparison.append({
                "provider": provider.name,
                "price": price,
                "style": provider.pricing_style,
                "vsBase": round((price / base - 1) * 100, 1) if base else 0,
            })
        return sorted(comparison, key=lambda x: x["price"])

    def to_dict(self) -> dict:
        return {
            "totalRounds": self.total_rounds,
            "currentRound": self.current_round,
            "userBudget": self.user_budget,
            "userComputeAcquired": self.user_compute_acquired,
            "userCostEfficiency": round(self.user_cost_efficiency, 2),
            "neocloudRevenue": self.neocloud_revenue,
            "neocloudResourcesSold": self.neocloud_resources_sold,
            "gpuResources": [gpu.to_dict() for gpu in self.gpu_resources],
            "providers": [p.to_dict() for p in self.providers],
            "marketDemand": round(self.market_demand, 2),
            "currentGpu": self.current_gpu.to_dict() if self.current_gpu else None,
            "demandHistory": self.demand_history[-20:],  # Last 20 data points
            "roundResults": self.round_results,
        }

    def to_dict_for_agent(self, agent: str) -> dict:
        """Get state from perspective of an agent."""
        base = self.to_dict()
        if agent == "red":  # User/bidder
            base["role"] = "bidder"
            base["objective"] = "Maximize compute acquired while minimizing cost"
            base["budget"] = self.user_budget
            if self.current_gpu:
                base["cheapestOption"] = self.get_cheapest_provider(self.current_gpu.name)
                base["priceComparison"] = self.get_provider_comparison(self.current_gpu.name)
        else:  # Blue = Neocloud
            base["role"] = "neocloud"
            base["objective"] = "Maximize revenue through dynamic pricing"
            base["totalRevenue"] = self.neocloud_revenue
        return base

    def copy(self) -> "GPUAuctionState":
        """Return a shallow copy of the state for comparison."""
        import copy as copy_module
        return copy_module.copy(self)


@dataclass
class GPURoundResolution:
    """Result of a GPU bidding round."""
    round_number: int
    gpu: GPUResource
    user_move: GPUBidMove
    neocloud_move: NeocloudMove
    transaction_occurred: bool
    final_price: int
    compute_gained: int
    user_budget_after: int
    neocloud_revenue_after: int
    market_demand: float
    winner: str  # "user" if got good deal, "neocloud" if maximized revenue, "draw"

    def to_dict(self) -> dict:
        return {
            "roundNumber": self.round_number,
            "gpu": self.gpu.to_dict(),
            "userMove": self.user_move.to_dict(),
            "neocloudMove": self.neocloud_move.to_dict(),
            "transactionOccurred": self.transaction_occurred,
            "finalPrice": self.final_price,
            "computeGained": self.compute_gained,
            "userBudgetAfter": self.user_budget_after,
            "neocloudRevenueAfter": self.neocloud_revenue_after,
            "marketDemand": round(self.market_demand, 2),
            "winner": self.winner,
        }


def resolve_gpu_round(
    state: GPUAuctionState,
    user_move: GPUBidMove,
    neocloud_move: NeocloudMove,
) -> GPURoundResolution:
    """Resolve a round of GPU bidding."""
    gpu = state.current_gpu
    
    # Neocloud adjusts pricing first
    if neocloud_move.type == NeocloudMoveType.SURGE_PRICING:
        adjustment = 1 + abs(neocloud_move.price_adjustment)
        gpu.current_price = int(gpu.base_price * adjustment)
        gpu.surge_active = True
    elif neocloud_move.type == NeocloudMoveType.DISCOUNT:
        adjustment = 1 - abs(neocloud_move.price_adjustment)
        gpu.current_price = int(gpu.base_price * max(0.5, adjustment))
        gpu.surge_active = False
    elif neocloud_move.type == NeocloudMoveType.SET_PRICE:
        gpu.current_price = int(gpu.base_price * (1 + neocloud_move.price_adjustment))

    # Determine if transaction occurs
    transaction = False
    final_price = 0
    compute_gained = 0
    winner = "draw"

    if user_move.type == GPUBidMoveType.BID:
        if user_move.amount >= gpu.current_price:
            transaction = True
            final_price = gpu.current_price
            compute_gained = gpu.compute_units * user_move.hours
            
            # Determine winner based on deal quality
            price_ratio = final_price / gpu.base_price
            if price_ratio < 0.9:
                winner = "user"  # Got a good deal
            elif price_ratio > 1.2:
                winner = "neocloud"  # Neocloud got premium
            else:
                winner = "draw"
                
    elif user_move.type == GPUBidMoveType.SURGE_BID:
        # User pays premium for guaranteed access
        premium_price = int(gpu.current_price * 1.3)
        if user_move.amount >= premium_price:
            transaction = True
            final_price = premium_price
            compute_gained = gpu.compute_units * user_move.hours
            winner = "neocloud"  # Neocloud always wins on surge bids
            
    elif user_move.type == GPUBidMoveType.WAIT:
        # User waits - no transaction but demand might drop
        transaction = False
        # Slightly reduce demand for this GPU
        gpu.demand_level = max(0.1, gpu.demand_level - 0.05)

    # Update state
    if transaction:
        state.user_budget -= final_price
        state.user_compute_acquired += compute_gained
        state.neocloud_revenue += final_price
        state.neocloud_resources_sold += 1
        
        # Update cost efficiency
        if state.user_compute_acquired > 0:
            total_spent = USER_STARTING_BUDGET - state.user_budget
            state.user_cost_efficiency = state.user_compute_acquired / max(1, total_spent)

        # Update scores for display (user = compute acquired, neocloud = revenue/100)
        state.scores["red"] = state.user_compute_acquired
        state.scores["blue"] = state.neocloud_revenue // 100

        # Update provider stats
        for provider in state.providers:
            if provider.gpu_prices.get(gpu.name):
                provider.total_revenue += final_price
                provider.resources_sold += 1
                break

    resolution = GPURoundResolution(
        round_number=state.current_round,
        gpu=gpu,
        user_move=user_move,
        neocloud_move=neocloud_move,
        transaction_occurred=transaction,
        final_price=final_price,
        compute_gained=compute_gained,
        user_budget_after=state.user_budget,
        neocloud_revenue_after=state.neocloud_revenue,
        market_demand=state.market_demand,
        winner=winner,
    )

    state.round_results.append(resolution.to_dict())
    return resolution


def get_gpu_winner(state: GPUAuctionState) -> str:
    """Determine overall winner of the GPU auction."""
    # User wins if they got good compute efficiency
    # Neocloud wins if they maximized revenue relative to base prices
    
    expected_revenue = sum(gpu.base_price for gpu in state.gpu_resources) * state.neocloud_resources_sold / len(state.gpu_resources)
    revenue_ratio = state.neocloud_revenue / max(1, expected_revenue)
    
    # Check user's efficiency
    expected_efficiency = 1.0  # 1 compute unit per credit at base prices
    actual_efficiency = state.user_cost_efficiency * 100  # Scale up for comparison
    
    user_score = actual_efficiency / max(0.01, expected_efficiency)
    neocloud_score = revenue_ratio

    if user_score > neocloud_score * 1.1:
        return "red"  # User won (good deals)
    elif neocloud_score > user_score * 1.1:
        return "blue"  # Neocloud won (high revenue)
    return "draw"


def is_gpu_game_over(state: GPUAuctionState) -> bool:
    """Check if the GPU auction game is over."""
    if state.current_round >= state.total_rounds:
        return True
    if state.user_budget <= 0:
        return True
    return False


def default_user_move(state: GPUAuctionState) -> GPUBidMove:
    """Generate a default user move."""
    gpu = state.current_gpu
    if not gpu:
        return GPUBidMove(type=GPUBidMoveType.PASS)
    
    # Simple heuristic: bid at current price if budget allows
    if state.user_budget >= gpu.current_price:
        return GPUBidMove(
            type=GPUBidMoveType.BID,
            amount=gpu.current_price,
            gpu_type=gpu.name,
            hours=1,
        )
    return GPUBidMove(type=GPUBidMoveType.PASS)


def default_neocloud_move(state: GPUAuctionState) -> NeocloudMove:
    """Generate a default neocloud move."""
    # Simple heuristic: surge price when demand is high
    if state.market_demand > 0.7:
        return NeocloudMove(
            type=NeocloudMoveType.SURGE_PRICING,
            price_adjustment=0.3,
            target_gpu=state.current_gpu.name if state.current_gpu else "",
        )
    elif state.market_demand < 0.4:
        return NeocloudMove(
            type=NeocloudMoveType.DISCOUNT,
            price_adjustment=0.15,
            target_gpu=state.current_gpu.name if state.current_gpu else "",
        )
    return NeocloudMove(type=NeocloudMoveType.HOLD)
