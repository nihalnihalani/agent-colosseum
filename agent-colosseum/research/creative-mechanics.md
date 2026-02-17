# Creative Mechanics Research

> Turning overlooked hackathon tools into standout features that make judges say "I've NEVER seen that before."

---

## 1. Top Creative Mechanics

### Mechanic 1: "The Meta-Genome" -- Neo4j GDS Discovers Emergent Strategies

**Tool Repurposed:** Neo4j Graph Data Science (PageRank, Community Detection, Betweenness Centrality)

**How it works:**
After every match, run Neo4j GDS algorithms on the strategy graph to discover *emergent* meta-strategies that no one programmed:

- **PageRank on Move nodes:** Identifies which moves are most "influential" -- moves that lead to winning cascades. The highest-PageRank move isn't the most-used, it's the most *consequential*. Show judges: "This move only appeared 3 times, but every time it appeared, it triggered a winning sequence."
- **Community Detection (Louvain) on Strategy clusters:** Groups moves into strategy "families" that naturally emerge from match data. Instead of the 4 pre-programmed personalities (aggressive/defensive/adaptive/chaotic), the algorithm discovers 7-12 organic strategy clusters the agents invented themselves. Name them dynamically: "The Rope-a-Dope," "The Late Blitz," "The Mirror Trap."
- **Betweenness Centrality on GameState nodes:** Finds the *pivot states* -- game positions that sit on the critical path between winning and losing. These are the "fork in the road" moments. Visualize them as glowing nodes in the 3D graph: "This exact resource distribution was the turning point in 73% of matches."

```cypher
-- PageRank: Find the most influential moves across all matches
CALL gds.pageRank.stream('strategyGraph', { relationshipWeightProperty: 'led_to_win' })
YIELD nodeId, score
WITH gds.util.asNode(nodeId) AS move, score
WHERE move:Move
RETURN move.type, score ORDER BY score DESC LIMIT 10

-- Community Detection: Discover emergent strategy families
CALL gds.louvain.stream('strategyGraph')
YIELD nodeId, communityId
WITH gds.util.asNode(nodeId) AS move, communityId
RETURN communityId, collect(move.type) AS strategy_family, count(*) AS size
ORDER BY size DESC

-- Betweenness Centrality: Find pivot game states
CALL gds.betweenness.stream('gameStateGraph')
YIELD nodeId, score
WITH gds.util.asNode(nodeId) AS state, score
WHERE score > 0.5
RETURN state.hash, state.resources, score AS pivot_importance
ORDER BY score DESC LIMIT 5
```

**Why it's clever:** Most teams use Neo4j as a fancy document store. Running GDS algorithms to *discover* strategies the agents invented themselves shows genuine graph thinking. The judges see that the graph isn't decorative -- it's generating novel insights.

**"Aha moment":** A dashboard card titled "Strategies Nobody Programmed" showing a community detection visualization where clusters of moves are labeled with auto-generated names. The judge realizes these strategies *emerged* from adversarial play -- they weren't designed. One cluster might be "Sacrifice Round 3 to dominate Rounds 7-10" -- a strategy the agents discovered through reinforcement that no human wrote.

**Judge Impact:** 5/5 -- This is the kind of insight that makes a judge want to play with the data themselves.
**Feasibility:** 4/5 -- Neo4j GDS is well-documented, the queries are standard. The auto-naming of strategy clusters needs an LLM call but that's straightforward.

---

### Mechanic 2: "The Spectator's Oracle" -- CopilotKit CoAgent for Audience

**Tool Repurposed:** CopilotKit CoAgents (human-in-the-loop agents with shared state)

**How it works:**
Instead of CopilotKit just powering the AI commentator, give every spectator their own CoAgent -- a personal AI analyst that watches the match alongside them. The CoAgent:

1. **Has shared state with the match:** It sees everything the spectators see (predictions, scores, game state) via `useCopilotReadable`.
2. **Accepts natural language questions:** "Why did Red switch to defense?" or "What's Blue's win probability?" -- answered in real-time with match context.
3. **Offers personalized predictions:** The spectator's CoAgent independently predicts the next round's outcome using a lightweight prompt. The UI shows "Your Oracle predicts: Red wins Round 7 (68% confidence)." After the round, the spectator gets their own accuracy score.
4. **Enables spectator steering (HITL):** The CoAgent can suggest "What if Red played aggressively here?" and the spectator sees a hypothetical branch added to the imagination tree. This uses CopilotKit's human-in-the-loop capability -- the spectator "steers" a shadow agent.

```tsx
// Spectator's personal AI analyst
useCopilotAction({
  name: "predictNextRound",
  description: "Your Oracle makes an independent prediction for the next round",
  parameters: [
    { name: "favoredAgent", type: "string", description: "Which agent you think will win" }
  ],
  handler: async ({ favoredAgent }) => {
    // CoAgent reasons over match state + spectator's intuition
    const prediction = await oraclePrediction(matchState, favoredAgent);
    return `Oracle prediction: ${prediction.winner} wins Round ${prediction.round}
            (${prediction.confidence}% confidence). Reasoning: ${prediction.reasoning}`;
  }
});

// Shared state: spectator's prediction history syncs with the match UI
useCopilotReadable({
  description: "Spectator's Oracle accuracy tracking",
  value: {
    spectatorPredictions: oracleHistory,
    spectatorAccuracy: calculateAccuracy(oracleHistory),
    matchState: currentMatchState
  }
});
```

**Why it's clever:** CopilotKit's CoAgents were designed for "agent-native applications" where AI and humans collaborate. Most teams will use CopilotKit for a chatbot. We're using it to make the *audience* an active participant with their own AI. The "Spectator's Oracle" turns passive watching into an interactive prediction game.

**"Aha moment":** The judge opens the spectator view, asks their Oracle "Who wins this match?" and gets a reasoned prediction with a confidence score. After the match, the judge sees their personal accuracy: "Your Oracle scored 72% -- better than Agent Blue!" The judge just competed against the AI agents *without writing any code*.

**Judge Impact:** 5/5 -- Interactive, personal, and demonstrates CopilotKit's full capability stack (CoAgents, shared state, HITL).
**Feasibility:** 3/5 -- Requires careful CopilotKit CoAgent integration with LangGraph. The shared state is the hard part.

#### Build Tiers (Feasibility Fallback)

**Tier 1 -- "Crowd Wisdom" (2-3 hours, feasibility 5/5):**
No CoAgent at all. Simple audience prediction polls using React state + WebSocket. Before each round, spectators vote Red or Blue. After the round, show "67% of spectators predicted Red -- Blue surprised everyone!" Track cumulative audience accuracy vs each agent's accuracy. The aha moment becomes: "The crowd predicted 58% accurately -- worse than Agent Red (72%) but better than Agent Blue (41%)." This is just the `AudiencePoll` component already sketched in PROJECT.md, plus a running accuracy counter. CopilotKit's `useCopilotReadable` feeds the vote data to the AI commentator so it can reference crowd sentiment. Minimal CopilotKit usage, but enough to justify the integration.

**Tier 2 -- "Ask the Oracle" (4-6 hours, feasibility 4/5):**
Tier 1 plus a CopilotKit `CopilotChat` sidebar where spectators can ask natural language questions about the match: "Why did Red switch strategies?" or "What's Blue's win probability?" The chat uses `useCopilotReadable` to inject the full match state (scores, predictions, round history) so the LLM has context. No CoAgent needed -- this is standard CopilotKit chat with rich readable state. Still impressive to judges because the chat answers are grounded in live match data, not generic.

**Tier 3 -- "Personal Oracle" (8+ hours, feasibility 3/5):**
The full CoAgent vision described above. Each spectator gets an independent prediction agent with shared state streaming. Only attempt if CopilotKit CoAgent integration is already working and Tiers 1-2 are solid.

---

### Mechanic 3: "Auto-Highlight Reel" -- MongoDB Change Streams Generate Match Highlights

**Tool Repurposed:** MongoDB Change Streams + Datadog Workflow Automation

**How it works:**
MongoDB Change Streams watch for "highlight-worthy" moments as they're written to the match archive. When a trigger fires, Datadog Workflow Automation chains a response:

1. **Change Stream watches `matches` collection** for specific patterns:
   - Prediction accuracy >= 90% in a round ("Perfect Read!")
   - Score lead reversal ("Comeback!")
   - Strategy shift detected ("Pivot!")
   - 3+ consecutive correct predictions ("On Fire!")
   - Bluff successfully called ("Exposed!")

2. **Trigger fires to Datadog Workflow Automation:**
   - Workflow creates a Datadog Notebook cell with the highlight context
   - Workflow sends a WebSocket event to the frontend for a visual highlight flash
   - Workflow logs a custom event that the AI commentator (CopilotKit) picks up

3. **End result:** By match end, a Datadog Notebook has been auto-populated with every highlight moment, complete with graphs, metrics, and timestamps. Judges can click through an interactive post-match analysis that was built *during* the match.

```python
# MongoDB Change Stream watching for highlights
async def watch_for_highlights():
    pipeline = [
        {"$match": {
            "operationType": "update",
            "fullDocument.rounds": {"$exists": True}
        }}
    ]
    async with matches.watch(pipeline, full_document="updateLookup") as stream:
        async for change in stream:
            round_data = change["fullDocument"]["rounds"][-1]
            highlights = detect_highlights(round_data)
            for highlight in highlights:
                # Trigger Datadog Workflow
                await trigger_workflow("match-highlight", {
                    "type": highlight.type,
                    "round": round_data["round"],
                    "description": highlight.description,
                    "metrics_snapshot": highlight.metrics
                })

def detect_highlights(round_data):
    highlights = []
    for agent in ["red", "blue"]:
        accuracy = round_data[agent].get("prediction_correct")
        if accuracy and round_data[agent]["predictions"][0]["confidence"] > 0.8:
            highlights.append(Highlight("perfect_read", f"{agent} predicted with 80%+ confidence and was correct"))
    # ... more highlight detection logic
    return highlights
```

**Why it's clever:** MongoDB Change Streams are usually used for cache invalidation or sync. Using them as a "highlight detection engine" that feeds into Datadog Workflow Automation for auto-generated match analysis shows sophisticated event-driven architecture. The Datadog Notebook becomes a *living document* that writes itself during the match.

**"Aha moment":** After a 10-round match, the judge clicks "View Match Analysis" and opens a Datadog Notebook that was auto-generated. It has timestamped highlights ("Round 4: Blue pulled off the biggest comeback of the match -- see metrics"), embedded live graphs showing the exact moment scores reversed, and an AI-written summary. The judge didn't wait for a postmortem -- the system wrote it in real-time.

**Judge Impact:** 4/5 -- Shows deep integration across MongoDB + Datadog Workflow + Datadog Notebooks. Very impressive engineering.
**Feasibility:** 4/5 -- Change Streams are straightforward. Datadog Workflow Automation has a REST API trigger. Auto-populating Notebooks needs the Notebooks API.

---

### Mechanic 4: "Agents as Services" -- Datadog Service Catalog + SLOs for Each Agent

**Tool Repurposed:** Datadog Service Catalog (Software Catalog)

**How it works:**
Register each agent (Red, Blue, Judge) as a "service" in Datadog Service Catalog, complete with:

- **Ownership:** Each agent has an "owner" (the personality config that created it)
- **Runbooks:** Auto-generated runbooks: "If Agent Red's accuracy drops below 30%, check: (1) opponent switched to chaotic strategy, (2) Neo4j pattern cache is stale, (3) episodic memory is overfit to old opponent"
- **SLOs:** Each agent has Service Level Objectives tied to game performance:
  - "Prediction SLO: 90% of rounds, accuracy >= 30% (7-day window)"
  - "Latency SLO: 99% of rounds complete thinking in <= 12s"
  - "Strategy Diversity SLO: 90% of matches use >= 2 distinct strategies"
- **Dependencies:** Service map shows Agent Red -> Bedrock Claude, Agent Red -> Neo4j, Agent Red -> AgentCore Memory
- **Scorecards:** Each agent gets a "production readiness" scorecard graded on observability, documentation, performance, and security (Cedar policies)

The key twist: display the Service Catalog view *during the match*. The spectator UI has a "Behind the Scenes" tab showing each agent's service health, SLO burn rates, and dependency map in real-time. If Agent Blue's prediction SLO is burning through its error budget mid-match, spectators see it -- like watching a race car's engine telemetry.

**Why it's clever:** Service Catalog is typically used for microservice governance in enterprise platforms. Treating AI agents as "services" with full operational maturity (ownership, SLOs, runbooks, scorecards) shows a level of production thinking that screams "this team knows what they're doing." It's the most "Datadog" thing you can do.

**"Aha moment":** The judge clicks the "Agent Health" tab during a match and sees a Datadog Service Catalog view showing Agent Red's service page: SLO at 94.2%, 3 linked monitors (all green), dependency map showing Bedrock + Neo4j + MongoDB, a scorecard showing 4/5 production readiness, and a runbook link. The judge realizes: "They're treating these AI agents with the same operational rigor as production microservices." That's the Datadog award.

**Judge Impact:** 5/5 for Datadog prize specifically. 3/5 for general audience (less visually exciting).
**Feasibility:** 3/5 -- Service Catalog setup is mostly YAML config. SLOs need metric data flowing first. Scorecards need thought.

---

### Mechanic 5: "The Prediction Sonifier" -- Audio Layer for Imagination Trees

**Tool Repurposed:** Web Audio API + Datadog custom metrics (creative stretch)

**How it works:**
Map agent prediction data to sound, creating an audio layer that makes the match *listenable*:

- **Confidence -> Pitch:** High confidence predictions produce high-pitched tones. Low confidence = low, ominous tones.
- **Number of branches -> Chord complexity:** 1 prediction = single note. 3 predictions = triad chord. More branches = richer, more complex harmonics.
- **Correct prediction -> Resolution chord:** When a prediction is revealed as correct, a satisfying major chord resolves. Wrong predictions get a dissonant minor chord that fades.
- **Strategy shift -> Key change:** When an agent changes strategy mid-match, the musical key shifts (e.g., C major -> E minor), creating an audible signal of adaptation.
- **Score lead -> Stereo panning:** The winning agent's sounds pan to center, the losing agent's sounds fade to the edges. A close match has balanced stereo; a blowout sounds lopsided.

```typescript
// Simplified prediction sonification
const audioCtx = new AudioContext();

function sonifyPrediction(prediction: Prediction, agent: 'red' | 'blue') {
  const baseFreq = agent === 'red' ? 220 : 330; // Different base octaves
  const confidenceFreq = baseFreq + (prediction.confidence * 440); // Higher = more confident

  const osc = audioCtx.createOscillator();
  osc.type = prediction.confidence > 0.7 ? 'sine' : 'sawtooth'; // Clean vs gritty
  osc.frequency.setValueAtTime(confidenceFreq, audioCtx.currentTime);

  const gainNode = audioCtx.createGain();
  gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.5);

  // Stereo panning based on agent
  const panner = audioCtx.createStereoPanner();
  panner.pan.value = agent === 'red' ? -0.5 : 0.5;

  osc.connect(gainNode).connect(panner).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 1.5);
}

function sonifyCollapse(wasCorrect: boolean) {
  // Major chord for correct, minor for wrong
  const chordFreqs = wasCorrect
    ? [261.6, 329.6, 392.0]  // C major
    : [261.6, 311.1, 392.0]; // C minor

  chordFreqs.forEach(freq => {
    const osc = audioCtx.createOscillator();
    osc.frequency.value = freq;
    // ... fade and connect
  });
}
```

**Why it's clever:** No other hackathon team will have audio. Sonification of AI reasoning transforms the match from a visual experience into a multisensory one. You can close your eyes and *hear* when an agent is uncertain, when a correct prediction lands, when the tide turns. It also makes the project accessible to visually impaired audiences.

**"Aha moment":** The match is playing. The judge hears two distinct musical voices -- Red low and warm, Blue high and bright. Suddenly, Blue's tone drops and becomes dissonant -- the judge intuitively knows something went wrong before seeing the numbers. The Double Collapse hits and a satisfying chord resolves. The judge says: "Wait, I can *hear* the AI thinking?"

**Judge Impact:** 4/5 -- Extremely memorable and differentiated. Multisensory experiences stick.
**Feasibility:** 3/5 -- Web Audio API is well-supported. Sound design takes iteration to avoid being annoying. MVP: just the collapse chords and confidence pitch, skip the key changes.

---

## 2. Ranking (Judge Impact x Feasibility)

| Rank | Mechanic | Judge Impact | Feasibility | Score (IxF) | One-Day Build? |
|------|----------|-------------|-------------|-------------|----------------|
| 1 | **The Meta-Genome** (Neo4j GDS) | 5 | 4 | 20 | YES -- queries + config |
| 2 | **Auto-Highlight Reel** (MongoDB CS + DD Workflows) | 4 | 4 | 16 | YES -- event-driven glue |
| 3 | **Spectator's Oracle Tier 1: Crowd Wisdom** (CopilotKit polls) | 3 | 5 | 15 | YES -- React + WS |
| 4 | **Agents as Services** (DD Service Catalog) | 5* | 3 | 15 | YES -- YAML config |
| 5 | **Spectator's Oracle Tier 2: Ask the Oracle** (CopilotKit chat) | 4 | 4 | 16 | MAYBE -- needs CopilotKit stable |
| 6 | **The Prediction Sonifier** (Web Audio API) | 4 | 3 | 12 | STRETCH -- polish layer |
| 7 | **Spectator's Oracle Tier 3: Personal Oracle** (CoAgents) | 5 | 3 | 15 | NO -- too complex for day 1 |

*Agents as Services scores 5 specifically for the Datadog Observability prize, 3 for general audience.

**Recommended build order for a ONE-DAY hackathon:**
1. Agents as Services -- YAML config, do it first while infra is being set up. Directly targets Datadog prize.
2. The Meta-Genome -- run GDS queries once match data exists. Neo4j prize differentiator.
3. Spectator's Oracle Tier 1 (Crowd Wisdom) -- simple polls, minimal code, adds CopilotKit touchpoint.
4. Auto-Highlight Reel -- wire up after core match loop works. Shows multi-tool integration.
5. Spectator's Oracle Tier 2 (Ask the Oracle) -- upgrade polls to chat if CopilotKit is solid.
6. The Prediction Sonifier -- only if everything else is polished and working.

---

## 3. Wild Card Ideas (High-Risk, High-Reward)

### Wild Card A: "The Time Machine" -- Neo4j Bloom Live Exploration for Judges

**Concept:** During the demo, hand the judge an iPad/laptop with Neo4j Bloom open. Let them visually explore the strategy graph themselves -- zoom into clusters, follow paths, discover patterns. The judge becomes an analyst, not just a viewer.

**Why it might work:** Interactive demos are rare. Judges usually watch passively. Giving them a tool to explore data themselves creates a memorable experience and proves the graph has real depth.

**Why it's risky:** Neo4j Bloom requires AuraDB Professional or higher. Setup and perspective configuration takes time. If the graph is sparse (not enough matches), it looks empty. Network latency at a hackathon venue could make Bloom feel sluggish.

**Mitigation:** Pre-load 100+ matches of data. Create 3 curated "search phrases" (perspectives) that guarantee interesting results. Have a pre-recorded backup video.

### Wild Card B: "The Living Bracket" -- Datadog Workflow Automation as Game Master

**Concept:** Instead of manually running matches, Datadog Workflow Automation orchestrates an entire tournament bracket. Monitors watch match outcomes, workflows trigger the next match, and when one agent dominates (error budget burn on the SLO), the workflow auto-adjusts difficulty (swaps in a harder opponent personality, increases round count). The tournament runs itself.

**Why it might work:** Self-orchestrating systems are deeply impressive. The judge sees that Datadog isn't just monitoring the game -- it's *running* it. Workflow Automation as game master is a creative repurposing judges won't expect.

**Why it's risky:** Orchestrating matches through Datadog Workflows adds fragile indirection. If a workflow step fails mid-tournament, recovery is complex. The Workflow UI may not be fast enough for real-time game orchestration.

**Mitigation:** Build a simple version: workflow only triggers next match after current one ends. Skip the auto-difficulty-adjustment unless there's time. Have a manual fallback.

### Wild Card C: "The Confidence Choir" -- Audience Votes as Musical Harmony

**Concept:** Combine the Spectator's Oracle prediction polls with the sonification layer. Each spectator's vote adds a note to a growing chord. When 80% of spectators agree, the chord is harmonious (major). When the audience is split 50/50, the chord is dissonant (diminished). When the round resolves and the majority was right, a triumphant fanfare plays. When the majority was wrong, a comedic "wah wah" sound plays.

**Why it might work:** Turns the audience into a musical instrument. Social + audio = extremely viral/shareable moment. Creates an emotional arc for the room, not just the screen.

**Why it's risky:** Requires both the sonification system AND the audience polling system to work. Real-time audio mixing with variable inputs is tricky. Could sound terrible if not tuned well.

**Mitigation:** Pre-compose a few chord progressions and map them to discrete vote ranges. Use sampled instruments instead of synthesis for a more polished sound.

---

## 4. Integration Map

How these mechanics connect to each other and to the core project:

```
                     Match Engine (AgentCore)
                           |
                    [Round Results]
                    /      |       \
                   v       v        v
         Neo4j GDS    MongoDB CS    Datadog
         (Meta-      (Highlight     (Service
          Genome)     Detection)     Catalog)
            |              |            |
            v              v            v
        Strategy      Auto-Highlight  Agent SLOs
        Discovery     Reel (DD        + Scorecards
        Dashboard     Notebooks)
            \              |           /
             \             v          /
              +---> Spectator UI <---+
                    (CopilotKit)
                         |
                    +----+----+
                    |         |
                    v         v
              Spectator    Prediction
              Oracle       Sonifier
              (CoAgent)    (Audio)
```

Every mechanic feeds into the spectator experience. None exist in isolation.
