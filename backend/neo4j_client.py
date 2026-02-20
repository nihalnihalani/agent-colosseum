"""Neo4j strategy graph integration with graceful fallback."""

from __future__ import annotations

import logging
import os
from typing import Any, Optional

logger = logging.getLogger(__name__)

_client_instance: Optional["Neo4jClient"] = None


class Neo4jClient:
    """Neo4j AuraDB client with connection pooling and graceful fallback."""

    def __init__(self, uri: str, user: str, password: str):
        from neo4j import AsyncGraphDatabase

        self._driver = AsyncGraphDatabase.driver(uri, auth=(user, password))
        self._initialized = False
        logger.info("Neo4j client initialized: %s", uri)

    async def close(self):
        if self._driver:
            await self._driver.close()

    async def verify_connectivity(self) -> bool:
        try:
            await self._driver.verify_connectivity()
            self._initialized = True
            return True
        except Exception as e:
            logger.warning("Neo4j connectivity check failed: %s", e)
            return False

    async def store_round(self, match_id: str, round_data: dict) -> None:
        """Store moves, predictions, outcomes as graph nodes and relationships."""
        try:
            async with self._driver.session() as session:
                await session.run(
                    """
                    MERGE (m:Match {id: $match_id})
                    MERGE (r:Round {id: $round_id})
                    SET r.number = $round, r.game_state_hash = $state_hash
                    MERGE (m)-[:HAS_ROUND]->(r)

                    MERGE (redMove:Move {id: $red_move_id})
                    SET redMove.type = $red_move_type,
                        redMove.target = $red_target,
                        redMove.amount = $red_amount
                    MERGE (r)-[:RED_MOVED]->(redMove)

                    MERGE (blueMove:Move {id: $blue_move_id})
                    SET blueMove.type = $blue_move_type,
                        blueMove.target = $blue_target,
                        blueMove.amount = $blue_amount
                    MERGE (r)-[:BLUE_MOVED]->(blueMove)

                    WITH r
                    UNWIND $predictions AS pred
                    MERGE (p:Prediction {id: pred.id})
                    SET p.opponent_move = pred.opponentMove,
                        p.confidence = pred.confidence,
                        p.was_correct = pred.wasCorrect,
                        p.agent = pred.agent
                    MERGE (p)-[:FOR_ROUND]->(r)
                    """,
                    match_id=match_id,
                    round=round_data["round"],
                    round_id=f"{match_id}_round_{round_data['round']}",
                    red_move_id=f"{match_id}_round_{round_data['round']}_red",
                    blue_move_id=f"{match_id}_round_{round_data['round']}_blue",
                    state_hash=round_data.get("state_hash", ""),
                    red_move_type=round_data["red_move"]["type"],
                    red_target=round_data["red_move"].get("target", ""),
                    red_amount=round_data["red_move"].get("amount", 0),
                    blue_move_type=round_data["blue_move"]["type"],
                    blue_target=round_data["blue_move"].get("target", ""),
                    blue_amount=round_data["blue_move"].get("amount", 0),
                    predictions=[
                        {**p, "agent": "red", "id": f"{match_id}_round_{round_data['round']}_red_pred_{i}"}
                        for i, p in enumerate(round_data.get("red_predictions", []))
                    ]
                    + [
                        {**p, "agent": "blue", "id": f"{match_id}_round_{round_data['round']}_blue_pred_{i}"}
                        for i, p in enumerate(round_data.get("blue_predictions", []))
                    ],
                )
        except Exception as e:
            logger.warning("Failed to store round in Neo4j: %s", e)

    async def get_counter_strategy(self, opponent_pattern: str) -> list[dict]:
        """Find the best counter when opponent opens with a given move type."""
        try:
            async with self._driver.session() as session:
                result = await session.run(
                    """
                    MATCH (m:Match)-[:HAS_ROUND]->(r:Round {number: 1})
                    MATCH (r)-[:BLUE_MOVED]->(oppMove:Move {type: $pattern})
                    MATCH (r)-[:RED_MOVED]->(myMove:Move)
                    WITH myMove.type AS counter,
                         count(*) AS times_used
                    ORDER BY times_used DESC
                    LIMIT 3
                    RETURN counter, times_used
                    """,
                    pattern=opponent_pattern,
                )
                records = await result.data()
                return records
        except Exception as e:
            logger.warning("Neo4j counter strategy query failed: %s", e)
            return []

    async def get_bluff_detection(self, opponent_history: list[str]) -> list[dict]:
        """Detect the most common 3-move sequences in opponent play."""
        try:
            async with self._driver.session() as session:
                result = await session.run(
                    """
                    MATCH (m:Match)-[:HAS_ROUND]->(r1:Round)
                    MATCH (m)-[:HAS_ROUND]->(r2:Round)
                    MATCH (m)-[:HAS_ROUND]->(r3:Round)
                    MATCH (r1)-[:BLUE_MOVED]->(m1:Move)
                    MATCH (r2)-[:BLUE_MOVED]->(m2:Move)
                    MATCH (r3)-[:BLUE_MOVED]->(m3:Move)
                    WHERE r2.number = r1.number + 1
                      AND r3.number = r2.number + 1
                    RETURN m1.type + ' -> ' + m2.type + ' -> ' + m3.type AS pattern,
                           count(*) AS occurrences
                    ORDER BY occurrences DESC
                    LIMIT 5
                    """
                )
                records = await result.data()
                return records
        except Exception as e:
            logger.warning("Neo4j bluff detection query failed: %s", e)
            return []

    async def get_prediction_accuracy(self, agent_id: str) -> list[dict]:
        """Get prediction accuracy breakdown by opponent strategy."""
        try:
            async with self._driver.session() as session:
                result = await session.run(
                    """
                    MATCH (p:Prediction {agent: $agent_id})-[:FOR_ROUND]->(r:Round)
                    WITH p.opponent_move AS predicted_move,
                         count(*) AS total_predictions,
                         sum(CASE WHEN p.was_correct THEN 1 ELSE 0 END) AS correct
                    RETURN predicted_move,
                           total_predictions,
                           correct,
                           toFloat(correct) / total_predictions AS accuracy
                    ORDER BY accuracy DESC
                    """,
                    agent_id=agent_id,
                )
                records = await result.data()
                return records
        except Exception as e:
            logger.warning("Neo4j prediction accuracy query failed: %s", e)
            return []

    # ------------------------------------------------------------------
    # Strategy relationships (BEATS / LOSES_TO)
    # ------------------------------------------------------------------

    async def store_strategy_relationship(
        self, winner_strategy: str, loser_strategy: str, match_id: str = ""
    ) -> None:
        """Record that winner_strategy beat loser_strategy, creating Strategy nodes and edges."""
        try:
            async with self._driver.session() as session:
                await session.run(
                    """
                    MERGE (w:Strategy {name: $winner})
                    MERGE (l:Strategy {name: $loser})
                    CREATE (w)-[:BEATS {match_id: $match_id, ts: timestamp()}]->(l)
                    CREATE (l)-[:LOSES_TO {match_id: $match_id, ts: timestamp()}]->(w)
                    SET w.wins = coalesce(w.wins, 0) + 1,
                        l.losses = coalesce(l.losses, 0) + 1
                    """,
                    winner=winner_strategy,
                    loser=loser_strategy,
                    match_id=match_id,
                )
        except Exception as e:
            logger.warning("Failed to store strategy relationship: %s", e)

    async def get_strategy_evolution(self, agent_id: str) -> list[dict]:
        """Return the sequence of strategies used by an agent over time."""
        try:
            async with self._driver.session() as session:
                result = await session.run(
                    """
                    MATCH (m:Match)-[:HAS_ROUND]->(r:Round)
                    MATCH (r)-[rel:RED_MOVED|BLUE_MOVED]->(mv:Move)
                    WHERE (type(rel) = 'RED_MOVED' AND $agent_id = 'red')
                       OR (type(rel) = 'BLUE_MOVED' AND $agent_id = 'blue')
                    MATCH (p:Prediction {agent: $agent_id})-[:FOR_ROUND]->(r)
                    RETURN m.id AS match_id,
                           r.number AS round_number,
                           mv.type AS strategy,
                           p.was_correct AS prediction_correct,
                           p.confidence AS confidence
                    ORDER BY m.id, r.number
                    """,
                    agent_id=agent_id,
                )
                records = await result.data()
                return records
        except Exception as e:
            logger.warning("Neo4j strategy evolution query failed: %s", e)
            return []

    async def get_win_matrix(self) -> list[dict]:
        """Get personality vs personality win/loss matrix across all matches."""
        try:
            async with self._driver.session() as session:
                result = await session.run(
                    """
                    MATCH (w:Strategy)-[b:BEATS]->(l:Strategy)
                    RETURN w.name AS winner_strategy,
                           l.name AS loser_strategy,
                           count(b) AS wins
                    ORDER BY wins DESC
                    """
                )
                records = await result.data()
                return records
        except Exception as e:
            logger.warning("Neo4j win matrix query failed: %s", e)
            return []

    # ------------------------------------------------------------------
    # Vector similarity search
    # ------------------------------------------------------------------

    async def find_similar_states(self, embedding: list[float], k: int = 5) -> list[dict]:
        """Find the k most similar game states using vector index."""
        try:
            async with self._driver.session() as session:
                result = await session.run(
                    """
                    CALL db.index.vector.queryNodes('game_state_embedding', $k, $embedding)
                    YIELD node, score
                    RETURN node.game_state_hash AS state_hash,
                           node.number AS round_number,
                           score
                    ORDER BY score DESC
                    """,
                    k=k,
                    embedding=embedding,
                )
                records = await result.data()
                return records
        except Exception as e:
            logger.warning("Neo4j vector similarity query failed: %s", e)
            return []

    # ------------------------------------------------------------------
    # Negotiation game queries
    # ------------------------------------------------------------------

    async def store_negotiation_round(self, match_id: str, round_data: dict) -> None:
        """Store a negotiation round with offers and outcomes."""
        try:
            async with self._driver.session() as session:
                await session.run(
                    """
                    MERGE (m:Match {id: $match_id})
                    SET m.game_type = 'negotiation'
                    MERGE (r:Round {id: $round_id})
                    SET r.number = $round, r.game_state_hash = $state_hash
                    MERGE (m)-[:HAS_ROUND]->(r)

                    MERGE (redMove:Move {id: $red_move_id})
                    SET redMove.type = $red_type,
                        redMove.price = $red_price,
                        redMove.terms = $red_terms
                    MERGE (r)-[:RED_MOVED]->(redMove)

                    MERGE (blueMove:Move {id: $blue_move_id})
                    SET blueMove.type = $blue_type,
                        blueMove.price = $blue_price,
                        blueMove.terms = $blue_terms
                    MERGE (r)-[:BLUE_MOVED]->(blueMove)

                    WITH r
                    UNWIND $predictions AS pred
                    MERGE (p:Prediction {id: pred.id})
                    SET p.opponent_move = pred.opponentMove,
                        p.confidence = pred.confidence,
                        p.was_correct = pred.wasCorrect,
                        p.agent = pred.agent
                    MERGE (p)-[:FOR_ROUND]->(r)
                    """,
                    match_id=match_id,
                    round=round_data["round"],
                    round_id=f"{match_id}_round_{round_data['round']}",
                    red_move_id=f"{match_id}_round_{round_data['round']}_red",
                    blue_move_id=f"{match_id}_round_{round_data['round']}_blue",
                    state_hash=round_data.get("state_hash", ""),
                    red_type=round_data["red_move"]["type"],
                    red_price=round_data["red_move"].get("price", 0),
                    red_terms=round_data["red_move"].get("terms", ""),
                    blue_type=round_data["blue_move"]["type"],
                    blue_price=round_data["blue_move"].get("price", 0),
                    blue_terms=round_data["blue_move"].get("terms", ""),
                    predictions=[
                        {**p, "agent": "red", "id": f"{match_id}_round_{round_data['round']}_red_pred_{i}"}
                        for i, p in enumerate(round_data.get("red_predictions", []))
                    ] + [
                        {**p, "agent": "blue", "id": f"{match_id}_round_{round_data['round']}_blue_pred_{i}"}
                        for i, p in enumerate(round_data.get("blue_predictions", []))
                    ],
                )
        except Exception as e:
            logger.warning("Failed to store negotiation round in Neo4j: %s", e)

    async def get_negotiation_patterns(self, agent_id: str) -> list[dict]:
        """Analyze negotiation offer patterns — how an agent's offers evolve."""
        try:
            async with self._driver.session() as session:
                result = await session.run(
                    """
                    MATCH (m:Match {game_type: 'negotiation'})-[:HAS_ROUND]->(r:Round)
                    MATCH (r)-[rel:RED_MOVED|BLUE_MOVED]->(mv:Move)
                    WHERE (type(rel) = 'RED_MOVED' AND $agent_id = 'red')
                       OR (type(rel) = 'BLUE_MOVED' AND $agent_id = 'blue')
                    RETURN m.id AS match_id,
                           r.number AS round_number,
                           mv.type AS move_type,
                           mv.price AS price
                    ORDER BY m.id, r.number
                    """,
                    agent_id=agent_id,
                )
                records = await result.data()
                return records
        except Exception as e:
            logger.warning("Neo4j negotiation patterns query failed: %s", e)
            return []

    # ------------------------------------------------------------------
    # Auction game queries
    # ------------------------------------------------------------------

    async def store_auction_round(self, match_id: str, round_data: dict) -> None:
        """Store an auction round with bids and item outcomes."""
        try:
            async with self._driver.session() as session:
                await session.run(
                    """
                    MERGE (m:Match {id: $match_id})
                    SET m.game_type = 'auction'
                    MERGE (r:Round {id: $round_id})
                    SET r.number = $round, r.item_name = $item_name,
                        r.game_state_hash = $state_hash
                    MERGE (m)-[:HAS_ROUND]->(r)

                    MERGE (redBid:Move {id: $red_move_id})
                    SET redBid.type = $red_type,
                        redBid.amount = $red_amount
                    MERGE (r)-[:RED_MOVED]->(redBid)

                    MERGE (blueBid:Move {id: $blue_move_id})
                    SET blueBid.type = $blue_type,
                        blueBid.amount = $blue_amount
                    MERGE (r)-[:BLUE_MOVED]->(blueBid)

                    WITH r
                    UNWIND $predictions AS pred
                    MERGE (p:Prediction {id: pred.id})
                    SET p.opponent_move = pred.opponentMove,
                        p.confidence = pred.confidence,
                        p.was_correct = pred.wasCorrect,
                        p.agent = pred.agent
                    MERGE (p)-[:FOR_ROUND]->(r)
                    """,
                    match_id=match_id,
                    round=round_data["round"],
                    round_id=f"{match_id}_round_{round_data['round']}",
                    red_move_id=f"{match_id}_round_{round_data['round']}_red",
                    blue_move_id=f"{match_id}_round_{round_data['round']}_blue",
                    state_hash=round_data.get("state_hash", ""),
                    item_name=round_data.get("item_name", ""),
                    red_type=round_data["red_move"]["type"],
                    red_amount=round_data["red_move"].get("amount", 0),
                    blue_type=round_data["blue_move"]["type"],
                    blue_amount=round_data["blue_move"].get("amount", 0),
                    predictions=[
                        {**p, "agent": "red", "id": f"{match_id}_round_{round_data['round']}_red_pred_{i}"}
                        for i, p in enumerate(round_data.get("red_predictions", []))
                    ] + [
                        {**p, "agent": "blue", "id": f"{match_id}_round_{round_data['round']}_blue_pred_{i}"}
                        for i, p in enumerate(round_data.get("blue_predictions", []))
                    ],
                )
        except Exception as e:
            logger.warning("Failed to store auction round in Neo4j: %s", e)

    async def get_auction_bid_history(self, agent_id: str) -> list[dict]:
        """Get bidding history for an agent across auction matches."""
        try:
            async with self._driver.session() as session:
                result = await session.run(
                    """
                    MATCH (m:Match {game_type: 'auction'})-[:HAS_ROUND]->(r:Round)
                    MATCH (r)-[rel:RED_MOVED|BLUE_MOVED]->(mv:Move)
                    WHERE (type(rel) = 'RED_MOVED' AND $agent_id = 'red')
                       OR (type(rel) = 'BLUE_MOVED' AND $agent_id = 'blue')
                    RETURN m.id AS match_id,
                           r.number AS round_number,
                           r.item_name AS item,
                           mv.type AS move_type,
                           mv.amount AS bid_amount
                    ORDER BY m.id, r.number
                    """,
                    agent_id=agent_id,
                )
                records = await result.data()
                return records
        except Exception as e:
            logger.warning("Neo4j auction bid history query failed: %s", e)
            return []

    # ------------------------------------------------------------------
    # Schema initialization
    # ------------------------------------------------------------------

    async def init_schema(self) -> None:
        """Create constraints, indexes, and optional vector index for the strategy graph."""
        try:
            async with self._driver.session() as session:
                # Uniqueness constraint on Match.id
                await session.run(
                    "CREATE CONSTRAINT match_id IF NOT EXISTS "
                    "FOR (m:Match) REQUIRE m.id IS UNIQUE"
                )
                # Index on Round.number for fast lookups
                await session.run(
                    "CREATE INDEX round_number IF NOT EXISTS "
                    "FOR (r:Round) ON (r.number)"
                )
                # Index on Move.type for strategy queries
                await session.run(
                    "CREATE INDEX move_type IF NOT EXISTS "
                    "FOR (m:Move) ON (m.type)"
                )
                # Index on Prediction.agent for accuracy queries
                await session.run(
                    "CREATE INDEX prediction_agent IF NOT EXISTS "
                    "FOR (p:Prediction) ON (p.agent)"
                )
                # Uniqueness constraint on Strategy.name
                await session.run(
                    "CREATE CONSTRAINT strategy_name IF NOT EXISTS "
                    "FOR (s:Strategy) REQUIRE s.name IS UNIQUE"
                )
                # Index on Match.game_type for game-specific queries
                await session.run(
                    "CREATE INDEX match_game_type IF NOT EXISTS "
                    "FOR (m:Match) ON (m.game_type)"
                )
                # Uniqueness constraint on Round.id
                await session.run(
                    "CREATE CONSTRAINT round_id IF NOT EXISTS "
                    "FOR (r:Round) REQUIRE r.id IS UNIQUE"
                )
                # Uniqueness constraint on Move.id
                await session.run(
                    "CREATE CONSTRAINT move_id IF NOT EXISTS "
                    "FOR (m:Move) REQUIRE m.id IS UNIQUE"
                )
                # Uniqueness constraint on Prediction.id
                await session.run(
                    "CREATE CONSTRAINT prediction_id IF NOT EXISTS "
                    "FOR (p:Prediction) REQUIRE p.id IS UNIQUE"
                )

            # Vector index — only create when NEO4J_VECTOR_DIMENSIONS is configured
            vector_dims = os.getenv("NEO4J_VECTOR_DIMENSIONS", "")
            if vector_dims:
                try:
                    dims = int(vector_dims)
                    async with self._driver.session() as session:
                        await session.run(
                            f"""
                            CREATE VECTOR INDEX game_state_embedding IF NOT EXISTS
                            FOR (r:Round)
                            ON (r.embedding)
                            OPTIONS {{
                                indexConfig: {{
                                    `vector.dimensions`: {dims},
                                    `vector.similarity_function`: 'cosine'
                                }}
                            }}
                            """
                        )
                    logger.info("Neo4j vector index created (dims=%d)", dims)
                except Exception as e:
                    logger.warning("Failed to create vector index: %s", e)

            logger.info("Neo4j schema initialized")
        except Exception as e:
            logger.warning("Failed to initialize Neo4j schema: %s", e)


class NoOpNeo4jClient:
    """No-op client when Neo4j is not configured."""

    async def close(self):
        pass

    async def verify_connectivity(self) -> bool:
        return False

    async def init_schema(self) -> None:
        pass

    async def store_round(self, match_id: str, round_data: dict) -> None:
        pass

    async def get_counter_strategy(self, opponent_pattern: str) -> list[dict]:
        return []

    async def get_bluff_detection(self, opponent_history: list[str]) -> list[dict]:
        return []

    async def get_prediction_accuracy(self, agent_id: str) -> list[dict]:
        return []

    async def store_strategy_relationship(
        self, winner_strategy: str, loser_strategy: str, match_id: str = ""
    ) -> None:
        pass

    async def get_strategy_evolution(self, agent_id: str) -> list[dict]:
        return []

    async def get_win_matrix(self) -> list[dict]:
        return []

    async def find_similar_states(self, embedding: list[float], k: int = 5) -> list[dict]:
        return []

    async def store_negotiation_round(self, match_id: str, round_data: dict) -> None:
        pass

    async def get_negotiation_patterns(self, agent_id: str) -> list[dict]:
        return []

    async def store_auction_round(self, match_id: str, round_data: dict) -> None:
        pass

    async def get_auction_bid_history(self, agent_id: str) -> list[dict]:
        return []


def get_neo4j_client() -> Neo4jClient | NoOpNeo4jClient:
    """Get or create the Neo4j client singleton. Returns NoOp if not configured."""
    global _client_instance
    if _client_instance is not None:
        return _client_instance

    uri = os.getenv("NEO4J_URI", "")
    if not uri:
        logger.warning("NEO4J_URI not set — Neo4j integration disabled, using no-op client")
        _client_instance = NoOpNeo4jClient()
        return _client_instance

    user = os.getenv("NEO4J_USER", "neo4j")
    password = os.getenv("NEO4J_PASSWORD", "")

    _client_instance = Neo4jClient(uri=uri, user=user, password=password)
    return _client_instance
