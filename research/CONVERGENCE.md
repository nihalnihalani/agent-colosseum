# Agent Colosseum — Convergence Strategy

> Synthesized from 5 parallel research agents. This is the final strategic playbook.

---

## CRITICAL CONTEXT: ONE-DAY HACKATHON

**Date:** February 20, 2026 (4 days from now)
**Build time:** ~8-10 hours (9 AM - 8 PM)
**Venue:** AWS Builder Loft, 525 Market St, San Francisco

Everything below is scoped to what's buildable in ONE DAY.

---

## 1. What We're Building (The 60-Second Version)

> "You're watching two AI agents compete. But this isn't just a game — it's a measurement system.
>
> Before every move, each agent uses Amazon Bedrock to simulate what its opponent will do next. Those branching lines? Those are imagined futures.
>
> Now watch — [Double Collapse] — wrong predictions dissolve. Correct ones light up gold.
>
> Datadog tracks everything: prediction accuracy, imagination cost, strategy evolution. Neo4j stores every strategy relationship as a graph.
>
> Agent Colosseum is an observability-first platform for understanding how AI agents reason under competition."

**Lead with observability, not entertainment.** The game is the means. Observable AI imagination is the product.

---

## 2. Prize Strategy (Focused)

| Prize | Strategy | Confidence |
|---|---|---|
| **Datadog Observability Award** | PRIMARY TARGET. Observable AI imagination = novel metric. 2-3 dashboards + LLM Obs + custom metrics. | 40-50% |
| **Neo4j Award** | SECONDARY TARGET. Authentic graph use case — strategy relationship queries that MongoDB can't do. | 35-45% |
| **AWS Credits** | TERTIARY. AgentCore Runtime + Bedrock usage. | 15-25% |
| **Cash (CopilotKit)** | BONUS. AI commentator via CopilotKit. Don't over-invest. | 15-25% |

---

## 3. The Kill List (What to Cut)

Based on Devil's Advocate + Systems Architect analysis:

| CUT | WHY |
|---|---|
| Game types 2 & 3 (Negotiation, Auction) | One polished game > three broken ones |
| AgentCore A2A Protocol | Adds complexity, not demo value. Direct HTTP invocation works. |
| AgentCore Cedar policies | Preview, adds no visual impact |
| AgentCore Evaluations | Preview, 4 regions only. Use LLMObs.submit_evaluation() instead |
| Neo4j GDS algorithms | **NOT AVAILABLE on AuraDB free tier** — use native Cypher |
| Neo4j Vector Search | Setup complexity for marginal demo value |
| 3D force-graph (initially) | Start 2D SVG + Framer Motion. Upgrade to 3D only if solid |
| Docker Compose | Run everything locally. Zero demo value |
| Traffic generator | Nice for testing, unnecessary for one-day build |
| 12 monitors / 6 SLOs | 3-4 monitors and 1-2 SLOs are plenty |
| Audience polls | Adds frontend complexity, not core |
| MongoDB Atlas | Optional. Store match data in Neo4j + memory. Add MongoDB only if time |

---

## 4. The Build Plan (One-Day Hackathon)

### Pre-Hackathon (Days Before — Feb 17-19)

**Infrastructure that CAN be set up ahead:**
- [ ] AWS account + Bedrock Claude access enabled
- [ ] AgentCore CLI installed, test deploy verified
- [ ] Neo4j AuraDB free instance created, schema loaded
- [ ] Datadog trial account, agent configured
- [ ] Next.js app scaffolded with CopilotKit
- [ ] Resource Wars game rules engine written (pure Python)
- [ ] Agent prediction prompt template designed + tested
- [ ] 20+ test matches pre-run to populate Neo4j + Datadog with historical data
- [ ] Datadog dashboards pre-built with historical data
- [ ] Fallback demo video recorded from test matches

### Hackathon Day (Feb 20) — Hour by Hour

**Hours 1-3: Core Game Loop (GATE 1: Does it play?)**
- [ ] Deploy Agent Red + Agent Blue to AgentCore Runtime
- [ ] Wire match loop: FastAPI orchestrates rounds, agents call Bedrock
- [ ] Verify: run 1 complete 10-round match end-to-end
- [ ] ddtrace auto-instruments Bedrock calls → Datadog LLM Obs

**Hours 3-5: Visualization (GATE 2: Does it look amazing?)**
- [ ] WebSocket streaming from FastAPI to Next.js frontend
- [ ] Split-screen match viewer with imagination tree (2D SVG first)
- [ ] The Double Collapse animation (Framer Motion / GSAP)
- [ ] Score display + accuracy meters
- [ ] Howler.js sound effects (crystallization chime, shatter)

**Hours 5-7: Intelligence + Observability (GATE 3: Is it deep?)**
- [ ] Neo4j: store round results, wire strategy pattern queries into agent prompts
- [ ] Datadog: DogStatsD custom metrics (prediction accuracy, round latency)
- [ ] Datadog: Verify LLM Obs dashboard shows live data
- [ ] CopilotKit AI commentator with useCopilotReadable match context
- [ ] Run 5+ live matches to generate fresh dashboard data

**Hours 7-9: Polish + Demo Prep (GATE 4: Can we present it?)**
- [ ] Upgrade to 3D force-graph if 2D is solid (otherwise keep 2D)
- [ ] Agent personality system (at least 2: aggressive + defensive)
- [ ] Glassmorphism dark theme styling
- [ ] Demo rehearsal (3+ run-throughs)
- [ ] Verify hybrid demo script works (live rounds + pre-computed acceleration)

**Hour 9-10: Buffer + Submission**
- [ ] Final bug fixes
- [ ] Ensure fallback video is ready
- [ ] Submit

---

## 5. Top Creative Mechanics (Feasibility-Adjusted for One Day)

### Mechanic 1: "Agents as Services" — Datadog Service Catalog
**Feasibility: HIGH (mostly YAML config, 30 min)**
Register Agent Red, Agent Blue, Judge, Match API as Datadog services with ownership, SLOs, monitors, and dependency maps. Shows enterprise operational maturity. Directly targets Datadog Award.

### Mechanic 2: Neo4j Strategy Patterns via Native Cypher
**Feasibility: HIGH (pre-built queries)**
Since GDS is unavailable on free tier, use powerful native Cypher instead:
- "What counter-strategy beats aggressive openings?" (graph traversal)
- "Detect 3-move sequences that predict bluffs" (path query)
- "Prediction accuracy by opponent strategy" (aggregation)
These queries are genuinely graph-native — MongoDB can't do them. This IS the Neo4j prize case.

### Mechanic 3: Sound Design (Howler.js)
**Feasibility: HIGH (7KB library, 1-2 hours)**
Crystallization chime on correct predictions, soft shatter on wrong predictions, ambient drone during thinking. 50% of the wow factor for 5% of the effort. No other team will have audio.

### Mechanic 4: Auto-Highlight Detection (Stretch)
**Feasibility: MEDIUM (if MongoDB is integrated)**
MongoDB Change Streams detect highlight moments (90%+ accuracy, score reversals, strategy pivots) and push to frontend as visual flashes. Shows event-driven architecture.

### Mechanic 5: CopilotKit AI Commentator
**Feasibility: HIGH (CopilotKit is well-documented)**
AI commentator explains what's happening in natural language. Uses useCopilotReadable for match context. Bridges the gap between visual spectacle and understanding.

---

## 6. The Demo Script (3 Minutes)

### Act 1: Wonder (0:00 - 0:45)
- Match is already mid-round when pitch starts
- Branches grow on screen (live Bedrock call)
- **THE DOUBLE COLLAPSE** — wrong predictions dissolve with shatter sound, correct ones flash gold with crystallization chime
- "Each branch is a future the AI imagined using Amazon Bedrock"

### Act 2: Depth (0:45 - 1:45)
- "But we don't just watch — we measure"
- Show Datadog dashboard: prediction accuracy trending, token cost per round
- Show Neo4j query: "What beats aggressive openings?" → results in one traversal
- "This is observable AI imagination"
- Switch to accelerated pre-computed rounds showing strategy evolution

### Act 3: Climax (1:45 - 3:00)
- Resume live for final 2 rounds
- The underdog agent starts predicting correctly — narrative reversal
- CopilotKit commentator summarizes: "Blue adapted in Round 8..."
- Match ends, winner celebration
- Close: "Agent Colosseum. An observability-first platform for understanding how AI agents reason under competition."

### Fallback Plan
| Failure | Recovery |
|---|---|
| Bedrock slow | Show 1 live round → switch to pre-computed replay |
| Viz doesn't render | Switch to pre-recorded video |
| Complete crash | Pre-recorded 3-min demo video |

---

## 7. Key Risks + Mitigations

| # | Risk | Mitigation |
|---|---|---|
| 1 | **AgentCore Runtime deploy fails** | Test Day 1. Fallback: run agents locally via FastAPI |
| 2 | **Bedrock latency (3-15s per call)** | Stream responses. "Thinking time" is a feature. Pre-compute fallback data |
| 3 | **"So what?" question from judges** | Lead with observability, not entertainment. "How do you measure AI thinking quality?" |
| 4 | **Predictions are low quality** | Temperature tuning. Personality constraints. Even random looks cool in the viz |
| 5 | **GDS unavailable on free tier** | Already mitigated: native Cypher queries. Still powerful and graph-native |
| 6 | **Scope creep on hackathon day** | Strict hour-by-hour gates. If Gate 1 fails by Hour 3, simplify immediately |

---

## 8. Technology Stack (Final)

### Backend
| Tech | Role | Status |
|---|---|---|
| Python 3.12 | Primary language | GA |
| Amazon Bedrock (Claude Sonnet) | Agent reasoning | GA |
| Bedrock AgentCore Runtime | Agent microVM isolation | GA (SDK alpha) |
| FastAPI | Match server + WebSocket | Stable |
| Neo4j AuraDB Free | Strategy graph | GA |
| ddtrace | Datadog auto-instrumentation | GA |
| DogStatsD | Custom metrics | GA |
| boto3 | AWS SDK | GA |

### Frontend
| Tech | Role | Status |
|---|---|---|
| Next.js 15 | App framework | Stable |
| CopilotKit | AI commentator | GA |
| Framer Motion | Animations | GA |
| GSAP | Timeline choreography (Double Collapse) | Stable |
| Howler.js | Sound effects | Stable |
| 3d-force-graph | Imagination tree (stretch) | Stable |

### Optional (Time Permitting)
| Tech | Role |
|---|---|
| MongoDB Atlas | Match archive + Change Streams |
| Socket.IO | Enhanced WebSocket with rooms |
| html2canvas | Shareable recap cards |
| Lottie | Micro-animations |

---

## 9. What Makes This Win

1. **The Double Collapse** — A signature visual moment no other team has. Branches dissolve and crystallize with sound. This is the 10-second screenshot test.

2. **Observable AI Imagination** — A genuinely novel Datadog use case. Not just "we added a dashboard" but "observability IS the product." Measures prediction accuracy, imagination cost, strategy evolution.

3. **Authentic Neo4j Usage** — Strategy relationship queries that demonstrate real graph thinking. "What 3-move sequence predicts a bluff?" is a natural graph traversal.

4. **Sound Design** — The one thing nobody else will have. Crystallization chimes and shatter effects make the demo multisensory and memorable.

5. **Reframed Pitch** — "How do you measure whether an AI agent is actually thinking well?" is a better question than "watch two AIs fight."

---

## 10. Files Reference

| File | Author | Contents |
|---|---|---|
| `research/tool-inventory.md` | Tool Scout | Full tool landscape, 20 underused features, 10 hidden gems |
| `research/creative-mechanics.md` | Creative Hacker | 5 ranked mechanics, 3 wild cards, integration map |
| `research/ux-strategy.md` | UX Strategist | 3 user journeys, interaction loop, demo narrative, sound design blueprint |
| `research/architecture.md` | Systems Architect | Tech readiness table, tiered architecture, risk registry, pre-computation strategy |
| `research/reality-check.md` | Devil's Advocate | Top 5 risks, competitive analysis, pitch sharpening, prize assessment |
| `research/CONVERGENCE.md` | Team Lead | This document — the final synthesized strategy |
