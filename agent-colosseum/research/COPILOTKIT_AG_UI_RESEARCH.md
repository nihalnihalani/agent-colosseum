# CopilotKit AG-UI Protocol: Comprehensive Research for Agent Colosseum

> Research conducted for AWS x Datadog Generative AI Agents Hackathon
> Target: Prize-winning CopilotKit integration for Agent Colosseum

---

## Table of Contents

1. [What AG-UI Actually Is (And Why It Matters)](#1-what-ag-ui-actually-is)
2. [The 17+ AG-UI Event Types](#2-ag-ui-event-types)
3. [Most Impressive AG-UI Features (With Code)](#3-impressive-features)
4. [CopilotKit Python SDK Reference](#4-python-sdk)
5. [Best Demo Projects & Architecture Patterns](#5-demo-projects)
6. [Application to Agent Colosseum](#6-agent-colosseum-application)
7. [What Prize-Winning CopilotKit Integrations Look Like](#7-prize-winning)
8. [Self-Hosted FastAPI Setup](#8-self-hosted-setup)
9. [Concrete Implementation Plan](#9-implementation-plan)

---

## 1. What AG-UI Actually Is (And Why It Matters) <a name="1-what-ag-ui-actually-is"></a>

### The Real Problem AG-UI Solves

AG-UI is NOT just "streaming events." It solves the fundamental disconnect between AI agent backends and user-facing frontends. Here is the specific problem:

**Without AG-UI:** Your agent runs in Python/LangGraph. Your UI is in React. To connect them, you must:
- Build custom WebSocket handlers
- Invent your own event schema
- Manually serialize/deserialize state
- Build your own state synchronization logic
- Handle reconnection, error states, partial updates
- Implement your own tool-call protocol between frontend and backend

**With AG-UI:** One standardized protocol handles ALL of this:
- 17+ well-defined event types covering every agent-UI interaction pattern
- Bidirectional state sync via JSON Patch (RFC 6902) -- efficient delta updates
- Frontend tool execution -- agents can call functions that run IN THE BROWSER
- Human-in-the-loop interrupts -- agents can pause and ask for user input
- Server-Sent Events (SSE) transport -- no WebSocket complexity, works over HTTP

### What Makes AG-UI Different From REST or WebSockets

| Feature | REST API | WebSocket | AG-UI |
|---------|----------|-----------|-------|
| Streaming tokens | No (polling) | Yes (custom) | Yes (standard events) |
| State sync | Manual | Manual | Built-in (snapshot + delta) |
| Frontend tool calls | Not possible | Custom protocol | Standard event flow |
| Human-in-the-loop | Custom implementation | Custom | Built-in interrupt protocol |
| Agent lifecycle | No visibility | Custom events | RunStarted/StepStarted/etc. |
| Reconnection | N/A | Must implement | Snapshot resync built-in |
| Framework agnostic | Yes | Yes | Yes -- works with LangGraph, CrewAI, ADK, Pydantic AI, etc. |

### Key Architectural Insight

AG-UI turns agents from black boxes into transparent collaborators. The user can SEE what the agent is doing (via state streaming), INFLUENCE what it does (via bidirectional state + human-in-the-loop), and INTERACT with it through frontend tools (agent calls browser-side functions).

### Adoption

AG-UI has first-party support from:
- Microsoft Agent Framework
- Google ADK
- AWS Strands Agents
- Pydantic AI, LlamaIndex, AG2, Mastra, Agno
- LangGraph and CrewAI (partnerships)
- AWS Bedrock Agents, OpenAI Agent SDK (in progress)

---

## 2. The 17+ AG-UI Event Types <a name="2-ag-ui-event-types"></a>

All events stream as JSON over HTTP/SSE. Every event has a `type` field and optional `timestamp`.

### Category 1: Lifecycle Events (5 types)

| Event | Purpose | Key Properties |
|-------|---------|----------------|
| `RUN_STARTED` | Agent begins execution | `threadId`, `runId` |
| `RUN_FINISHED` | Agent completes successfully | `threadId`, `runId`, `result` |
| `RUN_ERROR` | Agent fails | `message`, `code` |
| `STEP_STARTED` | Sub-task begins | `stepName` |
| `STEP_FINISHED` | Sub-task completes | `stepName` |

**Flow:** `RUN_STARTED -> (STEP_STARTED -> STEP_FINISHED)* -> RUN_FINISHED`

### Category 2: Text Message Events (4 types)

| Event | Purpose | Key Properties |
|-------|---------|----------------|
| `TEXT_MESSAGE_START` | New message begins | `messageId`, `role` |
| `TEXT_MESSAGE_CONTENT` | Token/chunk of text | `messageId`, `delta` |
| `TEXT_MESSAGE_END` | Message complete | `messageId` |
| `TEXT_MESSAGE_CHUNK` | Convenience wrapper (auto-expands) | `messageId`, `role`, `delta` |

### Category 3: Tool Call Events (5 types)

| Event | Purpose | Key Properties |
|-------|---------|----------------|
| `TOOL_CALL_START` | Tool invocation begins | `toolCallId`, `toolCallName` |
| `TOOL_CALL_ARGS` | Argument chunks stream | `toolCallId`, `delta` |
| `TOOL_CALL_END` | Arguments complete | `toolCallId` |
| `TOOL_CALL_RESULT` | Execution output | `toolCallId`, `content` |
| `TOOL_CALL_CHUNK` | Convenience wrapper | `toolCallId`, `toolCallName`, `delta` |

### Category 4: State Management Events (3 types)

| Event | Purpose | Key Properties |
|-------|---------|----------------|
| `STATE_SNAPSHOT` | Full state replacement | `snapshot` (complete JSON object) |
| `STATE_DELTA` | Incremental update | `delta` (RFC 6902 JSON Patch operations) |
| `MESSAGES_SNAPSHOT` | Chat history sync | `messages` (array) |

**JSON Patch format (RFC 6902):**
```json
[
  { "op": "replace", "path": "/agent_red/confidence", "value": 0.87 },
  { "op": "add", "path": "/predictions/-", "value": { "move": "bluff", "confidence": 0.72 } },
  { "op": "remove", "path": "/stale_prediction" }
]
```

### Category 5: Activity Events (2 types)

| Event | Purpose | Key Properties |
|-------|---------|----------------|
| `ACTIVITY_SNAPSHOT` | Full activity state | `messageId`, `activityType`, `content` |
| `ACTIVITY_DELTA` | Partial activity update | `messageId`, `activityType`, `patch` |

### Category 6: Reasoning Events (6 types)

| Event | Purpose |
|-------|---------|
| `REASONING_START` | Reasoning phase begins |
| `REASONING_END` | Reasoning phase ends |
| `REASONING_MESSAGE_START` | Visible reasoning begins |
| `REASONING_MESSAGE_CONTENT` | Reasoning token stream |
| `REASONING_MESSAGE_END` | Reasoning complete |
| `REASONING_ENCRYPTED_VALUE` | Encrypted reasoning (zero-retention) |

### Category 7: Special Events (2 types)

| Event | Purpose | Key Properties |
|-------|---------|----------------|
| `RAW` | External system events | `event`, `source` |
| `CUSTOM` | App-specific extensions | `name`, `value` |

---

## 3. Most Impressive AG-UI Features (With Code) <a name="3-impressive-features"></a>

### Feature 1: useCoAgent -- Bidirectional State Sync

This is the killer feature. The frontend and agent share a live state object. Either side can read AND write.

**Frontend (React/TypeScript):**
```typescript
import { useCoAgent } from "@copilotkit/react-core";

// Define the shared state type
type MatchState = {
  round: number;
  phase: "imagination" | "commit" | "reveal";
  agent_red: {
    predictions: Array<{ move: string; confidence: number; counter: string }>;
    chosen_move: string | null;
    score: number;
  };
  agent_blue: {
    predictions: Array<{ move: string; confidence: number; counter: string }>;
    chosen_move: string | null;
    score: number;
  };
  audience_votes: { red: number; blue: number };
};

function MatchViewer() {
  const {
    state,       // Current agent state (read)
    setState,    // Push state TO the agent (write!)
    running,     // Is the agent currently executing?
    start,       // Trigger agent execution
    stop,        // Halt execution
    run,         // Re-run agent
    nodeName,    // Current LangGraph node name
  } = useCoAgent<MatchState>({
    name: "match_agent",
    initialState: {
      round: 0,
      phase: "imagination",
      agent_red: { predictions: [], chosen_move: null, score: 0 },
      agent_blue: { predictions: [], chosen_move: null, score: 0 },
      audience_votes: { red: 0, blue: 0 },
    },
  });

  // BIDIRECTIONAL: Push audience votes TO the agent
  const handleVote = (team: "red" | "blue") => {
    setState(prev => ({
      ...prev,
      audience_votes: {
        ...prev.audience_votes,
        [team]: prev.audience_votes[team] + 1,
      }
    }));
  };

  // State updates from agent stream in automatically
  // When the Python agent calls copilotkit_emit_state(), this component re-renders

  return (
    <div>
      <p>Round: {state.round} | Phase: {state.phase}</p>
      <p>Current LangGraph node: {nodeName}</p>
      <ImaginationTree predictions={state.agent_red.predictions} />
      <ImaginationTree predictions={state.agent_blue.predictions} />
      <button onClick={() => handleVote("red")}>Vote Red</button>
      <button onClick={() => handleVote("blue")}>Vote Blue</button>
    </div>
  );
}
```

**Return values of useCoAgent:**
- `name`: string -- agent identifier
- `nodeName`: string -- current LangGraph node
- `state`: T -- current state (generic typed)
- `setState`: (newState: T | (prev: T) => T) => void -- update state (pushes to agent)
- `running`: boolean -- execution status
- `start`: () => void -- initiate agent
- `stop`: () => void -- halt agent
- `run`: (hint?: HintFunction) => void -- re-run

### Feature 2: useCoAgentStateRender -- Custom UI in Chat

Renders custom React components inside the chat panel based on agent state changes.

```typescript
import { useCoAgentStateRender } from "@copilotkit/react-core";

useCoAgentStateRender<MatchState>({
  name: "match_agent",
  render: ({ state, nodeName, status }) => {
    // Render different UI based on which LangGraph node is executing
    if (nodeName === "imagination_phase") {
      return (
        <div className="thinking-indicator">
          <p>Agents are thinking...</p>
          <MiniImaginationTree predictions={state.agent_red.predictions} />
          <MiniImaginationTree predictions={state.agent_blue.predictions} />
        </div>
      );
    }

    if (nodeName === "reveal_phase") {
      return (
        <div className="reveal-card">
          <h3>Round {state.round} Results</h3>
          <p>Red chose: {state.agent_red.chosen_move}</p>
          <p>Blue chose: {state.agent_blue.chosen_move}</p>
        </div>
      );
    }

    if (state.logs?.length > 0) {
      return <ProgressLogs logs={state.logs} />;
    }

    return null;
  },
});
```

### Feature 3: useFrontendTool -- Agent Calls Browser Functions

The agent running on the server can request execution of tools that run IN THE BROWSER. This is incredibly powerful for UI manipulation.

```typescript
import { useFrontendTool } from "@copilotkit/react-core";

// Agent can call this to highlight a move on the visualization
useFrontendTool({
  name: "highlight_prediction",
  description: "Highlight a specific prediction branch on the visualization",
  parameters: [
    { name: "agent", type: "string", description: "red or blue" },
    { name: "prediction_index", type: "number", description: "Which prediction to highlight" },
    { name: "color", type: "string", description: "Highlight color" },
  ],
  handler: ({ agent, prediction_index, color }) => {
    // This runs IN THE BROWSER
    document.querySelector(`.prediction-${agent}-${prediction_index}`)
      ?.classList.add(`highlight-${color}`);

    // Trigger animation
    triggerPulseAnimation(agent, prediction_index);

    return { status: "success", message: `Highlighted ${agent} prediction ${prediction_index}` };
  },
});

// Agent can trigger sound effects
useFrontendTool({
  name: "play_sound_effect",
  description: "Play a sound effect in the browser",
  parameters: [
    { name: "effect", type: "string", description: "collapse, correct, wrong, dramatic" },
  ],
  handler: ({ effect }) => {
    const audio = new Audio(`/sounds/${effect}.mp3`);
    audio.play();
    return { status: "played" };
  },
});

// Agent can trigger camera movements on the 3D visualization
useFrontendTool({
  name: "focus_camera",
  description: "Move the visualization camera to focus on a specific element",
  parameters: [
    { name: "target", type: "string", description: "red_tree, blue_tree, scoreboard, center" },
    { name: "zoom", type: "number", description: "Zoom level 0.5-3.0" },
  ],
  handler: ({ target, zoom }) => {
    cameraController.animateTo(target, zoom);
    return { status: "camera_moved" };
  },
});
```

**How it works under the hood:**
1. Frontend registers tools with CopilotKit (tool name, description, parameters)
2. Tool declarations are sent to the server with each request
3. The AI agent on the server decides when to call a frontend tool
4. Server sends `TOOL_CALL_START` + `TOOL_CALL_ARGS` events via SSE
5. Client receives the events, executes the handler locally
6. Client sends `TOOL_CALL_RESULT` back to the server via POST
7. Agent receives the result and continues processing

### Feature 4: Human-in-the-Loop with Interrupts

Agents can PAUSE execution and wait for user input before continuing.

**Python Backend (LangGraph):**
```python
from langgraph.types import interrupt
from copilotkit.langchain import copilotkit_customize_config

async def strategy_review_node(state: MatchState, config: RunnableConfig):
    """Agent pauses to ask the audience for strategic input."""

    # This PAUSES the agent and sends an interrupt event to the frontend
    audience_choice = interrupt(
        "The match is tied! Should Agent Red play aggressive or defensive?"
    )

    # Execution resumes here after user responds
    state["audience_strategy_hint"] = audience_choice
    return state
```

**React Frontend (handling the interrupt):**
```typescript
import { useLangGraphInterrupt } from "@copilotkit/react-core";

useLangGraphInterrupt<string>({
  render: ({ event, resolve }) => (
    <div className="interrupt-modal">
      <h3>Audience Decision Time!</h3>
      <p>{event.value}</p>
      <div className="strategy-buttons">
        <button onClick={() => resolve("aggressive")}>
          Go Aggressive!
        </button>
        <button onClick={() => resolve("defensive")}>
          Play it Safe
        </button>
      </div>
    </div>
  ),
});
```

**Flow:**
1. Agent reaches `interrupt()` call in LangGraph node
2. Execution pauses, interrupt event sent to frontend via SSE
3. Frontend renders custom UI (the `render` function)
4. User interacts with the UI (clicks a button)
5. `resolve()` sends the value back to the agent
6. Agent resumes execution with the user's input

### Feature 5: renderAndWaitForResponse -- Action-Based HITL

An alternative interrupt pattern using `useCopilotAction`:

```typescript
useCopilotAction({
  name: "review_strategy",
  description: "Let audience review and modify the agent's proposed strategy",
  available: "remote",  // Agent triggers this from the backend
  parameters: [],
  renderAndWaitForResponse: ({ respond, status }) =>
    status !== "complete" ? (
      <StrategyReview
        onApprove={(modifiedStrategy) => respond?.({
          approved: true,
          strategy: modifiedStrategy
        })}
        onReject={() => respond?.({ approved: false })}
      />
    ) : null,
});
```

### Feature 6: State Deltas via JSON Patch

Instead of sending the full state every update, AG-UI sends efficient diffs:

```
// Full state snapshot (sent once at start or on reconnect):
STATE_SNAPSHOT: {
  "round": 1,
  "agent_red": { "score": 0, "predictions": [] },
  "agent_blue": { "score": 0, "predictions": [] }
}

// Then incremental deltas (sent frequently during execution):
STATE_DELTA: [
  { "op": "replace", "path": "/round", "value": 2 },
  { "op": "add", "path": "/agent_red/predictions/-", "value": { "move": "bluff", "confidence": 0.82 } },
  { "op": "replace", "path": "/agent_red/score", "value": 150 }
]
```

The frontend applies these using the `fast-json-patch` library atomically. If patches become inconsistent, the frontend requests a fresh snapshot.

---

## 4. CopilotKit Python SDK Reference <a name="4-python-sdk"></a>

### Installation

```bash
pip install copilotkit
```

### Core Functions

#### copilotkit_emit_state(config, state)

Emits intermediate state updates from within a LangGraph node. The state is sent to the frontend as `STATE_SNAPSHOT` or `STATE_DELTA` events.

```python
from copilotkit.langchain import copilotkit_emit_state
from langchain_core.runnables import RunnableConfig

async def imagination_node(state: dict, config: RunnableConfig) -> dict:
    # Agent is "thinking" -- stream each prediction as it forms
    predictions = []

    for i in range(3):
        prediction = await generate_prediction(state, i)
        predictions.append(prediction)

        # Emit intermediate state -- frontend sees predictions appear one by one
        await copilotkit_emit_state(config, {
            **state,
            "agent_red": {
                **state["agent_red"],
                "predictions": predictions,
            },
            "phase": "imagination",
        })

    state["agent_red"]["predictions"] = predictions
    return state
```

**CRITICAL GOTCHA:** Do NOT call `copilotkit_emit_state` in the same node where you call `model.ainvoke()` with the same config, because the LLM streaming will overwrite the emitted state. Solution: separate state emission into its own node, or use `copilotkit_customize_config(config, emit_messages=False)`.

#### copilotkit_emit_message(config, message)

Sends a chat message to the frontend during node execution.

```python
from copilotkit.langchain import copilotkit_emit_message

async def commentary_node(state: dict, config: RunnableConfig) -> dict:
    await copilotkit_emit_message(
        config,
        f"Round {state['round']}: Both agents are analyzing the board..."
    )
    return state
```

#### copilotkit_emit_tool_call(config, name, args)

Manually triggers a tool call event (useful for triggering frontend tools).

```python
from copilotkit.langchain import copilotkit_emit_tool_call

async def dramatic_reveal_node(state: dict, config: RunnableConfig) -> dict:
    # Tell the frontend to play a sound effect
    await copilotkit_emit_tool_call(
        config,
        "play_sound_effect",
        {"effect": "dramatic_reveal"}
    )
    return state
```

#### copilotkit_customize_config(config, **kwargs)

Controls which events are emitted during node execution.

```python
from copilotkit.langchain import copilotkit_customize_config

async def tool_node(state: dict, config: RunnableConfig) -> dict:
    # Don't emit LLM messages during tool execution (avoids noise)
    config = copilotkit_customize_config(config, emit_messages=False)

    result = await tool.ainvoke(state, config=config)
    return result
```

#### copilotkit_exit()

Signals that the agent has completed its work.

```python
from copilotkit.langchain import copilotkit_exit

async def final_node(state: dict, config: RunnableConfig) -> dict:
    copilotkit_exit(config)
    return state
```

#### interrupt() from LangGraph

Standard LangGraph interrupt that CopilotKit handles automatically.

```python
from langgraph.types import interrupt

async def human_decision_node(state: dict, config: RunnableConfig) -> dict:
    # Pause and wait for user input
    user_response = interrupt(
        "Should the agent play aggressive or defensive this round?"
    )
    state["strategy_hint"] = user_response
    return state
```

### CopilotKitState -- Accessing Frontend State in Python

```python
from copilotkit import CopilotKitState
from langgraph.graph import StateGraph
from typing import TypedDict, List, Optional

class MatchAgentState(CopilotKitState):
    """Extends CopilotKitState to get access to frontend-provided context."""
    round: int
    phase: str
    agent_red: dict
    agent_blue: dict
    audience_votes: dict

    # CopilotKitState provides:
    # - copilotkit.actions: list of available frontend tools
    # - copilotkit.readable: frontend state (from useCopilotReadable)
```

### FastAPI Self-Hosted Setup

```python
from fastapi import FastAPI
from copilotkit.integrations.fastapi import add_fastapi_endpoint
from copilotkit import CopilotKitRemoteEndpoint, LangGraphAgent

app = FastAPI()

# Create your LangGraph graph
from your_agent import create_match_graph

match_graph = create_match_graph()

# Register with CopilotKit
sdk = CopilotKitRemoteEndpoint(
    agents=[
        LangGraphAgent(
            name="match_agent",
            description="Runs Agent Colosseum matches with imagination trees",
            graph=match_graph,
        )
    ]
)

# Mount endpoint
add_fastapi_endpoint(app, sdk, "/copilotkit")

# Run with: uvicorn main:app --port 8000
```

---

## 5. Best Demo Projects & Architecture Patterns <a name="5-demo-projects"></a>

### Project 1: Research Canvas (Most Comprehensive Example)

**URL:** https://github.com/CopilotKit/CopilotKit/tree/main/examples/coagents-research-canvas
**Live Demo:** https://examples-coagents-research-canvas-ui.vercel.app/

**What it demonstrates:**
- Full bidirectional state sync between React canvas and LangGraph agent
- Real-time streaming of research results as they are found
- Human-in-the-loop review of proposed outlines
- Custom generative UI in the chat panel
- Multiple tool executions with state emission after each

**Architecture pattern:**
```
Canvas UI (useCoAgent) <-> CopilotKit <-> LangGraph Agent
     |                                        |
     |-- setState (user edits) ------>        |
     |<------ copilotkit_emit_state -----     |
     |                                        |
     |-- respond (HITL approval) ----->       |
     |<------ interrupt() ----------------    |
```

**Key code pattern from the research canvas backend:**
```python
async def tool_node(self, state: ResearchState, config: RunnableConfig):
    config = copilotkit_customize_config(config, emit_messages=False)
    msgs = []
    tool_state = {}

    for tool_call in state["messages"][-1].tool_calls:
        tool = self.tools_by_name[tool_call["name"]]
        new_state, tool_msg = await tool.ainvoke(tool_call["args"])
        msgs.append(ToolMessage(content=tool_msg,
                               name=tool_call["name"],
                               tool_call_id=tool_call["id"]))

        tool_state = {
            "title": new_state.get("title", ""),
            "outline": new_state.get("outline", {}),
            "sections": new_state.get("sections", []),
            "sources": new_state.get("sources", {}),
            "logs": new_state.get("logs", []),
            "messages": msgs
        }

        # Emit after EACH tool -- frontend sees incremental progress
        await copilotkit_emit_state(config, tool_state)

    return tool_state
```

### Project 2: CoAgents Travel Planner

**URL:** https://github.com/CopilotKit/CopilotKit/tree/main/examples/coagents-travel

**What it demonstrates:**
- Multi-step planning agent with live UI updates
- Google Maps API integration with frontend tools
- Agent proposes itinerary, user can modify, agent adapts

### Project 3: CoAgents AI Researcher

**URL:** https://github.com/CopilotKit/CopilotKit/tree/main/examples/coagents-ai-researcher

**What it demonstrates:**
- Perplexity-clone with real-time search
- Sources streamed as they are found
- Intermediate state renders search progress

### Project 4: AG-UI Dojo (Interactive Learning)

**URL:** https://dojo.ag-ui.com/

**What it demonstrates:**
- Six "hello world" examples for each AG-UI feature
- Agentic Chat, Human-in-the-Loop, State Management
- Interactive visualization of AG-UI events

### Project 5: Canvas with LangGraph Python

**URL:** https://github.com/CopilotKit/canvas-with-langgraph-python

**What it demonstrates:**
- Next.js + Python LangGraph template
- Self-hosted (no CopilotKit Cloud dependency)
- Full canvas copilot pattern

### Project 6: Open Research ANA

**URL:** https://github.com/CopilotKit/open-research-ANA

**What it demonstrates:**
- Agent-native research canvas
- Real-time search with HITL capabilities
- CopilotKit + Tavily + LangGraph

---

## 6. Application to Agent Colosseum <a name="6-agent-colosseum-application"></a>

### How AG-UI Transforms Agent Colosseum

The current PROJECT.md uses `useCopilotReadable` and `useCopilotAction` for the spectator UI. This is a basic integration. Here is how to make it prize-winning:

### Upgrade 1: Replace Polling with useCoAgent State Sync

**Before (basic):** WebSocket/polling for match state
**After (AG-UI):** Bidirectional state sync via `useCoAgent`

```typescript
// The ENTIRE match state streams in real-time via AG-UI
const { state, setState, running, nodeName } = useCoAgent<MatchState>({
  name: "match_agent",
  initialState: defaultMatchState,
});

// nodeName tells you WHICH PHASE the agent is in:
// "imagination_red" | "imagination_blue" | "commit" | "reveal" | "score"
// You can use this to trigger different animations!
```

### Upgrade 2: Real-Time Imagination Tree Streaming

Instead of waiting for all predictions and then rendering, stream them one by one:

**Python (each prediction emitted as it is generated):**
```python
async def imagination_node(state: MatchState, config: RunnableConfig) -> MatchState:
    predictions = []

    for i in range(3):
        # Generate prediction using Bedrock
        prediction = await bedrock_predict(state, i)
        predictions.append(prediction)

        # STREAM to frontend -- tree grows branch by branch!
        await copilotkit_emit_state(config, {
            **state,
            "current_agent": "red",
            "phase": "imagination",
            "agent_red": {
                **state["agent_red"],
                "predictions": predictions,
                "thinking_progress": (i + 1) / 3,
            }
        })

    state["agent_red"]["predictions"] = predictions
    return state
```

**React (tree grows in real-time):**
```typescript
useCoAgentStateRender<MatchState>({
  name: "match_agent",
  render: ({ state, nodeName }) => {
    if (nodeName === "imagination_red" || nodeName === "imagination_blue") {
      return (
        <div className="thinking-overlay">
          <p>{state.current_agent} is thinking...
            ({Math.round(state[`agent_${state.current_agent}`].thinking_progress * 100)}%)
          </p>
          <MiniTree
            predictions={state[`agent_${state.current_agent}`].predictions}
            growing={true}
          />
        </div>
      );
    }
    return null;
  },
});
```

### Upgrade 3: Audience Influence via Bidirectional State

The audience does not just WATCH -- they INFLUENCE the match:

```typescript
// Audience votes flow INTO the agent's state
const handleVote = (team: "red" | "blue") => {
  setState(prev => ({
    ...prev,
    audience_votes: {
      ...prev.audience_votes,
      [team]: prev.audience_votes[team] + 1,
    }
  }));
};

// The agent can READ these votes and factor them into strategy!
```

**Python agent reads audience votes:**
```python
async def strategy_node(state: MatchState, config: RunnableConfig) -> MatchState:
    audience_bias = state.get("audience_votes", {})
    red_support = audience_bias.get("red", 0)
    blue_support = audience_bias.get("blue", 0)

    # Agent factors in audience sentiment
    if red_support > blue_support * 1.5:
        # Audience strongly favors red -- blue plays more cautiously
        state["agent_blue"]["strategy_modifier"] = "cautious"

    return state
```

### Upgrade 4: Frontend Tools for Visualization Control

The AI commentator agent can control the visualization directly:

```typescript
// The commentator can highlight important predictions
useFrontendTool({
  name: "highlight_branch",
  description: "Highlight a prediction branch on the imagination tree",
  parameters: [
    { name: "agent", type: "string", description: "red or blue" },
    { name: "branch_index", type: "number", description: "Branch to highlight" },
    { name: "style", type: "string", description: "pulse, glow, shake" },
  ],
  handler: ({ agent, branch_index, style }) => {
    visualizationRef.current.highlightBranch(agent, branch_index, style);
    return { status: "highlighted" };
  },
});

// The commentator can trigger dramatic camera movements
useFrontendTool({
  name: "dramatic_zoom",
  description: "Zoom the visualization camera for dramatic effect",
  parameters: [
    { name: "target", type: "string", description: "Element to zoom into" },
    { name: "duration_ms", type: "number" },
  ],
  handler: ({ target, duration_ms }) => {
    visualizationRef.current.animateCamera(target, duration_ms);
    return { status: "zooming" };
  },
});

// Commentator can trigger sound effects
useFrontendTool({
  name: "play_sfx",
  description: "Play sound effect for dramatic moments",
  parameters: [
    { name: "sound", type: "string", description: "fanfare, suspense, clash, victory" },
  ],
  handler: ({ sound }) => {
    new Audio(`/sfx/${sound}.mp3`).play();
    return { status: "playing" };
  },
});
```

### Upgrade 5: Human-in-the-Loop Mid-Match Decisions

```python
from langgraph.types import interrupt

async def audience_decision_node(state: MatchState, config: RunnableConfig):
    """At key moments, pause the match and let the audience decide."""

    if state["round"] == 5 and state["scores_tied"]:
        # Critical moment -- ask audience!
        choice = interrupt(
            "TIEBREAKER! The match is tied at round 5. "
            "Vote: Should we activate CHAOS MODE (random resource multipliers) "
            "or PRECISION MODE (double points for correct predictions)?"
        )

        state["special_mode"] = choice
        await copilotkit_emit_message(
            config,
            f"The audience has spoken: {choice.upper()} MODE ACTIVATED!"
        )

    return state
```

**Frontend interrupt handler:**
```typescript
useLangGraphInterrupt<string>({
  render: ({ event, resolve }) => (
    <div className="audience-interrupt-modal">
      <h2>AUDIENCE DECISION TIME!</h2>
      <p>{event.value}</p>
      <div className="vote-buttons">
        <button
          className="chaos-btn"
          onClick={() => resolve("chaos")}
        >
          CHAOS MODE
        </button>
        <button
          className="precision-btn"
          onClick={() => resolve("precision")}
        >
          PRECISION MODE
        </button>
      </div>
      <CountdownTimer seconds={15} onExpire={() => resolve("chaos")} />
    </div>
  ),
});
```

### Upgrade 6: Custom AG-UI Events for Match Events

Use `CUSTOM` events for domain-specific match events:

```python
# Backend emits custom events for specific match moments
async def emit_match_event(config, event_name, data):
    """Emit custom AG-UI event for match-specific moments."""
    await copilotkit_emit_tool_call(config, "match_event", {
        "event": event_name,
        "data": data
    })
```

---

## 7. What Prize-Winning CopilotKit Integrations Look Like <a name="7-prize-winning"></a>

### Hackathon Judging Criteria (from 100 Agents Hackathon)

The "Best AI Copilot" prize ($1,000) at the 100 Agents Hackathon uses four criteria (25% each):

1. **Completeness (25%):** Fully functional, end-to-end, no major bugs
2. **Presentation (25%):** Clear documentation, architecture explanation
3. **Creativity (25%):** Innovative approach, original ideas, unique application
4. **Business Viability (25%):** Market potential, scalability, real-world impact

### What Impresses CopilotKit Judges

Based on analyzing hackathon winners and CopilotKit's own showcases:

1. **Deep Integration, Not Surface-Level Chat:** The winning projects do NOT just add a `CopilotChat` sidebar. They use `useCoAgent` for live state sync, `useFrontendTool` for agent-controlled UI, and human-in-the-loop interrupts.

2. **Bidirectional State Sync is the Differentiator:** Projects that only send state FROM agent TO UI are basic. Projects that let the UI push state BACK to the agent (audience votes, user modifications) stand out dramatically.

3. **Generative UI, Not Just Text:** Using `useCoAgentStateRender` to render custom React components based on agent state (progress bars, visualizations, cards) rather than just chat text.

4. **Frontend Tools as a Wow Factor:** Having the agent control the UI (trigger animations, change themes, focus cameras) creates demo moments that judges remember.

5. **Human-in-the-Loop Creates Engagement:** Interrupt-based workflows where the user actually affects the agent's execution path demonstrate the full power of AG-UI.

### The Winning Pattern

```
BASIC (forgettable):     Agent -> Chat text -> User reads
GOOD (competitive):      Agent -> State sync -> Custom UI renders
GREAT (prize-worthy):    Agent <-> State sync <-> User influences agent
EXCEPTIONAL (wins):      Agent <-> State sync <-> User influences agent
                         + Agent calls frontend tools (controls UI)
                         + Human-in-the-loop interrupts (user decides)
                         + Custom generative UI in chat
                         + Real-time visualization of agent "thinking"
```

### Agent Colosseum's CopilotKit Advantage

Agent Colosseum is uniquely positioned because:
- The **imagination tree visualization** is a perfect use case for streaming state deltas
- The **adversarial format** creates natural moments for human-in-the-loop
- The **spectator experience** demands real-time UI updates (not just chat)
- The **AI commentator** can use frontend tools to control the visualization
- The **audience votes** are a natural bidirectional state flow

This is not a chat interface with an agent behind it. This is an agent-native experience where the UI IS the agent's state, rendered in real-time.

---

## 8. Self-Hosted FastAPI Setup <a name="8-self-hosted-setup"></a>

### Complete Backend Setup (No CopilotKit Cloud Required)

```python
# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from copilotkit.integrations.fastapi import add_fastapi_endpoint
from copilotkit import CopilotKitRemoteEndpoint, LangGraphAgent
from match_agent import create_match_graph

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create the match agent graph
match_graph = create_match_graph()

# Register with CopilotKit
sdk = CopilotKitRemoteEndpoint(
    agents=[
        LangGraphAgent(
            name="match_agent",
            description="Runs Agent Colosseum matches with imagination phase, "
                       "commit phase, reveal phase, and scoring",
            graph=match_graph,
        ),
        LangGraphAgent(
            name="commentator_agent",
            description="AI sports commentator that narrates matches",
            graph=create_commentator_graph(),
        ),
    ]
)

add_fastapi_endpoint(app, sdk, "/copilotkit")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

### Frontend Setup

```typescript
// frontend/app/layout.tsx
import { CopilotKit } from "@copilotkit/react-core";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <CopilotKit
          runtimeUrl="http://localhost:8000/copilotkit"
          agent="match_agent"
        >
          {children}
        </CopilotKit>
      </body>
    </html>
  );
}
```

### Package Dependencies

**Python (pyproject.toml or requirements.txt):**
```
copilotkit>=0.1.39
fastapi>=0.100.0
uvicorn>=0.23.0
langgraph>=0.2.0
langchain-aws  # For Bedrock integration
```

**Node.js (package.json):**
```json
{
  "dependencies": {
    "@copilotkit/react-core": "^1.50.0",
    "@copilotkit/react-ui": "^1.50.0",
    "next": "^14.0.0",
    "react": "^18.0.0"
  }
}
```

---

## 9. Concrete Implementation Plan for Agent Colosseum <a name="9-implementation-plan"></a>

### Phase 1: Foundation (2 hours)

1. Set up FastAPI backend with `CopilotKitRemoteEndpoint`
2. Create `MatchAgentState` extending `CopilotKitState`
3. Set up Next.js frontend with `CopilotKit` provider pointing to self-hosted backend
4. Verify basic `useCoAgent` connection works

### Phase 2: State Streaming (2 hours)

1. Implement imagination node that emits predictions one-by-one via `copilotkit_emit_state`
2. Hook up `useCoAgent` in the MatchViewer component
3. Build `useCoAgentStateRender` for chat-panel visualization of current phase
4. Verify real-time state updates flow from Python to React

### Phase 3: Interactive Features (2 hours)

1. Add `useFrontendTool` for visualization control (highlight branches, camera zoom, sound effects)
2. Implement audience voting via `setState` (bidirectional)
3. Add `useLangGraphInterrupt` for mid-match audience decisions
4. Add AI commentator with `useCopilotReadable` (match state context) and `CopilotChat`

### Phase 4: Polish (1 hour)

1. Add `useCoAgentStateRender` for custom match event cards in chat
2. Add dramatic reveal animations triggered by frontend tools
3. Test full flow: match start -> imagination streaming -> audience vote -> reveal -> scoring
4. Record demo showing all AG-UI features in action

### What to Demonstrate in the Demo

1. **"Watch this"** -- Imagination trees grow in real-time as the agent thinks (state streaming)
2. **"Now YOU decide"** -- Audience vote appears mid-match (human-in-the-loop interrupt)
3. **"The agent controls the UI"** -- Commentator highlights predictions, triggers sounds (frontend tools)
4. **"Bidirectional"** -- Audience votes change agent behavior (setState pushing data TO agent)
5. **"Not just chat"** -- Custom match cards render in the chat panel (useCoAgentStateRender)

---

## Key Sources

- AG-UI Protocol: https://docs.ag-ui.com/
- CopilotKit Documentation: https://docs.copilotkit.ai/
- CopilotKit GitHub: https://github.com/CopilotKit/CopilotKit
- AG-UI Protocol GitHub: https://github.com/ag-ui-protocol/ag-ui
- useCoAgent Reference: https://docs.copilotkit.ai/reference/hooks/useCoAgent
- useFrontendTool Reference: https://docs.copilotkit.ai/reference/hooks/useFrontendTool
- useCoAgentStateRender Reference: https://docs.copilotkit.ai/reference/hooks/useCoAgentStateRender
- useLangGraphInterrupt Reference: https://docs.copilotkit.ai/reference/hooks/useLangGraphInterrupt
- Human-in-the-Loop (Interrupt Flow): https://docs.copilotkit.ai/langgraph/human-in-the-loop/interrupt-flow
- Intermediate State Streaming: https://docs.copilotkit.ai/coagents/advanced/intermediate-state-streaming
- Python SDK on PyPI: https://pypi.org/project/copilotkit/
- LangGraph SDK Reference: https://docs.copilotkit.ai/reference/sdk/python/LangGraph
- Remote Endpoints (Python): https://docs.copilotkit.ai/reference/sdk/python/RemoteEndpoints
- Research Canvas Example: https://github.com/CopilotKit/CopilotKit/tree/main/examples/coagents-research-canvas
- Canvas with LangGraph Python: https://github.com/CopilotKit/canvas-with-langgraph-python
- AG-UI Dojo (interactive demos): https://dojo.ag-ui.com/
- 100 Agents Hackathon: https://100agents.dev/
- AG-UI Blog Post: https://www.copilotkit.ai/blog/introducing-ag-ui-the-protocol-where-agents-meet-users
- 17 AG-UI Event Types: https://www.copilotkit.ai/blog/master-the-17-ag-ui-event-types-for-building-agents-the-right-way
- Agent-Native Applications Blog: https://www.copilotkit.ai/blog/everything-you-need-to-build-agent-native-applications
- LangGraph + CopilotKit Blog: https://www.copilotkit.ai/blog/easily-build-a-ui-for-your-ai-agent-in-minutes-langgraph-copilotkit
- Frontend Tool Rendering (Microsoft Learn): https://learn.microsoft.com/en-us/agent-framework/integrations/ag-ui/frontend-tools
- AG-UI State Management: https://docs.ag-ui.com/concepts/state
- AG-UI Events Reference: https://docs.ag-ui.com/concepts/events
- CopilotKit DeepWiki (Python SDK): https://deepwiki.com/CopilotKit/CopilotKit/6-python-sdk-(copilotkit)
- Issue #934 (emit_state gotcha): https://github.com/CopilotKit/CopilotKit/issues/934
