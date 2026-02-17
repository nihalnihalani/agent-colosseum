# Agent Colosseum - Systems Architecture Assessment

> Ruthlessly honest technical assessment. What's real, what's risky, and what's the minimum viable demo that wins prizes.

---

## 1. Technology Readiness Assessment

| Technology | Status | Version / Notes | Hackathon Risk | Confidence |
|---|---|---|---|---|
| **Amazon Bedrock (Claude Sonnet)** | GA | invoke_model / invoke_model_with_response_stream via boto3 | LOW | HIGH |
| **Bedrock AgentCore Runtime** | GA (Oct 2025) | SDK v1.2.1 (Feb 2026), Python 3.10-3.13. `BedrockAgentCoreApp` + `@app.entrypoint` pattern works. Direct code deploy (zip) or container. MicroVM per session is real. | LOW-MEDIUM | HIGH |
| **AgentCore Gateway (MCP)** | GA | Zero-code MCP tool creation from APIs/Lambda. Supports MCP protocol 2025-06-18. Can register custom tools. | LOW | HIGH |
| **AgentCore A2A Protocol** | GA (Nov 2025) | Agents deploy as A2A servers on port 9000. Stateless HTTP. Works in Runtime. | MEDIUM | MEDIUM-HIGH |
| **AgentCore Memory (Episodic)** | GA | Episodic memory captures context, reasoning, actions, outcomes. Reflection agent extracts patterns. `MemoryClient` API exists. | MEDIUM | MEDIUM |
| **AgentCore Policy (Cedar)** | PREVIEW | Natural language OR Cedar policies. Applied outside reasoning loop. Available in all AgentCore regions. | MEDIUM-HIGH | MEDIUM |
| **AgentCore Evaluations** | PREVIEW | 13 built-in evaluators (helpfulness, tool_selection, accuracy). Custom evaluators supported. Available in 4 regions (us-east-1, us-west-2, ap-southeast-2, eu-central-1). | MEDIUM | MEDIUM |
| **AgentCore Observability** | GA | OTel-compatible telemetry. Exports to Datadog, LangSmith, Langfuse. Uses ADOT for instrumentation. Traces, metrics, spans stored in CloudWatch by default. | LOW | HIGH |
| **Datadog LLM Observability** | GA | Auto-instruments Bedrock via botocore/boto3. `ddtrace-run` enables all integrations. Captures latency, errors, tokens, I/O messages. Does NOT trace embeddings. | LOW | HIGH |
| **Datadog DogStatsD** | GA | Custom metrics via `DogStatsd`. Singleton pattern proven. Counters, gauges, timers, distributions. | LOW | HIGH |
| **Datadog MCP Server** | PREVIEW | Queries metrics, logs, traces from Datadog. `list_metrics` + `get_metrics` tools. Usable by agents for self-monitoring. | MEDIUM | MEDIUM |
| **Datadog Dashboards (Terraform)** | GA | `datadog_dashboard` and `datadog_dashboard_json` resources in Terraform. Full programmatic creation. Also Datadog API v2. | LOW | HIGH |
| **Neo4j AuraDB Free** | GA | 200K nodes, 400K relationships. No credit card. Vector search GA (with filters in preview as of Jan 2026). | LOW | HIGH |
| **Neo4j GDS on AuraDB Free** | NOT AVAILABLE | GDS algorithms NOT available on free tier. Need paid tier or Aura Graph Analytics. | HIGH | HIGH (confirmed unavailable) |
| **Neo4j Vector Search** | GA | On AuraDB, cosine/euclidean similarity. CREATE VECTOR INDEX works. Filters in preview. | LOW | HIGH |
| **CopilotKit** | GA | React + Angular. `useCopilotReadable`, `useCopilotAction`, `CopilotChat`. AG-UI protocol for agent-to-UI streaming. | LOW | HIGH |
| **CopilotKit CoAgents** | GA | Shared state (Agent <-> App). `useCoAgent` hook. Works with LangGraph. SSE/streaming supported via AG-UI. | MEDIUM | MEDIUM-HIGH |
| **3d-force-graph** | Stable | v1.78+. ThreeJS/WebGL. Dynamic import required for Next.js (no SSR). Performance good for <1000 nodes. NgGraph engine for large graphs. | LOW | HIGH |
| **MongoDB Atlas** | GA | Free M0 tier: 512MB storage. Sufficient for hackathon. | LOW | HIGH |

### Key Findings

1. **AgentCore is REAL and DEPLOYED.** The SDK (v1.2.1) is on PyPI, the `BedrockAgentCoreApp` pattern works, direct code deploy is available. This is not vaporware.

2. **Policy and Evaluations are PREVIEW.** They work but may have rough edges. Cedar policies are real but the Cedar-in-AgentCore integration is new. Evaluations have 13 built-in evaluators but are only in 4 regions.

3. **A2A Protocol is IMPLEMENTED.** Agents can be deployed as A2A servers in AgentCore Runtime. The protocol is HTTP-based on port 9000. This is workable but adds deployment complexity.

4. **GDS on AuraDB Free is NOT AVAILABLE.** This kills any plan to run PageRank, community detection, or path-finding algorithms on the free tier. We must rely on native Cypher queries (SHORTEST path, aggregations, pattern matching) which are still powerful.

5. **Datadog auto-instruments Bedrock.** `ddtrace-run` captures Bedrock calls automatically. LLM Obs is production-ready. This is the easiest integration in the stack.

6. **Datadog MCP Server is Preview.** It works for querying metrics but is not battle-tested. Agent self-monitoring via Datadog MCP is a nice demo feature but should not be on the critical path.

---

## 2. High-Level Architecture - What We Actually Build

```
+------------------------------------------------------------------------+
|                         AGENT COLOSSEUM MVP                            |
|                                                                        |
|  TIER 1: MUST WORK (Critical Path)                                    |
|  =========================================                             |
|                                                                        |
|  [FastAPI Match Server]                                                |
|       |                                                                |
|       +----> [Agent Red] ---> [Bedrock Claude Sonnet]                  |
|       |      (AgentCore Runtime, direct code deploy)                   |
|       |                                                                |
|       +----> [Agent Blue] ---> [Bedrock Claude Sonnet]                 |
|       |      (AgentCore Runtime, direct code deploy)                   |
|       |                                                                |
|       +----> [Judge Logic] (in-process, NOT a separate agent)          |
|       |                                                                |
|       +----> [WebSocket] ----> [Next.js + CopilotKit Frontend]        |
|       |                        |                                       |
|       |                        +-> Split-screen match viewer           |
|       |                        +-> 3d-force-graph imagination tree     |
|       |                        +-> CopilotChat AI commentator          |
|       |                                                                |
|       +----> [ddtrace] ------> [Datadog LLM Obs + Dashboards]         |
|       |      (auto-instruments Bedrock calls)                          |
|       |                                                                |
|       +----> [Neo4j AuraDB] -- Strategy graph (Cypher queries)         |
|       |      (free tier, 200K nodes)                                   |
|       |                                                                |
|       +----> [DogStatsD] ----> [Datadog Custom Metrics]                |
|                                                                        |
|  TIER 2: IMPRESSIVE ADDITIONS (If Time Permits)                       |
|  =========================================                             |
|                                                                        |
|  - AgentCore A2A Protocol between Red/Blue/Judge                       |
|  - AgentCore Memory (Episodic) for cross-match learning                |
|  - AgentCore Gateway with MCP game tools                               |
|  - AgentCore Evaluations (13 built-in + custom)                        |
|  - Datadog MCP for agent self-monitoring                               |
|  - Neo4j Vector Search for game state similarity                       |
|  - LLMObs.submit_evaluation() for prediction quality tracking          |
|  - Terraform dashboard-as-code                                         |
|  - MongoDB Atlas for match archive                                     |
|                                                                        |
|  TIER 3: DEMO POLISH (Final Days)                                     |
|  =========================================                             |
|                                                                        |
|  - AgentCore Policy (Cedar) for fair play                              |
|  - Behavioral contracts (Sworn-style)                                  |
|  - Traffic generator for demo scenarios                                |
|  - Multiple game types (Negotiation, Auction)                          |
|  - Audience prediction polls                                           |
|  - Pre-recorded fallback videos                                        |
+------------------------------------------------------------------------+
```

### Architecture Decisions

**Decision 1: Judge is NOT a separate AgentCore agent in MVP.**
- Rationale: Deploying 3 separate AgentCore Runtime instances and coordinating them via A2A adds significant complexity. The Judge logic is deterministic (validate moves, compute scores). It belongs in the FastAPI server.
- Upgrade path: Move Judge to AgentCore Runtime in Tier 2 when A2A is working.

**Decision 2: Agents call Bedrock directly via boto3, instrumented by ddtrace.**
- Rationale: The simplest path that still uses AgentCore Runtime. Agent code runs in microVM, calls Bedrock. ddtrace auto-instruments botocore calls.
- This gives us: AgentCore Runtime (microVM isolation) + Bedrock + Datadog LLM Obs with minimal integration risk.

**Decision 3: WebSocket from FastAPI, not from AgentCore directly.**
- Rationale: AgentCore Runtime agents are stateless HTTP on port 9000. They don't maintain WebSocket connections. The FastAPI server orchestrates the match loop and streams events to the frontend.

**Decision 4: Neo4j queries use native Cypher, not GDS algorithms.**
- Rationale: GDS is not available on AuraDB free tier. Cypher's SHORTEST path, pattern matching, and aggregation queries are sufficient for strategy pattern analysis. Vector search IS available.

**Decision 5: CopilotKit for AI Commentator, not for game control.**
- Rationale: CopilotKit shines at adding AI chat with context awareness (`useCopilotReadable`). Using it for match control adds unnecessary complexity. Keep game logic in FastAPI.

---

## 3. MVP Plan - Ordered Build List

### Phase 1: Core Game Loop (Days 1-4) -- CRITICAL PATH
| # | Task | Time | Dependencies |
|---|------|------|------|
| 1.1 | Set up AWS account, enable Bedrock Claude access, install AgentCore CLI | 2h | None |
| 1.2 | Write Resource Wars game rules engine (pure Python, no AI) | 4h | None |
| 1.3 | Write agent prediction prompt template + JSON output parser | 3h | None |
| 1.4 | Create single agent that calls Bedrock for opponent prediction | 3h | 1.1, 1.3 |
| 1.5 | Build match loop: 2 agents, 10 rounds, sequential predict-move-resolve | 4h | 1.2, 1.4 |
| 1.6 | Deploy agents to AgentCore Runtime (direct code deploy) | 4h | 1.4 |
| 1.7 | Verify match loop works end-to-end with AgentCore deployed agents | 2h | 1.5, 1.6 |

**Milestone: Can run a complete 10-round match between two AI agents via AgentCore Runtime.**

### Phase 2: Datadog Integration (Days 3-6) -- START EARLY
| # | Task | Time | Dependencies |
|---|------|------|------|
| 2.1 | Set up Datadog agent (Docker) + ddtrace | 2h | None |
| 2.2 | Enable LLM Obs auto-instrumentation (`ddtrace-run`) | 1h | 2.1 |
| 2.3 | Add DogStatsD singleton + arena custom metrics | 3h | 2.1 |
| 2.4 | Create Dashboard 1: "War Room" (live match metrics) | 3h | 2.3 |
| 2.5 | Add `LLMObs.submit_evaluation()` for prediction accuracy | 2h | 2.2, Phase 1 |
| 2.6 | Create Dashboard 2: "Imagination Efficiency" (LLM cost) | 2h | 2.5 |
| 2.7 | Create Dashboard 3: "Evolution" (cross-match analytics) | 2h | 2.5 |

**Milestone: 3 Datadog dashboards with live data from real matches.**

### Phase 3: Neo4j Strategy Graph (Days 5-8)
| # | Task | Time | Dependencies |
|---|------|------|------|
| 3.1 | Set up Neo4j AuraDB free instance | 1h | None |
| 3.2 | Create graph schema (Agent, Match, Round, Move, Prediction, Strategy) | 2h | None |
| 3.3 | Write Cypher queries: best counter-strategy, multi-round patterns, accuracy by strategy | 3h | 3.2 |
| 3.4 | Integrate: store round results in Neo4j after each round | 2h | Phase 1, 3.2 |
| 3.5 | Integrate: inject Neo4j strategy patterns into agent prompts | 3h | 3.3, 3.4 |
| 3.6 | Run 20+ matches to populate strategy graph | 2h | 3.5 |
| 3.7 | Add vector search for similar game state lookup | 3h | 3.6 |

**Milestone: Agents use Neo4j graph data to inform strategy. 5 Cypher queries demonstrate graph value.**

### Phase 4: Frontend Visualization (Days 7-14)
| # | Task | Time | Dependencies |
|---|------|------|------|
| 4.1 | Next.js app scaffold + CopilotKit setup | 3h | None |
| 4.2 | WebSocket server in FastAPI for match streaming | 3h | Phase 1 |
| 4.3 | Split-screen match viewer (static first) | 3h | 4.1 |
| 4.4 | 3d-force-graph: imagination tree component (dynamic import) | 6h | 4.1 |
| 4.5 | Wire WebSocket to 3d-force-graph: branches grow in real-time | 4h | 4.2, 4.4 |
| 4.6 | The Double Collapse animation (correct=gold, wrong=dissolve) | 4h | 4.5 |
| 4.7 | CopilotKit AI Commentator with `useCopilotReadable` match context | 3h | 4.1, 4.2 |
| 4.8 | Glassmorphism UI styling (dark theme, glow effects) | 3h | 4.3 |
| 4.9 | Score display, round counter, accuracy meters | 2h | 4.3 |

**Milestone: Full spectator experience with 3D imagination trees, real-time updates, AI commentator.**

### Phase 5: AgentCore Deep Integration (Days 12-16)
| # | Task | Time | Dependencies |
|---|------|------|------|
| 5.1 | AgentCore Gateway: register game tools as MCP endpoints | 4h | Phase 1 |
| 5.2 | AgentCore Memory: store and retrieve episodic memories | 4h | Phase 1 |
| 5.3 | AgentCore A2A Protocol: Red <-> Judge <-> Blue communication | 6h | Phase 1 |
| 5.4 | AgentCore Evaluations: custom prediction quality evaluator | 3h | Phase 1 |
| 5.5 | AgentCore Policy (Cedar): fair play rules | 3h | Phase 1 |
| 5.6 | AgentCore Observability -> Datadog pipeline via ADOT | 4h | 2.1 |

**Milestone: 6/9 AgentCore services integrated (Runtime, Gateway, Memory, A2A, Evaluations, Observability). Policy as stretch.**

### Phase 6: Polish & Demo Prep (Days 15-18)
| # | Task | Time | Dependencies |
|---|------|------|------|
| 6.1 | Agent personality system (aggressive, defensive, adaptive, chaotic) | 3h | Phase 1 |
| 6.2 | Traffic generator for demo scenarios | 3h | All phases |
| 6.3 | Pre-record fallback demo video | 2h | Phase 4 |
| 6.4 | Terraform dashboard-as-code export | 2h | Phase 2 |
| 6.5 | Run 50+ matches to build rich data | 3h | All phases |
| 6.6 | Demo rehearsal (5+ run-throughs) | 3h | All phases |
| 6.7 | MongoDB Atlas integration for match archive (optional) | 3h | Phase 1 |
| 6.8 | Second game type (Negotiation) if time allows | 4h | Phase 1 |

---

## 4. Critical Path

```
[AWS Setup + Bedrock Access]
         |
         v
[Agent Prediction Logic + Game Rules Engine]
         |
         v
[Match Loop: 2 Agents, 10 Rounds, End-to-End]  <---- GATE 1: Does it play?
         |
         +---------------+-------------------+
         |               |                   |
         v               v                   v
  [AgentCore          [Datadog             [Neo4j
   Runtime             LLM Obs +            Strategy
   Deploy]             Dashboards]          Graph]
         |               |                   |
         +---------------+-------------------+
         |
         v
[WebSocket Streaming + Next.js Frontend]
         |
         v
[3d-force-graph Imagination Tree]  <---- GATE 2: Does it look amazing?
         |
         v
[CopilotKit AI Commentator]
         |
         v
[Double Collapse Animation + Polish]  <---- GATE 3: Is it demo-ready?
         |
         v
[AgentCore Deep Features (A2A, Memory, Gateway, Evaluations)]
         |
         v
[Demo Rehearsal + Fallback Videos]  <---- GATE 4: Can we present it?
```

### What MUST Work for Demo
1. Two agents running in AgentCore Runtime making Bedrock calls
2. Predictions visible as branching 3D imagination trees
3. The Double Collapse animation when moves are revealed
4. At least 2 Datadog dashboards with live data
5. Neo4j graph with at least 3 queryable strategy patterns
6. CopilotKit AI commentator that can answer questions about the match

### What's Nice-to-Have
- A2A Protocol between agents (can use direct invocation instead)
- AgentCore Memory for cross-match learning
- AgentCore Policy (Cedar) for fair play
- Datadog MCP for agent self-monitoring
- Multiple game types
- Audience polls
- MongoDB archive

---

## 5. Risk Registry

| # | Risk | Likelihood | Impact | Mitigation | Fallback |
|---|------|-----------|--------|------------|----------|
| R1 | **AgentCore Runtime deploy fails / is slow** | Medium | High | Test deploy on Day 1. Use direct_code_deploy (zip) not containers for speed. | Run agents locally with FastAPI. Claim "AgentCore-compatible" architecture. Still show the SDK code. |
| R2 | **Bedrock latency makes rounds feel sluggish** | Medium | High | Stream predictions with `invoke_model_with_response_stream`. Design 6-second round pacing. | Pre-compute some rounds. Show "accelerated replay" mode with pre-generated data. |
| R3 | **3d-force-graph chokes on frequent real-time updates** | Low-Medium | High | Batch node updates (update every 500ms, not per-token). Limit to <50 nodes per tree. Use NgGraph engine if needed. Memoize React component. | Fall back to 2D SVG tree with Framer Motion (already in PROJECT.md). |
| R4 | **A2A Protocol setup is complex / unreliable** | Medium | Medium | Don't put A2A on critical path. Agents are invoked directly by match server via HTTP. | Direct `agentcore invoke` or HTTP calls. Same result, less ceremony. |
| R5 | **AgentCore Memory API has undocumented limitations** | Medium | Medium | Test early. Memory is a Tier 2 feature. | Store "memories" in a simple JSON file or SQLite. Inject into prompts manually. Still demonstrate the concept. |
| R6 | **AgentCore Policy (Cedar) is too new / buggy** | Medium-High | Low | Policy is Tier 3. Demo Cedar rules in code even if runtime enforcement is flaky. | Show Cedar policy files. Explain the architecture. Enforce rules in Python as validation layer. |
| R7 | **GDS algorithms unavailable on AuraDB free** | CONFIRMED | Medium | Already mitigated: use Cypher-only queries. SHORTEST path, pattern matching, aggregation are native and powerful. | N/A - already using fallback. |
| R8 | **Datadog dashboard creation takes too long** | Low | Medium | Start dashboards Day 3. Use Terraform for reproducibility. Export JSON for backup. | Import pre-built dashboard JSON via API. |
| R9 | **Agent predictions are low quality / nonsensical** | Medium | High | Temperature tuning (0.6-0.8). Structured JSON output with validation. Inject Neo4j strategy context. Personality system creates variety. | Even random predictions look visually interesting in 3d-force-graph. The visualization is the star. |
| R10 | **WebSocket reliability issues between FastAPI and frontend** | Low | Medium | Use battle-tested `websockets` library. Implement reconnection logic. | Fall back to SSE (Server-Sent Events) which is simpler. Or polling with 1s interval. |
| R11 | **CopilotKit integration is more complex than expected** | Low | Low | CopilotKit has good docs. Start with basic `CopilotChat` + `useCopilotReadable`. | Replace with a simple chat UI that calls Bedrock directly. |
| R12 | **AgentCore Observability -> Datadog pipeline has gaps** | Medium | Medium | AgentCore emits OTel. Datadog consumes OTel. The path exists. ADOT may need configuration. | Use ddtrace directly on Bedrock calls (auto-instrumented). Skip AgentCore's OTel layer. Same result. |
| R13 | **Demo crashes live** | Medium | Critical | Pre-record backup video for every demo scenario. Practice 5+ times. Have "replay mode" that plays back pre-generated match data. | Switch to video. "Live demos and hackathons - let me show you from our test environment." |

---

## 6. Constraints as Features

| Constraint | Spin |
|---|---|
| **GDS not available on AuraDB free** | "We chose native Cypher queries over GDS for lower latency and simpler deployment. Graph traversal for strategy patterns is instantaneous with Cypher." |
| **Judge is in-process, not a separate agent** | "The Judge uses deterministic rules, not AI reasoning. Keeping it in the match server ensures millisecond resolution and eliminates LLM latency from the scoring path." |
| **Only one game type in MVP** | "Resource Wars has the deepest strategy space. We optimized for emergent behavior depth over breadth. Additional games are plug-in modules." |
| **Agents predict 3 moves, not unlimited** | "Three predictions is the sweet spot: enough to show branching futures, few enough that each branch is meaningful and visually distinct." |
| **6-second round pacing** | "Designed for spectator engagement. Like a boxing round - brief enough to maintain tension, long enough to see the AI 'think'." |
| **No real-time audio commentary** | "Text-based AI commentary via CopilotKit lets spectators ask questions and get personalized analysis - more interactive than passive audio." |
| **AgentCore Policy in preview** | "We're early adopters of Cedar-based agent governance. This is the future of safe AI agent deployment." |

---

## 7. Pre-computation Strategy

### What to Generate Before Demo Day

| Asset | How to Generate | Purpose |
|---|---|---|
| **50+ completed matches** | Run traffic generator overnight | Populate Neo4j strategy graph, MongoDB archive, Datadog dashboards with rich historical data |
| **Neo4j graph with 10K+ nodes** | Side effect of 50+ matches | Shows graph queries returning meaningful strategy patterns, not empty results |
| **Datadog dashboards with 24h+ data** | Run matches over multiple days | Dashboards show trends, not just point-in-time metrics. Evolution dashboard shows learning curves. |
| **3 "highlight reel" matches** | Cherry-pick from test matches | Pre-identified matches with dramatic moments: close scores, prediction accuracy streaks, strategy pivots |
| **Fallback video** | Screen-record a good match | 3-minute backup demo video ready if live demo crashes |
| **Agent personality configs** | Tune temperature + system prompts through testing | 4 personality archetypes that produce visually distinct and strategically interesting behavior |
| **Neo4j strategy patterns** | Natural result of 50+ matches | At least 5 queryable patterns: "what beats aggressive openings", "bluff detection sequences", etc. |
| **Datadog monitors + SLOs** | Configure during build | 12 monitors and 6 SLOs already firing before demo. Shows operational maturity. |

### What MUST Be Live During Demo

1. **At least 1 live round** - Audience must see a real Bedrock call happen, branches grow, and collapse occur
2. **Real Datadog dashboards** - They should update when the live round executes
3. **Real Neo4j query** - Show a Cypher query returning actual strategy data
4. **CopilotKit commentator** - Ask it a question about the match, get a live response

### Demo Script: Hybrid Live + Pre-computed

```
0:00 - "Let me start a fresh match" -> Start live match
0:15 - Show Round 1 live (full 6-second animation)
0:30 - Show Round 2 live
0:45 - "Now let me show you what happens over many rounds..."
       -> Switch to pre-computed match replay (accelerated)
1:15 - Show Datadog dashboards (mix of live + historical data)
1:45 - Show Neo4j graph query (pre-populated + live data)
2:15 - Resume live match for final 2 rounds
2:45 - CopilotKit commentator summarizes
3:00 - End
```

This hybrid approach means:
- If Bedrock is slow, we show 1 live round then switch to pre-computed
- If Bedrock is fast, we show more live rounds
- Dashboards always have data regardless of live performance
- The "wow moment" (Double Collapse) happens at least once live

---

## 8. Estimated Total Build Time

| Phase | Time | Parallel? |
|---|---|---|
| Phase 1: Core Game Loop | 22h | No (sequential) |
| Phase 2: Datadog Integration | 15h | Yes (start Day 3, parallel with Phase 1 backend) |
| Phase 3: Neo4j Strategy Graph | 16h | Yes (start Day 5, parallel with Phase 2) |
| Phase 4: Frontend Visualization | 31h | Partially (can start UI scaffold Day 7, but needs backend) |
| Phase 5: AgentCore Deep Integration | 24h | Yes (parallel with Phase 4 after Phase 1 done) |
| Phase 6: Polish & Demo Prep | 23h | Yes (final days) |
| **Total** | **~131h** | Compresses to ~18 working days with parallelization |

### If We Only Have 10 Days
Cut Phase 5 (AgentCore deep integration) and Phase 6.8 (second game type). Focus on:
- Phases 1-4 (core loop, Datadog, Neo4j, frontend)
- Minimal Phase 5 (just AgentCore Runtime deploy, skip A2A/Memory/Policy)
- Demo prep only

This gives: a working game with 3D visualization, 3 Datadog dashboards, Neo4j strategy graph, CopilotKit commentator. Still impressive.

### If We Only Have 5 Days
Cut Phase 3.7 (vector search), Phase 4.6 (collapse animation becomes simpler), Phase 5 entirely. Run agents locally not in AgentCore Runtime. Pre-compute most match data.

This gives: a working demo with pre-generated data + 1-2 live rounds + dashboards + basic visualization.

---

## 9. Technology Integration Map

```
                    +-----------+
                    |  Bedrock  |
                    |  Claude   |
                    +-----+-----+
                          |
                   boto3 invoke_model
                          |
              +-----------+-----------+
              |                       |
     +--------+--------+    +--------+--------+
     |   Agent Red     |    |   Agent Blue    |
     | (AgentCore      |    | (AgentCore      |
     |  Runtime)       |    |  Runtime)       |
     +--------+--------+    +--------+--------+
              |                       |
         ddtrace auto-instruments both
              |                       |
              +----------++-----------+
                         ||
              HTTP invocations from Match Server
                         ||
                  +------++------+
                  | FastAPI      |
                  | Match Server |
                  +--+--+--+--+-+
                     |  |  |  |
          +----------+  |  |  +---------+
          |             |  |            |
    +-----+------+ +---+--+---+ +------+-----+
    | WebSocket  | | Neo4j    | | DogStatsD  |
    | -> Frontend| | AuraDB   | | -> Datadog |
    +-----+------+ +----------+ +------+-----+
          |                            |
    +-----+------+              +------+-----+
    | Next.js    |              | Datadog    |
    | CopilotKit |              | Dashboards |
    | 3d-force-  |              | LLM Obs    |
    | graph      |              | Monitors   |
    +------------+              +------------+
```

---

## 10. Key Technical Concerns

### Concern 1: AgentCore Runtime Deployment Reliability
The SDK is v1.2.1 and marked as "Alpha" development status on PyPI. While GA was announced in Oct 2025, the Python SDK's alpha designation means potential instability. Direct code deploy (zip) is newer than container deploy and may have edge cases. **Mitigation:** Test deploy Day 1. Have local FastAPI fallback ready.

### Concern 2: Real-Time 3D Visualization Performance
The 3d-force-graph needs to update in real-time as Bedrock streams predictions. If we update nodes per-token, we'll thrash the WebGL renderer. If we batch too aggressively, the "branches growing" effect is lost. **Mitigation:** Batch updates at 500ms intervals. Limit to 50 nodes per tree. Profile early.

### Concern 3: Bedrock Latency Variability
Bedrock response times can vary significantly (2-15 seconds). This directly impacts round pacing and spectator experience. Two concurrent agent calls doubles the risk of one being slow. **Mitigation:** Stream responses. Set timeouts. Have pre-computed fallback. Design the UI to feel intentional during "thinking" phase (pulsing avatar, "Imagining..." label).

---

*Written for the Agent Colosseum hackathon team. Last updated: February 2026.*
