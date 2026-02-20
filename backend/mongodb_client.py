"""MongoDB Atlas integration with graceful fallback."""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any, Optional

logger = logging.getLogger(__name__)

_client_instance: Optional["MongoDBClient | NoOpMongoClient"] = None


class MongoDBClient:
    """MongoDB Atlas client for match archive and analytics."""

    def __init__(self, uri: str):
        from pymongo import MongoClient

        self._client = MongoClient(uri)
        self._db = self._client["agent_colosseum"]
        self._matches = self._db["matches"]
        self._initialized = False
        logger.info("MongoDB client initialized")

    def close(self):
        if self._client:
            self._client.close()

    def verify_connectivity(self) -> bool:
        try:
            self._client.admin.command("ping")
            self._initialized = True
            logger.info("MongoDB connectivity verified")
            return True
        except Exception as e:
            logger.warning("MongoDB connectivity check failed: %s", e)
            return False

    def init_indexes(self) -> None:
        """Create indexes for efficient queries."""
        try:
            self._matches.create_index("match_id", unique=True)
            self._matches.create_index("winner")
            self._matches.create_index("game_type")
            self._matches.create_index("agents.red.personality")
            self._matches.create_index("agents.blue.personality")
            self._matches.create_index("started_at")
            logger.info("MongoDB indexes created")
        except Exception as e:
            logger.warning("Failed to create MongoDB indexes: %s", e)

    def store_match(self, match_data: dict) -> None:
        """Store or update a complete match document."""
        try:
            match_id = match_data.get("match_id", "")
            self._matches.update_one(
                {"match_id": match_id},
                {"$set": match_data},
                upsert=True,
            )
            logger.debug("Stored match %s in MongoDB", match_id)
        except Exception as e:
            logger.warning("Failed to store match in MongoDB: %s", e)

    def store_round(self, match_id: str, round_data: dict) -> None:
        """Append a round to an existing match document."""
        try:
            self._matches.update_one(
                {"match_id": match_id},
                {
                    "$push": {"rounds": round_data},
                    "$set": {"updated_at": datetime.now(timezone.utc).isoformat()},
                },
            )
            logger.debug("Stored round %s for match %s", round_data.get("round"), match_id)
        except Exception as e:
            logger.warning("Failed to store round in MongoDB: %s", e)

    def finalize_match(self, match_id: str, result_data: dict) -> None:
        """Update a match with final results (winner, scores, accuracy)."""
        try:
            self._matches.update_one(
                {"match_id": match_id},
                {
                    "$set": {
                        "winner": result_data.get("winner"),
                        "final_score": result_data.get("finalScores"),
                        "prediction_accuracy": result_data.get("predictionAccuracy"),
                        "total_futures_simulated": result_data.get("totalFuturesSimulated", 0),
                        "ended_at": datetime.now(timezone.utc).isoformat(),
                        "state": "completed",
                    }
                },
            )
            logger.debug("Finalized match %s", match_id)
        except Exception as e:
            logger.warning("Failed to finalize match in MongoDB: %s", e)

    def get_match(self, match_id: str) -> Optional[dict]:
        """Get a match document by ID."""
        try:
            doc = self._matches.find_one({"match_id": match_id}, {"_id": 0})
            return doc
        except Exception as e:
            logger.warning("Failed to get match from MongoDB: %s", e)
            return None

    def get_match_replay(self, match_id: str) -> Optional[dict]:
        """Get full match data for replay (rounds + events)."""
        try:
            doc = self._matches.find_one(
                {"match_id": match_id},
                {"_id": 0, "match_id": 1, "game_type": 1, "agents": 1,
                 "rounds": 1, "winner": 1, "final_score": 1,
                 "prediction_accuracy": 1, "total_futures_simulated": 1},
            )
            return doc
        except Exception as e:
            logger.warning("Failed to get match replay from MongoDB: %s", e)
            return None

    def get_agent_stats(self, personality: str) -> dict:
        """Get win rate and avg accuracy for an agent personality."""
        try:
            pipeline = [
                {"$match": {"state": "completed"}},
                {"$match": {
                    "$or": [
                        {"agents.red.personality": personality},
                        {"agents.blue.personality": personality},
                    ]
                }},
                {"$project": {
                    "personality": personality,
                    "is_red": {"$eq": ["$agents.red.personality", personality]},
                    "winner": 1,
                    "prediction_accuracy": 1,
                    "final_score": 1,
                }},
                {"$addFields": {
                    "side": {"$cond": ["$is_red", "red", "blue"]},
                    "won": {"$cond": [
                        "$is_red",
                        {"$eq": ["$winner", "red"]},
                        {"$eq": ["$winner", "blue"]},
                    ]},
                    "accuracy": {"$cond": [
                        "$is_red",
                        {"$ifNull": ["$prediction_accuracy.red", 0]},
                        {"$ifNull": ["$prediction_accuracy.blue", 0]},
                    ]},
                    "score": {"$cond": [
                        "$is_red",
                        {"$ifNull": ["$final_score.red", 0]},
                        {"$ifNull": ["$final_score.blue", 0]},
                    ]},
                }},
                {"$group": {
                    "_id": personality,
                    "total_matches": {"$sum": 1},
                    "wins": {"$sum": {"$cond": ["$won", 1, 0]}},
                    "avg_accuracy": {"$avg": "$accuracy"},
                    "avg_score": {"$avg": "$score"},
                }},
                {"$addFields": {
                    "win_rate": {
                        "$cond": [
                            {"$gt": ["$total_matches", 0]},
                            {"$divide": ["$wins", "$total_matches"]},
                            0,
                        ]
                    }
                }},
            ]
            results = list(self._matches.aggregate(pipeline))
            if results:
                r = results[0]
                return {
                    "personality": personality,
                    "total_matches": r.get("total_matches", 0),
                    "wins": r.get("wins", 0),
                    "win_rate": round(r.get("win_rate", 0), 3),
                    "avg_accuracy": round(r.get("avg_accuracy", 0), 3),
                    "avg_score": round(r.get("avg_score", 0), 1),
                }
            return {
                "personality": personality,
                "total_matches": 0,
                "wins": 0,
                "win_rate": 0,
                "avg_accuracy": 0,
                "avg_score": 0,
            }
        except Exception as e:
            logger.warning("Failed to get agent stats from MongoDB: %s", e)
            return {"personality": personality, "total_matches": 0, "wins": 0,
                    "win_rate": 0, "avg_accuracy": 0, "avg_score": 0}

    def get_leaderboard(self) -> list[dict]:
        """Get agent rankings by win rate."""
        try:
            pipeline = [
                {"$match": {"state": "completed"}},
                {"$facet": {
                    "red_stats": [
                        {"$group": {
                            "_id": "$agents.red.personality",
                            "total": {"$sum": 1},
                            "wins": {"$sum": {"$cond": [{"$eq": ["$winner", "red"]}, 1, 0]}},
                            "avg_accuracy": {"$avg": {"$ifNull": ["$prediction_accuracy.red", 0]}},
                        }},
                    ],
                    "blue_stats": [
                        {"$group": {
                            "_id": "$agents.blue.personality",
                            "total": {"$sum": 1},
                            "wins": {"$sum": {"$cond": [{"$eq": ["$winner", "blue"]}, 1, 0]}},
                            "avg_accuracy": {"$avg": {"$ifNull": ["$prediction_accuracy.blue", 0]}},
                        }},
                    ],
                }},
            ]
            results = list(self._matches.aggregate(pipeline))
            if not results:
                return []

            # Merge red and blue stats by personality
            combined: dict[str, dict] = {}
            for r in results[0].get("red_stats", []):
                p = r["_id"]
                if p not in combined:
                    combined[p] = {"personality": p, "total_matches": 0, "wins": 0,
                                   "accuracy_sum": 0, "accuracy_count": 0}
                combined[p]["total_matches"] += r["total"]
                combined[p]["wins"] += r["wins"]
                combined[p]["accuracy_sum"] += r["avg_accuracy"] * r["total"]
                combined[p]["accuracy_count"] += r["total"]

            for r in results[0].get("blue_stats", []):
                p = r["_id"]
                if p not in combined:
                    combined[p] = {"personality": p, "total_matches": 0, "wins": 0,
                                   "accuracy_sum": 0, "accuracy_count": 0}
                combined[p]["total_matches"] += r["total"]
                combined[p]["wins"] += r["wins"]
                combined[p]["accuracy_sum"] += r["avg_accuracy"] * r["total"]
                combined[p]["accuracy_count"] += r["total"]

            leaderboard = []
            for p, stats in combined.items():
                total = stats["total_matches"]
                win_rate = stats["wins"] / total if total > 0 else 0
                avg_acc = stats["accuracy_sum"] / stats["accuracy_count"] if stats["accuracy_count"] > 0 else 0
                leaderboard.append({
                    "personality": p,
                    "total_matches": total,
                    "wins": stats["wins"],
                    "win_rate": round(win_rate, 3),
                    "avg_accuracy": round(avg_acc, 3),
                })

            leaderboard.sort(key=lambda x: x["win_rate"], reverse=True)
            return leaderboard
        except Exception as e:
            logger.warning("Failed to get leaderboard from MongoDB: %s", e)
            return []

    def get_recent_matches(self, limit: int = 20) -> list[dict]:
        """Get recent completed matches."""
        try:
            cursor = self._matches.find(
                {"state": "completed"},
                {"_id": 0, "rounds": 0},
            ).sort("ended_at", -1).limit(limit)
            return list(cursor)
        except Exception as e:
            logger.warning("Failed to get recent matches from MongoDB: %s", e)
            return []


class NoOpMongoClient:
    """No-op client when MongoDB is not configured."""

    def close(self):
        pass

    def verify_connectivity(self) -> bool:
        return False

    def init_indexes(self) -> None:
        pass

    def store_match(self, match_data: dict) -> None:
        pass

    def store_round(self, match_id: str, round_data: dict) -> None:
        pass

    def finalize_match(self, match_id: str, result_data: dict) -> None:
        pass

    def get_match(self, match_id: str) -> Optional[dict]:
        return None

    def get_match_replay(self, match_id: str) -> Optional[dict]:
        return None

    def get_agent_stats(self, personality: str) -> dict:
        return {"personality": personality, "total_matches": 0, "wins": 0,
                "win_rate": 0, "avg_accuracy": 0, "avg_score": 0}

    def get_leaderboard(self) -> list[dict]:
        return []

    def get_recent_matches(self, limit: int = 20) -> list[dict]:
        return []


def get_mongodb_client() -> MongoDBClient | NoOpMongoClient:
    """Get or create the MongoDB client singleton. Returns NoOp if not configured."""
    global _client_instance
    if _client_instance is not None:
        return _client_instance

    uri = os.getenv("MONGODB_URI", "")
    if not uri:
        logger.warning("MONGODB_URI not set -- MongoDB integration disabled, using no-op client")
        _client_instance = NoOpMongoClient()
        return _client_instance

    _client_instance = MongoDBClient(uri=uri)
    return _client_instance
