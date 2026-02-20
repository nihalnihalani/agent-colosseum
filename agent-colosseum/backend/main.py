"""FastAPI server — WebSocket match streaming + REST endpoints."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import uuid
from collections import OrderedDict
from contextlib import asynccontextmanager
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import Literal
from pydantic import BaseModel, Field

from backend.match import Match, MatchConfig

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Optional: Datadog LLM Observability
# ---------------------------------------------------------------------------
try:
    from backend.datadog_metrics import setup_llmobs
    setup_llmobs()
except Exception:
    pass

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

MAX_MATCHES = 100


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage startup and shutdown lifecycle."""
    # --- startup ---
    # Neo4j
    try:
        from backend.neo4j_client import get_neo4j_client

        client = get_neo4j_client()
        if await client.verify_connectivity():
            await client.init_schema()
            logger.info("Neo4j connected and schema initialized")
    except Exception as e:
        logger.info("Neo4j not available: %s", e)

    # MongoDB
    try:
        from backend.mongodb_client import get_mongodb_client

        mongo = get_mongodb_client()
        if mongo.verify_connectivity():
            mongo.init_indexes()
            logger.info("MongoDB connected and indexes initialized")
    except Exception as e:
        logger.info("MongoDB not available: %s", e)

    yield

    # --- shutdown ---
    try:
        from backend.neo4j_client import get_neo4j_client

        client = get_neo4j_client()
        await client.close()
    except Exception:
        pass

    try:
        from backend.mongodb_client import get_mongodb_client

        mongo = get_mongodb_client()
        mongo.close()
    except Exception:
        pass


origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")

app = FastAPI(title="Agent Colosseum", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory match state store (fine for hackathon / single-server)
_matches: OrderedDict[str, dict[str, Any]] = OrderedDict()


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------

VALID_GAME_TYPES = ("resource_wars", "negotiation", "auction", "gpu_bidding")


class CreateMatchRequest(BaseModel):
    game_type: Literal["resource_wars", "negotiation", "auction", "gpu_bidding"] = "resource_wars"
    red_personality: str = "aggressive"
    blue_personality: str = "defensive"
    rounds: int = Field(default=10, ge=1, le=50)


class CreateMatchResponse(BaseModel):
    match_id: str


@app.post("/api/match/create", response_model=CreateMatchResponse)
async def create_match(req: CreateMatchRequest):
    """Create a new match and return its ID."""
    match_id = f"match_{uuid.uuid4().hex[:8]}"
    if len(_matches) >= MAX_MATCHES:
        _matches.popitem(last=False)
    _matches[match_id] = {
        "config": {
            "match_id": match_id,
            "game_type": req.game_type,
            "red_personality": req.red_personality,
            "blue_personality": req.blue_personality,
            "total_rounds": req.rounds,
        },
        "state": "created",
        "events": [],
    }
    logger.info("Match created: %s", match_id)
    return CreateMatchResponse(match_id=match_id)


@app.get("/api/match/{match_id}/state")
async def get_match_state(match_id: str):
    """Return the current state of a match."""
    match_data = _matches.get(match_id)
    if not match_data:
        raise HTTPException(status_code=404, detail="Match not found")

    # Return last known state from events
    events = match_data.get("events", [])
    last_state = {}
    for evt in reversed(events):
        if evt.get("type") in ("round_end", "match_end"):
            last_state = evt
            break

    return {
        "matchId": match_id,
        "state": match_data["state"],
        "config": match_data["config"],
        "lastEvent": last_state,
        "eventCount": len(events),
    }


@app.get("/api/matches")
async def list_matches():
    """List all recent matches."""
    matches = []
    for mid, data in _matches.items():
        matches.append({
            "matchId": mid,
            "state": data.get("state", "unknown"),
            "gameType": data.get("config", {}).get("game_type", "resource_wars"),
            "redPersonality": data.get("config", {}).get("red_personality", ""),
            "bluePersonality": data.get("config", {}).get("blue_personality", ""),
            "rounds": data.get("config", {}).get("total_rounds", 10),
            "eventCount": len(data.get("events", [])),
        })
    return {"matches": matches}


@app.get("/api/game-types")
async def game_types():
    """Return available game types and their configurations."""
    return {
        "gameTypes": [
            {
                "id": "resource_wars",
                "name": "Resource Wars",
                "description": "10-round strategic resource capture. Agents bid, bluff, and counter for control of 3 resource pools.",
                "defaultRounds": 10,
            },
            {
                "id": "negotiation",
                "name": "The Negotiation",
                "description": "5-round sequential offer negotiation. One agent sells, the other buys. Hidden walkaway prices determine scoring.",
                "defaultRounds": 5,
            },
            {
                "id": "auction",
                "name": "The Auction",
                "description": "8-item sealed-bid auction. Each agent starts with 1000 credits and hidden valuations. Highest bid wins.",
                "defaultRounds": 8,
            },
            {
                "id": "gpu_bidding",
                "name": "GPU Marketplace",
                "description": "Neocloud GPU resource bidding. User optimizes for cost, Neocloud optimizes for revenue. Dynamic surge pricing based on demand.",
                "defaultRounds": 10,
            },
        ]
    }


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "mock_mode": os.getenv("MOCK_MODE", "true").lower() == "true",
    }


# ---------------------------------------------------------------------------
# Expanded REST APIs — MongoDB + Neo4j
# ---------------------------------------------------------------------------

@app.get("/api/match/{match_id}/replay")
async def get_match_replay(match_id: str):
    """Full match events for replay."""
    # Try in-memory first
    match_data = _matches.get(match_id)
    if match_data:
        return {
            "matchId": match_id,
            "config": match_data.get("config", {}),
            "events": match_data.get("events", []),
            "state": match_data.get("state", "unknown"),
        }
    # Fall back to MongoDB
    try:
        from backend.mongodb_client import get_mongodb_client
        mongo = get_mongodb_client()
        doc = mongo.get_match_replay(match_id)
        if doc:
            return doc
    except Exception:
        pass
    raise HTTPException(status_code=404, detail="Match not found")


@app.get("/api/stats/agent/{personality}")
async def get_agent_stats(personality: str):
    """Performance stats for an agent personality from MongoDB."""
    try:
        from backend.mongodb_client import get_mongodb_client
        mongo = get_mongodb_client()
        return mongo.get_agent_stats(personality)
    except Exception as e:
        logger.warning("Failed to get agent stats: %s", e)
        return {"personality": personality, "total_matches": 0, "wins": 0,
                "win_rate": 0, "avg_accuracy": 0, "avg_score": 0}


@app.get("/api/stats/leaderboard")
async def get_leaderboard():
    """Agent rankings by win rate from MongoDB."""
    try:
        from backend.mongodb_client import get_mongodb_client
        mongo = get_mongodb_client()
        return {"leaderboard": mongo.get_leaderboard()}
    except Exception as e:
        logger.warning("Failed to get leaderboard: %s", e)
        return {"leaderboard": []}


@app.get("/api/neo4j/patterns/{agent_id}")
async def get_neo4j_patterns(agent_id: str):
    """Strategy patterns from Neo4j graph."""
    if agent_id not in ("red", "blue"):
        raise HTTPException(status_code=400, detail="agent_id must be 'red' or 'blue'")
    try:
        from backend.neo4j_client import get_neo4j_client
        client = get_neo4j_client()
        accuracy = await client.get_prediction_accuracy(agent_id)
        bluff = await client.get_bluff_detection([])
        return {
            "agent_id": agent_id,
            "prediction_accuracy": accuracy,
            "bluff_patterns": bluff,
        }
    except Exception as e:
        logger.warning("Failed to get Neo4j patterns: %s", e)
        return {"agent_id": agent_id, "prediction_accuracy": [], "bluff_patterns": []}


@app.get("/api/neo4j/counter-strategy")
async def get_counter_strategy(pattern: str = "aggressive_bid"):
    """Optimal counter-strategies from Neo4j graph."""
    try:
        from backend.neo4j_client import get_neo4j_client
        client = get_neo4j_client()
        counters = await client.get_counter_strategy(pattern)
        return {"pattern": pattern, "counters": counters}
    except Exception as e:
        logger.warning("Failed to get counter strategy: %s", e)
        return {"pattern": pattern, "counters": []}


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------

@app.websocket("/ws/match/{match_id}")
async def websocket_match(websocket: WebSocket, match_id: str):
    """WebSocket endpoint for real-time match streaming.

    Protocol:
    1. Client connects
    2. Client sends: {"type": "start_match", ...config...}
    3. Server streams match events until match_end
    """
    await websocket.accept()
    logger.info("WebSocket connected for match: %s", match_id)

    try:
        # Wait for start_match message from client
        start_msg = await asyncio.wait_for(websocket.receive_json(), timeout=30.0)
        logger.info("Received start message: %s", start_msg)

        if start_msg.get("type") != "start_match":
            await websocket.send_json({"type": "error", "message": "Expected start_match message"})
            await websocket.close()
            return

        # Build match config from client message or stored config
        config = MatchConfig(
            match_id=match_id,
            game_type=start_msg.get("gameType", "resource_wars"),
            red_personality=start_msg.get("redPersonality", "aggressive"),
            blue_personality=start_msg.get("bluePersonality", "defensive"),
            total_rounds=start_msg.get("rounds", 10),
        )

        # Store in memory
        if len(_matches) >= MAX_MATCHES:
            _matches.popitem(last=False)
        _matches[match_id] = {
            "config": {
                "match_id": match_id,
                "game_type": config.game_type,
                "red_personality": config.red_personality,
                "blue_personality": config.blue_personality,
                "total_rounds": config.total_rounds,
            },
            "state": "running",
            "events": [],
        }

        # Run the match and stream events
        match = Match(config=config)
        async for event in match.run_match():
            await websocket.send_json(event)
            # Store event for replay
            if match_id in _matches:
                _matches[match_id]["events"].append(event)

        # Mark as completed
        if match_id in _matches:
            _matches[match_id]["state"] = "completed"

        logger.info("Match %s completed", match_id)

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected for match: %s", match_id)
        if match_id in _matches:
            _matches[match_id]["state"] = "disconnected"
    except asyncio.TimeoutError:
        logger.warning("Timeout waiting for start_match message on %s", match_id)
        await websocket.send_json({"type": "error", "message": "Timeout waiting for start command"})
        await websocket.close()
    except Exception as e:
        logger.error("Match %s error: %s", match_id, e, exc_info=True)
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass


# ---------------------------------------------------------------------------
# AG-UI protocol endpoint (CopilotKit / arena commentator)
# ---------------------------------------------------------------------------

try:
    from backend.copilotkit_runtime import router as agui_router, set_match_store
    app.include_router(agui_router)
    set_match_store(_matches)
    logger.info("AG-UI agent endpoint mounted at /agent")
except Exception as e:
    logger.info("AG-UI runtime not available: %s", e)


