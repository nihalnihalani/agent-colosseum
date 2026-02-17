"""Traffic generator -- populate historical match data in MongoDB + Neo4j.

Usage:
    python -m backend.traffic_generator --matches 20
    python -m backend.traffic_generator --matches 5 --game-types resource_wars
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import os
import random
import sys
import time
from datetime import datetime, timezone

# Ensure mock mode for traffic generation
os.environ.setdefault("MOCK_MODE", "true")

from backend.match import Match, MatchConfig
from backend.mongodb_client import get_mongodb_client
from backend.neo4j_client import get_neo4j_client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)

PERSONALITIES = ["aggressive", "defensive", "adaptive", "chaotic"]
GAME_TYPES = ["resource_wars", "negotiation", "auction"]


async def run_single_match(
    match_index: int,
    game_type: str,
    red_personality: str,
    blue_personality: str,
    total_rounds: int = 10,
) -> dict:
    """Run a single match and store results."""
    mongo = get_mongodb_client()
    neo4j = get_neo4j_client()

    config = MatchConfig(
        game_type=game_type,
        red_personality=red_personality,
        blue_personality=blue_personality,
        total_rounds=total_rounds,
        round_delay=0.0,  # No delay for traffic generation
    )

    match_id = config.match_id
    logger.info(
        "[%d] Starting match %s: %s vs %s (%s, %d rounds)",
        match_index, match_id, red_personality, blue_personality,
        game_type, total_rounds,
    )

    # Initialize match document in MongoDB
    match_doc = {
        "match_id": match_id,
        "game_type": game_type,
        "agents": {
            "red": {"personality": red_personality, "model": "mock"},
            "blue": {"personality": blue_personality, "model": "mock"},
        },
        "total_rounds": total_rounds,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "state": "running",
        "rounds": [],
    }
    mongo.store_match(match_doc)

    match = Match(config=config)
    events = []
    round_num = 0
    start_time = time.time()

    async for event in match.run_match():
        events.append(event)
        etype = event.get("type")

        if etype == "round_end":
            round_num = event.get("round", round_num)

        if etype == "collapse":
            # Build round data for MongoDB storage
            resolution = event.get("resolution", {})
            red_preds = event.get("redPredictions", [])
            blue_preds = event.get("bluePredictions", [])

            # Find the most recent thinking_end events for moves
            red_move = None
            blue_move = None
            for e in reversed(events):
                if e.get("type") == "thinking_end" and e.get("agent") == "red" and red_move is None:
                    red_move = e.get("chosenMove")
                if e.get("type") == "thinking_end" and e.get("agent") == "blue" and blue_move is None:
                    blue_move = e.get("chosenMove")
                if red_move and blue_move:
                    break

            round_data = {
                "round": round_num + 1,
                "red": {
                    "predictions": red_preds,
                    "chosen_move": red_move,
                },
                "blue": {
                    "predictions": blue_preds,
                    "chosen_move": blue_move,
                },
                "resolution": resolution,
            }
            mongo.store_round(match_id, round_data)

        if etype == "match_end":
            mongo.finalize_match(match_id, event)

    elapsed = time.time() - start_time

    # Extract final results
    match_end = next((e for e in reversed(events) if e.get("type") == "match_end"), {})
    winner = match_end.get("winner", "draw")
    final_scores = match_end.get("finalScores", {})

    logger.info(
        "[%d] Match %s completed in %.1fs -- winner: %s, scores: %s",
        match_index, match_id, elapsed, winner, final_scores,
    )

    return {
        "match_id": match_id,
        "winner": winner,
        "final_scores": final_scores,
        "elapsed": elapsed,
        "red_personality": red_personality,
        "blue_personality": blue_personality,
        "game_type": game_type,
    }


async def generate_traffic(
    num_matches: int,
    game_types: list[str],
    concurrency: int = 1,
) -> list[dict]:
    """Run N matches with random personality pairings."""
    # Initialize connections
    mongo = get_mongodb_client()
    neo4j = get_neo4j_client()

    mongo_ok = mongo.verify_connectivity()
    if mongo_ok:
        mongo.init_indexes()
        logger.info("MongoDB connected and indexes ready")
    else:
        logger.info("MongoDB not available -- results stored in-memory only")

    neo4j_ok = await neo4j.verify_connectivity()
    if neo4j_ok:
        await neo4j.init_schema()
        logger.info("Neo4j connected and schema ready")
    else:
        logger.info("Neo4j not available -- graph storage disabled")

    results = []
    semaphore = asyncio.Semaphore(concurrency)

    async def _run_with_semaphore(index: int) -> dict:
        async with semaphore:
            game_type = random.choice(game_types)
            red = random.choice(PERSONALITIES)
            blue = random.choice(PERSONALITIES)
            rounds = random.choice([8, 10, 12])
            return await run_single_match(index, game_type, red, blue, rounds)

    tasks = [_run_with_semaphore(i) for i in range(num_matches)]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Filter out exceptions
    completed = []
    for i, r in enumerate(results):
        if isinstance(r, Exception):
            logger.error("[%d] Match failed: %s", i, r)
        else:
            completed.append(r)

    return completed


def print_summary(results: list[dict]) -> None:
    """Print a summary of generated traffic."""
    if not results:
        print("\nNo matches completed.")
        return

    print(f"\n{'=' * 60}")
    print(f"  Traffic Generation Summary")
    print(f"{'=' * 60}")
    print(f"  Total matches: {len(results)}")

    # Win counts by personality
    wins: dict[str, int] = {}
    appearances: dict[str, int] = {}
    for r in results:
        for side in ["red_personality", "blue_personality"]:
            p = r[side]
            appearances[p] = appearances.get(p, 0) + 1
        winner_side = r.get("winner", "draw")
        if winner_side == "red":
            p = r["red_personality"]
            wins[p] = wins.get(p, 0) + 1
        elif winner_side == "blue":
            p = r["blue_personality"]
            wins[p] = wins.get(p, 0) + 1

    print(f"\n  {'Personality':<15} {'Matches':<10} {'Wins':<8} {'Win Rate':<10}")
    print(f"  {'-' * 43}")
    for p in sorted(appearances.keys()):
        total = appearances[p]
        w = wins.get(p, 0)
        rate = w / total if total > 0 else 0
        print(f"  {p:<15} {total:<10} {w:<8} {rate:.1%}")

    total_time = sum(r.get("elapsed", 0) for r in results)
    avg_time = total_time / len(results) if results else 0
    print(f"\n  Total time: {total_time:.1f}s")
    print(f"  Avg match time: {avg_time:.1f}s")
    print(f"{'=' * 60}\n")


def main():
    parser = argparse.ArgumentParser(description="Generate traffic for Agent Colosseum")
    parser.add_argument("--matches", type=int, default=5, help="Number of matches to run")
    parser.add_argument(
        "--game-types",
        type=str,
        default="all",
        help="Comma-separated game types or 'all'",
    )
    parser.add_argument("--concurrency", type=int, default=3, help="Max concurrent matches")
    args = parser.parse_args()

    if args.game_types == "all":
        game_types = GAME_TYPES
    else:
        game_types = [g.strip() for g in args.game_types.split(",")]

    logger.info("Starting traffic generation: %d matches, types=%s, concurrency=%d",
                args.matches, game_types, args.concurrency)

    results = asyncio.run(generate_traffic(args.matches, game_types, args.concurrency))
    print_summary(results)


if __name__ == "__main__":
    main()
