# Agent Colosseum: Full Tool Inventory & Research

> Comprehensive mapping of every tool, feature, and capability across the hackathon tech stack.
> Focus: what is available BEYOND what's already in PROJECT.md.

---

## Table of Contents

1. [Amazon Bedrock AgentCore](#bedrock-agentcore)
2. [Datadog](#datadog)
3. [Neo4j](#neo4j)
4. [MongoDB](#mongodb)
5. [CopilotKit](#copilotkit)
6. [3d-force-graph & Visualization Libraries](#visualization)
7. [Framer Motion](#framer-motion)
8. [WebSocket / Real-Time](#websocket)
9. [Sound Design Libraries](#sound)
10. [Underused / Overlooked Tools](#underused)
11. [Hidden Gems](#hidden-gems)
12. [Practical Notes](#practical-notes)

---

## 1. Amazon Bedrock AgentCore <a name="bedrock-agentcore"></a>

### What PROJECT.md Already Covers
- Runtime (microVM isolation), Gateway (MCP tools), Memory (episodic), Policy (Cedar), Observability (OTel), Evaluations
- A2A Protocol for agent communication
- Basic SDK usage (`agentcore create/dev/launch`)

### NEW Features Not in PROJECT.md

#### Bi-Directional Streaming (GA as of Dec 2025)
- **What:** Agents can simultaneously listen and respond over WebSocket — full-duplex communication
- **Why it matters for us:** Instead of request-response for each round, we can have agents stream their "thinking" process in real-time to the frontend while receiving game state updates. This transforms the visualization from "wait for response" to "watch the agent think live"
- **Interaction patterns supported:**
  - Interactive debugging: guide agents through problem-solving in real-time
  - Collaborative agents: work alongside users on shared tasks
  - Multi-modal agents: process streaming data while providing analysis
  - Long-running operations: stream incremental results over minutes or hours
- **Protocol:** WebSocket (full-duplex over single TCP connection)
- **Available:** All 9 AWS Regions where AgentCore Runtime is available

#### AgentCore Identity (GA)
- **What:** Unified directory service for agent identities with OAuth 2.0 + IAM support
- **Features:**
  - Each agent gets a unique identity with metadata (name, ARN, OAuth URLs)
  - Token Vault: encrypted storage for OAuth tokens, client credentials, API keys
  - Inbound Auth: control who can invoke agents (SigV4 + OAuth 2.0)
  - Outbound Auth: agents authenticate to external services
  - Declarative SDK annotations: `@requires_access_token`, `@requires_api_key`
  - Auto-handles token expiration, consent flows, OAuth orchestration
- **Why it matters:** We could give each agent a proper identity, letting spectators authenticate to watch matches, and letting agents securely access Neo4j/MongoDB/Datadog with managed credentials

#### Session Management Details
- **Session states:** Active (processing), Idle (provisioned but waiting), Terminated (15-min inactivity or 8-hour max)
- **Session isolation:** Each session gets dedicated CPU, memory, filesystem in its own microVM
- **Session persistence:** Context preserved across multiple interactions within same conversation
- **Why it matters:** An entire match (10+ rounds) can run as a single session, preserving agent state across rounds without re-initialization. The 8-hour window is massive for tournament-style gameplay

#### Enterprise Features (GA since Oct 2025)
- VPC support, AWS PrivateLink, CloudFormation, resource tagging
- All AgentCore services now GA (Runtime was GA first, others followed)

#### A2A Protocol Deep Details
- **Three transport options:** JSON-RPC 2.0, gRPC, REST — choose based on team expertise
- **Streaming support:** Server-Sent Events (SSE) for streaming, webhook-based push for async
- **Security:** OAuth 2.0, OpenID Connect, mTLS authentication
- **Skill-specific authorization:** Fine-grained access control per agent capability
- **Cross-framework:** Agents built with Strands, OpenAI, LangGraph, CrewAI can all communicate
- **AWS adoption:** A2A support in Strands Agents SDK, broader AgentCore support coming

#### Framework Compatibility
- AgentCore works with ANY framework: CrewAI, LangGraph, LlamaIndex, Strands Agents, or custom
- Works with ANY foundation model (not locked to Bedrock models)
- SDK downloaded 2M+ times in 5 months since preview

---

## 2. Datadog <a name="datadog"></a>

### What PROJECT.md Already Covers
- LLM Observability (ddtrace, LLMObs)
- Custom Dashboards (3 dashboards designed)
- DogStatsD metrics
- OpenTelemetry pipeline
- MCP integration for agent self-monitoring
- Monitors, SLOs, Blast Radius Index

### NEW Features Not in PROJECT.md

#### Datadog Notebooks (Collaborative Investigation)
- **What:** Rich-text documents with live Datadog graphs + real-time collaboration
- **Key features:**
  - Multiple users edit simultaneously with real-time cursors
  - Embed any Datadog widget (metrics, logs, traces) with live data
  - Comment on text, graphs, and images inline
  - `@mention` teammates to pull them into investigations
  - Investigation notebook type: pre-built for incident analysis
  - Copy widgets from Dashboards/APM directly into notebooks (Ctrl+C)
- **Why it matters:** Create a "Match Post-Mortem" notebook that auto-generates after each match, embedding live prediction accuracy graphs, agent reasoning traces, and strategy evolution charts. Judges can see collaborative analysis, not just dashboards

#### Bits AI SRE (GA Dec 2025)
- **What:** Autonomous AI on-call agent that investigates alerts, finds root causes, and restores services
- **Key capabilities:**
  - Auto-generates real-time incident summaries (nature, impact, factors, actions taken)
  - Pinpoints root causes in minutes
  - Tested against 2,000+ customer environments
  - 90% faster incident resolution
- **Why it matters:** During demo, if something breaks, Bits AI can automatically investigate. More importantly, we can show Bits AI analyzing agent behavior anomalies during matches

#### Incident Management
- **What:** Full incident lifecycle management integrated with Datadog
- **Features:**
  - Declare incidents directly from monitors or manually
  - Remediation tab: track follow-up tasks, link to Notebooks/Docs
  - Auto-populates Notebooks with key incident data (impact, root cause, timeline)
  - Post-incident review templates
- **Why it matters:** We can create "Match Incidents" — when prediction accuracy drops below threshold or an agent behaves unexpectedly, auto-declare an incident, auto-generate a notebook, and show the full lifecycle

#### Case Management
- **What:** Consolidated view of operational tasks, bugs, incident follow-ups
- **Features:**
  - Integrates observability into service management
  - Triage and troubleshoot without context-switching tools
  - Link cases to monitors, incidents, and notebooks
- **Why it matters:** Track "Agent Quality Cases" — when an agent's prediction accuracy degrades, auto-create a case that links to the relevant LLM Obs traces, the strategy graph query results, and the match replay

#### Workflow Automation
- **What:** Orchestrate processes across your entire stack
- **Features:**
  - 1,750+ out-of-the-box actions
  - 150+ customizable blueprints
  - Point-and-click interface
  - Trigger from monitors, incidents, or manual
- **Why it matters:** Auto-trigger workflows when monitors fire:
  - "Prediction accuracy dropping" -> auto-query Neo4j for strategy shift recommendations -> push to agent via MCP
  - "Match completed" -> auto-generate post-match notebook -> store to MongoDB -> update leaderboard

#### Software Catalog (Service Catalog v2)
- **What:** Centralized inventory of all services, APIs, endpoints with ownership
- **Features:**
  - Auto-discovers endpoints from distributed traces
  - Assign ownership, on-call, communication channels per endpoint
  - Schema v3.0: Terraform, GitHub, API, UI creation methods
  - Entity model: services, endpoints, systems, datastores, queues
- **Why it matters:** Register every Agent Colosseum service (Agent Red, Agent Blue, Judge, Match API, Neo4j connector, MongoDB connector) with ownership metadata. Shows operational maturity to judges

#### Datadog MCP Server (Preview)
- **What:** Bridge between observability data and AI agents via Model Context Protocol
- **Detailed capabilities:**
  - Query logs, traces, incident context via natural language
  - Toolset support: select only needed tools to save context window space
  - Response optimization: auto-truncates based on estimated length
  - `max_tokens` parameter per tool for fine-grained control
  - Derives intent from natural language prompts
  - No charge during Preview
- **Why it matters:** Agents can query their own performance data naturally. "How am I doing against aggressive opponents?" -> Datadog MCP returns relevant metrics, traces, and patterns

#### Synthetic Monitoring
- **What:** Code-free API, browser, and mobile tests simulating user flows
- **Protocols monitored:** HTTP, SSL, DNS, WebSocket, TCP, UDP, ICMP, gRPC
- **Why it matters:** Create synthetic tests for the WebSocket match streaming endpoint. Run them in CI. Show judges we monitor the spectator experience proactively

#### RUM (Real User Monitoring)
- **What:** Full visibility into every user session — errors, performance, user behavior
- **Features:**
  - Session Replay: watch exact user sessions
  - Performance tracking: Core Web Vitals
  - Error Management: track bugs across versions
  - Custom Timings: `datadogRum.addTiming()` for custom perf marks
  - Custom Actions: `datadogRum.addAction()` for business events
  - Error reporting: `datadogRum.addError()` for JS exceptions
- **Why it matters:** Track spectator experience: time-to-first-prediction render, 3D visualization frame rate, WebSocket connection quality. Show judges we monitor the entire user journey

#### CI Visibility
- **What:** Track test and pipeline performance across CI/CD
- **Why it matters:** Show that our CI pipeline is monitored — tests, builds, deployments all tracked in Datadog

---

## 3. Neo4j <a name="neo4j"></a>

### What PROJECT.md Already Covers
- Graph schema (Agents, Matches, Rounds, Moves, Predictions, Strategies, GameStates)
- Key Cypher queries (5 patterns)
- Vector search for strategy similarity
- Graphiti integration for temporal knowledge graphs
- AuraDB setup

### NEW Features Not in PROJECT.md

#### Graph Data Science (GDS) Library
- **What:** Suite of graph algorithms accessible via Cypher procedures or Python client
- **Algorithm categories:**

  **Centrality Algorithms:**
  - **PageRank:** Rank strategies by influence in the meta-game
  - **Betweenness Centrality:** Find "bridge" strategies that connect different play styles
  - **Eigenvector Centrality:** Identify strategies connected to other strong strategies
  - **Degree Centrality:** Find the most connected moves/strategies

  **Community Detection:**
  - **Louvain:** Detect clusters of related strategies (e.g., "aggressive cluster" vs "defensive cluster")
  - **Label Propagation:** Fast community assignment for strategy grouping
  - **Weakly Connected Components:** Find isolated strategy subgraphs

  **Node Embedding:**
  - **FastRP (Fast Random Projection):** Ultra-fast vector embeddings from graph structure. Comparable quality to Node2Vec/GraphSAGE but much faster
  - **Node2Vec:** Random-walk-based embeddings for capturing graph structure
  - **GraphSAGE:** Inductive embeddings — can generate embeddings for NEW strategies never seen before
  - **HashGNN:** GNN-like embeddings without training

  **Link Prediction:**
  - **Link Prediction Pipelines:** End-to-end workflow from feature extraction to predicting NEW relationships
  - **Topological link prediction:** Predict which strategies are likely to counter which

  **Pathfinding:**
  - Dijkstra, A*, BFS, DFS for finding optimal strategy paths
  - Shortest path between game states (already in PROJECT.md but GDS makes it faster)

  **Similarity:**
  - Node Similarity: find similar agents, strategies, or game states
  - K-Nearest Neighbors: find the K most similar game states

- **Python client:** `graphdatascience` package for pure Python usage
- **Why it matters for us:**
  - Run Louvain community detection on strategy graph -> discover emergent "meta-game clusters"
  - Use FastRP embeddings to create strategy vectors for similarity search
  - Use Link Prediction to predict "which new counter-strategy would be effective?"
  - Use PageRank on strategy nodes to find the "dominant strategy" in the current meta

#### APOC Library (Awesome Procedures on Cypher)
- **What:** 450+ utility procedures and functions for Neo4j
- **Key capabilities:**
  - Data import/export (JSON, CSV, GraphML, Gephi)
  - Graph generation and refactoring
  - Path expansion and neighborhood analysis
  - Trigger support (execute Cypher on data changes)
  - Spatial functions
  - Text processing and similarity
  - Collection and map utilities
  - Periodic execution and batching
- **APOC GenAI extensions:**
  - Generate text and images via LLM
  - Generate vector embeddings
  - Generate and execute Cypher from natural language
  - Schema explanation via LLM
- **Version matching:** APOC version year/month must match Neo4j version (e.g., APOC 2025.06.x for Neo4j 2025.06.x)
- **Why it matters:** APOC triggers could auto-update strategy scores when new match data arrives. APOC GenAI could let agents query the graph with natural language

#### LangChain Integration
- **What:** Deep integration with LangChain framework
- **Features:**
  - Vector search over Neo4j data
  - Cypher generation from natural language
  - Knowledge graph construction from unstructured text
  - Neo4j Graph wrapper for simplified querying
- **Why it matters:** Could use LangChain + Neo4j to let the CopilotKit commentator query the strategy graph naturally: "What's the most effective counter to Blue's aggressive opening?"

#### AuraDB Free Tier Limits
- **Nodes:** 200,000 max
- **Relationships:** 400,000 max
- **Backups:** One snapshot at a time (no rolling backups)
- **No credit card required**
- **GDS on AuraDB:** Limited availability — need AuraDB Professional or Enterprise for full GDS
- **Why it matters:** 200K nodes and 400K relationships is MORE than enough for hackathon demo. Across 100 matches x 10 rounds = 1000 rounds, generating maybe 50 nodes per round = 50K nodes. Plenty of headroom

---

## 4. MongoDB <a name="mongodb"></a>

### What PROJECT.md Already Covers
- Match document schema
- Aggregation pipeline for win rates
- Basic pymongo setup

### NEW Features Not in PROJECT.md

#### Atlas Search (Full-Text Search)
- **What:** Lucene-based full-text search integrated directly into MongoDB
- **Features:**
  - Fuzzy matching, autocomplete, highlighting
  - Faceted search (filter by game type, agent, date)
  - Compound queries combining text + filter + score
  - Atlas Search indexes run alongside your data
- **Why it matters:** Search match archives by agent reasoning text: "Find all matches where an agent mentioned 'bluff'" — without scanning every document

#### Atlas Vector Search
- **What:** Vector similarity search natively in MongoDB
- **Features:**
  - Store embeddings alongside documents (no separate vector DB)
  - Cosine, euclidean, dot product similarity
  - Hybrid search: combine vector search with full-text search and filters
  - Pre-filter and post-filter support
- **Why it matters:** Store Bedrock embeddings of game states directly in match documents. Query "find matches with similar game states" without leaving MongoDB. Complements Neo4j vector search — use MongoDB for document-level similarity, Neo4j for relationship-level similarity

#### Change Streams (Real-Time Data)
- **What:** Real-time subscription to data changes on collections, databases, or entire deployments
- **Features:**
  - Watch single collection, database, or full cluster
  - Cursor-based iteration or event listener pattern
  - Resume tokens for reconnection
  - Filter changes by operation type (insert, update, delete, replace)
  - Full document lookup on change
- **Integration with WebSocket:**
  - Proven pattern: MongoDB Change Stream -> Socket.IO -> Frontend
  - Libraries like `mongo-live-server` and `broadcaster` provide turnkey WebSocket bridging
- **Requirement:** Database must be a replica set (Atlas is always a replica set)
- **Why it matters:** When a new match result is stored in MongoDB, Change Streams can push the update instantly to:
  - The leaderboard UI (via WebSocket)
  - The CopilotKit commentator (via server-side event)
  - Datadog custom metrics (via pipeline)
  - This eliminates polling entirely

#### MongoDB Charts
- **What:** Built-in data visualization tool for MongoDB data
- **Features:**
  - Embeddable charts (iframe or SDK)
  - Real-time data (auto-refresh)
  - Dashboard sharing
  - Aggregation-powered visualizations
- **Why it matters:** Embed live match statistics charts directly into the CopilotKit UI without building custom chart components. Win rate over time, strategy distribution, prediction accuracy trends — all auto-generated from match documents

#### Time Series Collections
- **What:** Optimized collection type for time-stamped data
- **Features:**
  - Automatic bucketing for efficient storage
  - Built-in time-based aggregations
  - Significantly better performance for time-ordered data
  - Supports secondary indexes
- **Why it matters:** Store per-round metrics (prediction accuracy, latency, token cost) in a time series collection. Much more efficient for "show me prediction accuracy over the last 50 rounds" queries

---

## 5. CopilotKit <a name="copilotkit"></a>

### What PROJECT.md Already Covers
- CopilotChat for AI commentator
- useCopilotAction / useCopilotReadable hooks
- Basic spectator UI components

### NEW Features Not in PROJECT.md

#### AG-UI Protocol (Agent-UI Protocol)
- **What:** Open-source, lightweight, event-based protocol for frontend-to-agent communication
- **Adoption:** Google, LangChain, AWS, Microsoft, Oracle, Mastra, PydanticAI all adopted
- **Features:**
  - Event-driven communication
  - Real-time state synchronization
  - Standardized tool usage from UI
  - Streaming agent responses
  - Interrupt handling for approval workflows
- **Why it matters:** Instead of custom WebSocket events, use the industry-standard AG-UI protocol for all agent-to-frontend communication. Judges will notice we're using the protocol that Google/AWS/Microsoft adopted

#### CoAgents + LangGraph Integration
- **What:** Deep integration between CopilotKit and LangGraph for full-stack agent applications
- **Key hook: `useCoAgent`** — syncs LangGraph agent state with React frontend in real-time
- **Features:**
  - Agent state visible in UI components
  - Frontend can send inputs to running agents
  - Bidirectional state sync
  - Multiple agents per UI
- **Why it matters:** If we use LangGraph for agent orchestration (instead of raw AgentCore), we get automatic frontend state sync via useCoAgent. Each agent's thinking process, predictions, and decisions reflected in the UI without manual WebSocket wiring

#### Generative UI
- **What:** AI agents dynamically generate and update UI components at runtime
- **Features:**
  - Agents decide what appears on screen
  - UI components rendered from agent state
  - Dynamic layouts based on context
  - Agents can render custom React components
- **Why it matters:** The AI commentator could dynamically generate UI widgets: "Let me show you a comparison chart" -> renders a chart component in real-time. Or "Here's what Red is thinking" -> renders an expandable reasoning tree

#### CopilotTextarea
- **What:** AI-enhanced text input with autosuggestions
- **Features:**
  - Built on Slate.js editor framework
  - AI-powered autosuggestions
  - Hovering toolbar for AI text generation
  - Customizable suggestion behavior
- **Why it matters:** Spectator Q&A input with AI-assisted suggestions: "Ask the commentator about..." with autocomplete that suggests relevant questions based on current match state

#### CopilotTask
- **What:** Programmatic one-off AI task execution
- **Why it matters:** Trigger AI tasks from match events: "When Round 5 ends, CopilotTask generates a mid-match analysis summary"

#### Human-in-the-Loop
- **What:** Agents can pause execution to request user input, confirmation, or edits
- **Features:**
  - Standardized interrupt handling via AG-UI
  - Approval workflows
  - User can edit agent-proposed actions
- **Why it matters:** Audience interaction mode: agent pauses and asks "The audience predicted Blue would bluff. Should I adjust my strategy?" — human-in-the-loop for spectator engagement

#### MCP Apps Support
- **What:** MCP servers can ship interactive UIs that work in agent applications
- **Why it matters:** The Datadog MCP server could render its query results as interactive UI components within the CopilotKit chat

---

## 6. 3d-force-graph & Visualization Libraries <a name="visualization"></a>

### What PROJECT.md Already Covers
- Basic 3d-force-graph setup with Three.js
- Custom node rendering (glowing spheres)
- Camera focus on click
- Force simulation tuning

### NEW Features Not in PROJECT.md

#### VR and AR Versions
- **3d-force-graph-vr:** Force-directed graph in VR (WebXR)
- **3d-force-graph-ar:** Force-directed graph in AR (marker-based)
- **React wrappers:** `ForceGraph2D`, `ForceGraph3D`, `ForceGraphVR`, `ForceGraphAR`
- **Why it matters:** Demo bonus: "And here's the imagination tree in VR" — even a 10-second VR demo would be memorable for judges

#### Advanced Link Features
- **Link Curvature:** 3D bezier curves for links — set `linkCurvature` to any numeric value
- **Link Particles:** Small spheres distributed equi-spaced along links
  - `linkDirectionalParticles`: number of particles per link
  - `linkDirectionalParticleSpeed`: animation speed
  - `linkDirectionalParticleWidth`: particle size
- **Why it matters:** Particles flowing along prediction branches show "thinking energy" moving through the imagination tree. Curvature prevents overlapping links

#### Node Clustering
- **d3-force-cluster-3d:** Clustering force that attracts nodes toward cluster centers
- Compatible with d3-force-3d in 1D, 2D, or 3D
- **Why it matters:** Cluster Red predictions vs Blue predictions in 3D space. Correct predictions cluster toward gold center, wrong predictions scatter outward

#### Performance Optimization
- Instanced rendering for many nodes
- Simplify edges at distance
- Asynchronous layout for large datasets
- **Why it matters:** When both agents have 3 predictions each, we have ~8-10 nodes per round. Over a full match replay showing all rounds, could have 100+ nodes. Performance optimization matters

---

## 7. Framer Motion <a name="framer-motion"></a>

### What PROJECT.md Already Covers
- Basic animate/exit with AnimatePresence
- Motion components for branches

### NEW Features Not in PROJECT.md

#### Layout Animations (v11+)
- **What:** Animate CSS layout changes that are normally impossible to animate
- **`layout` prop:** Any layout change from React render is automatically animated
- **Can animate:** `justify-content` changes, element reflows, grid changes
- **Why it matters:** When the scoreboard updates, when panels resize after a round ends, when the split-screen adjusts — all animated smoothly with just a `layout` prop

#### Shared Layout Animations
- **`layoutId` prop:** Connect two different elements, animate between them
- **Why it matters:** A prediction node in the imagination tree can animate and morph into the result display after the Double Collapse. Same element ID, different components — automatic morphing animation

#### Advanced AnimatePresence
- **With layout:** List additions/removals with automatic layout adjustment animations
- **`layoutScroll` prop:** Correct animation within scrollable containers
- **`layoutRoot` prop:** Correct animation within fixed elements
- **Why it matters:** Match history feed with animated entry/exit of round results, properly handled in scrollable panels

#### Motion v11 (2025) Improvements
- Better React 19 concurrent rendering support
- Improved handling of complex layout transitions
- Performance enhancements for large numbers of animated elements
- **Why it matters:** We're likely using React 19 with Next.js 15 — the v11 improvements directly benefit us

---

## 8. WebSocket / Real-Time <a name="websocket"></a>

### PROJECT.md Mentions
- WebSocket for real-time streaming
- WebSocket events defined

### Detailed Comparison: Socket.IO vs Native WebSocket

| Feature | Native WebSocket | Socket.IO |
|---------|-----------------|-----------|
| **Latency** | Lower (raw protocol) | Higher (event wrapping overhead) |
| **Reconnection** | Manual implementation | Automatic built-in |
| **Rooms/Namespaces** | Manual implementation | Built-in (logical grouping) |
| **Fallback transports** | None | Long-polling, etc. |
| **Middleware** | Manual | Built-in auth middleware |
| **Scaling** | Manual | Redis adapter for multi-node |
| **Message size** | Smaller (raw) | Larger (custom event structure) |
| **Binary support** | Native | Supported but adds overhead |

**Recommendation for Agent Colosseum:** Socket.IO

- Rooms: Each match gets a room, spectators join by match ID
- Namespaces: `/match`, `/leaderboard`, `/admin` — separation of concerns
- Auto-reconnection: spectators don't lose connection during network blips
- Redis adapter: if we need multiple backend nodes
- Middleware: authenticate spectators before joining match rooms
- The latency difference is negligible for our 6-second round cycles

---

## 9. Sound Design Libraries <a name="sound"></a>

### Not in PROJECT.md at All

#### Howler.js (Recommended for Agent Colosseum)
- **Size:** 7KB gzipped
- **Features:** Simple playback, sprite maps (multiple sounds in one file), spatial audio, volume/rate control
- **Fallback:** Web Audio -> HTML5 Audio automatically
- **No dependencies**
- **Best for:** Sound effects (branch grow, collapse chime, score update ping)

#### Tone.js (If We Want Generative Audio)
- **Features:** Audio synthesis, sequencing, effects processing, scheduling
- **Built on:** Web Audio API
- **Best for:** Procedural audio that responds to game state
- **Example use:**
  - Confidence level maps to pitch (higher confidence = higher tone)
  - Correct prediction = major chord resolution
  - Wrong prediction = dissonant dissolution sound
  - Round timer = rising tension drone

**Recommendation:** Howler.js for basic sound effects, Tone.js if we want the audio to be data-driven (which would be impressive for judges)

---

## 10. Underused / Overlooked Tools <a name="underused"></a>

These are features most hackathon teams will miss entirely:

### Datadog
1. **Notebooks** — Almost no one uses them in hackathons. Auto-generated match post-mortems would stand out
2. **Workflow Automation** — Trigger-based workflows from monitors is rarely seen in hackathon projects
3. **Case Management** — Linking agent quality issues to cases shows enterprise-level thinking
4. **Bits AI SRE** — Newest feature, judges will notice if we integrate it
5. **Software Catalog** — Registering all our services shows operational maturity
6. **Synthetic Monitoring** — Proactively testing WebSocket endpoints is uncommon

### Neo4j
7. **GDS Community Detection** — Running Louvain on strategy graphs to discover meta-game clusters
8. **GDS Node Embeddings (FastRP)** — Graph-based embeddings as alternative to LLM embeddings
9. **APOC Triggers** — Auto-execute Cypher when data changes (reactive graph)
10. **Link Prediction Pipelines** — ML-powered prediction of new strategy relationships

### CopilotKit
11. **Generative UI** — Dynamic agent-generated interface components
12. **AG-UI Protocol** — Industry-standard protocol adoption (Google/AWS/Microsoft backed)
13. **Human-in-the-Loop** — Spectator interaction via agent interrupts

### MongoDB
14. **Change Streams** — Real-time push from database to frontend (no polling)
15. **Time Series Collections** — Optimized per-round metric storage
16. **Atlas Search** — Full-text search over agent reasoning text

### AgentCore
17. **Bi-Directional Streaming** — Full-duplex agent communication for live "thinking" visualization
18. **Identity** — Managed OAuth + credential vault for agent auth

### Other
19. **Tone.js** — Data-driven procedural audio (sound design that responds to match state)
20. **3d-force-graph particles** — Animated directional particles on graph links

---

## 11. Hidden Gems <a name="hidden-gems"></a>

The 10 most impactful overlooked features, ranked by "judge wow factor" / effort ratio:

### 1. MongoDB Change Streams -> Socket.IO -> Live Leaderboard
**Impact: HIGH | Effort: LOW**
When a match result is written to MongoDB, Change Streams push it instantly to a live leaderboard. Zero polling. Proven pattern with existing libraries. Shows real-time architecture sophistication.

### 2. Datadog Notebooks for Auto-Generated Match Post-Mortems
**Impact: HIGH | Effort: MEDIUM**
After each match, auto-generate a Datadog Notebook with embedded live widgets: prediction accuracy graphs, agent reasoning traces, strategy evolution charts. Shareable, collaborative, impressive for judges.

### 3. Neo4j GDS Louvain Community Detection on Strategy Graphs
**Impact: HIGH | Effort: MEDIUM**
Run community detection to discover emergent "meta-game clusters" — groups of strategies that tend to co-occur. Visualize these clusters in the 3D graph with different colors. Shows we're using Neo4j for ANALYTICS, not just storage.

### 4. AgentCore Bi-Directional Streaming for Live Thinking
**Impact: VERY HIGH | Effort: HIGH**
Stream agent reasoning tokens in real-time as branches grow on the imagination tree. Instead of "agent thought for 3 seconds, here are results," spectators watch each prediction form character by character. This is the signature visual moment.

### 5. CopilotKit Generative UI for Dynamic Commentary
**Impact: HIGH | Effort: MEDIUM**
AI commentator dynamically generates UI widgets: comparison charts, strategy breakdowns, prediction analysis cards — not just text responses. Shows CopilotKit's most advanced capability.

### 6. Datadog Workflow Automation for Self-Healing Agents
**Impact: HIGH | Effort: MEDIUM**
When "Prediction Accuracy Below Target" monitor fires -> Workflow queries Neo4j for alternate strategies -> pushes recommendation to agent via MCP -> agent adjusts in next round. Self-healing, observable AI.

### 7. 3d-force-graph Link Particles for "Thinking Energy"
**Impact: MEDIUM | Effort: LOW**
Small animated spheres flowing along imagination tree branches. Direction indicates prediction flow, speed indicates confidence. Tiny code change, big visual impact.

### 8. Tone.js Data-Driven Audio
**Impact: MEDIUM | Effort: MEDIUM**
Confidence maps to pitch. Correct predictions resolve to major chord. Wrong predictions dissolve with dissonance. The Double Collapse gets a crystallization chime. Audio makes the demo 3x more memorable.

### 9. Neo4j FastRP Embeddings for Strategy Similarity
**Impact: MEDIUM | Effort: LOW**
Use GDS FastRP to generate strategy embeddings from graph structure (not LLM). These capture relational patterns that text embeddings miss. Use for "find strategies structurally similar to this one."

### 10. Datadog Software Catalog for Service Registration
**Impact: MEDIUM | Effort: LOW**
Register Agent Red, Agent Blue, Judge, Match API, WebSocket Server as services with ownership, on-call, and dependencies. Takes 30 minutes. Shows judges enterprise operational maturity.

---

## 12. Practical Notes <a name="practical-notes"></a>

### What's GA vs Preview

| Feature | Status | Notes |
|---------|--------|-------|
| AgentCore Runtime | GA | Full production use |
| AgentCore Gateway | GA | MCP-compatible tools |
| AgentCore Memory | GA | Episodic + long-term |
| AgentCore Identity | GA | OAuth + IAM |
| AgentCore Observability | GA | OTel to CloudWatch |
| AgentCore Policy (Cedar) | **Preview** | May have rough edges |
| AgentCore Evaluations | **Preview** | May have rough edges |
| AgentCore Bi-Directional Streaming | GA | Dec 2025 |
| AgentCore A2A Protocol | GA (Runtime) | Broader support coming |
| Datadog MCP Server | **Preview** | Free during preview |
| Datadog Bits AI SRE | GA | Dec 2025 |
| Datadog Notebooks | GA | Stable |
| Datadog Workflow Automation | GA | 1750+ actions |
| Neo4j GDS | GA | Need AuraDB Pro for full GDS |
| Neo4j APOC | GA | Match version to Neo4j |
| MongoDB Change Streams | GA | Requires replica set (Atlas is fine) |
| MongoDB Atlas Vector Search | GA | |
| CopilotKit AG-UI | GA | v1.0 released |
| CopilotKit Generative UI | GA | |

### Free Tier Limits That Matter

| Service | Free Tier | Enough for Hackathon? |
|---------|-----------|----------------------|
| Neo4j AuraDB Free | 200K nodes, 400K relationships | YES — ~50K nodes for 100 matches |
| MongoDB Atlas Free (M0) | 512MB storage, shared cluster | YES — 100 match documents ~5MB |
| Datadog Trial | 14-day free trial, all features | YES — hackathon fits in trial |
| AWS Bedrock | Pay per token, ~$3/1M input tokens | YES — with hackathon credits |
| CopilotKit Cloud | Free tier available | YES |

### Key SDK Versions to Pin

```
bedrock-agentcore >= 1.0.0
boto3 >= 1.35.0
neo4j >= 5.25.0
graphdatascience >= 1.12
pymongo >= 4.10.0
ddtrace >= 2.18.0
datadog >= 0.50.0
copilotkit >= 1.5.0 (React)
3d-force-graph >= 1.78.0
framer-motion >= 11.0.0 (now "motion")
howler >= 2.2.0
tone >= 15.0.0
socket.io >= 4.8.0
```

### Architecture Decision: LangGraph or Raw AgentCore?

**Option A: Raw AgentCore (Current plan)**
- Pros: Direct AWS integration, simpler, fewer layers
- Cons: Manual WebSocket wiring, no frontend state sync

**Option B: LangGraph + AgentCore + CopilotKit CoAgents**
- Pros: useCoAgent for automatic frontend sync, AG-UI protocol, LangGraph state management
- Cons: Extra dependency, learning curve, may complicate AgentCore integration

**Recommendation:** Start with Raw AgentCore (Option A), but structure the agent code so LangGraph could wrap it later. The bi-directional streaming from AgentCore essentially gives us the real-time features we'd get from CoAgents anyway.

### Data Flow Enhancement with Change Streams

```
Current plan:
  Match ends -> API writes to MongoDB -> Frontend polls for update

Enhanced plan:
  Match ends -> API writes to MongoDB
                  |
                  v
          Change Stream fires
                  |
          +-------+-------+
          |       |       |
          v       v       v
    Socket.IO   Datadog   Neo4j
    (live UI)   (metrics) (graph update)
```

This event-driven architecture eliminates polling and ensures all systems update simultaneously.
