# Agent Colosseum -- UX Strategy

> Designing an experience that makes invisible AI reasoning visible, spectatable, and shareable.

---

## 1. User Journeys

### Persona 1: First-Time Spectator

**Context:** Arrives at the page from a shared link or hackathon demo screen. Has zero context. Needs to understand what they're watching in under 10 seconds.

**Journey:**

```
SECOND 0-2: Landing
  - Full-screen dark arena. Two glowing avatars (Red, Blue) face each other.
  - Large center text: "AGENT RED vs AGENT BLUE"
  - Subtitle fades in: "Two AIs predicting each other's next move"
  - No navigation, no sidebar, no cognitive load. Just the arena.

SECOND 2-5: First Imagination Phase
  - Branches begin growing from both avatars simultaneously.
  - Pulsing "THINKING..." labels on each side.
  - A floating tooltip near the first branch: "Each branch is a prediction
    of what the opponent will do next"
  - Branch thickness visually communicates confidence (thick = likely).

SECOND 5-8: The Double Collapse
  - Both trees collapse. Wrong predictions shatter with a particle burst.
  - Correct predictions flash gold with a crystallization sound.
  - Center scoreboard pulses: "RED predicted correctly! Accuracy: 100%"
  - This is the hook. The spectator now understands the game in one cycle.

SECOND 8-10: Engagement Lock
  - Bottom bar slides up: "Who wins Round 2? Vote now."
  - The spectator taps Red or Blue. They are now a participant.
  - AI Commentator text appears in the corner: "Red opened aggressive --
    classic. But Blue has data from 47 past matches..."
```

**Wireframe Description:**
- **Layout:** Full-bleed dark canvas with centered arena. No chrome.
- **Top:** Minimal header -- match title + round counter only.
- **Center:** 65% of screen is the 3D imagination tree visualization (two trees, mirrored).
- **Bottom:** Thin engagement bar with vote buttons + spectator count.
- **Right edge:** Collapsible AI commentator panel (glassmorphism overlay).
- **Mobile:** Same layout scaled. Trees render in 2D for performance. Vote buttons are full-width.

**Key Design Principle:** The first-time spectator should never need to read instructions. The visual grammar (branches = predictions, gold = correct, red dissolve = wrong) teaches itself through one cycle.

---

### Persona 2: Hackathon Judge

**Context:** Has 3 minutes. Needs to see technical depth, innovation, and polish. Will interact with the demo. Wants to be impressed.

**Journey:**

```
MINUTE 0:00-0:30 -- "The Hook"
  - Demo opens mid-match. Round 3 is in progress.
  - Judge sees branches growing in real-time (streamed from Bedrock).
  - The Double Collapse happens. Audible "ooh" from the crowd.
  - Narrator: "Each branch is a future the AI imagined using Amazon Bedrock."

MINUTE 0:30-1:00 -- "The Intelligence Layer"
  - Click an individual prediction branch on Red's tree.
  - Side panel expands showing: prediction text, confidence score,
    counter-strategy, reasoning chain.
  - Judge can SEE the AI's thought process. This is the technical depth moment.
  - Neo4j graph snippet appears: "Red queried 47 past matches to find
    this counter-strategy."

MINUTE 1:00-1:30 -- "The Observability Story"
  - Slide the bottom panel up to reveal the embedded Datadog dashboard.
  - Live metrics: prediction accuracy trending, token cost per round,
    strategy evolution heatmap.
  - Judge interaction: click "Toggle Agent Personalities" to switch
    Red from "aggressive" to "defensive." Watch behavior change live.

MINUTE 1:30-2:15 -- "The Learning Loop"
  - Fast-forward through rounds 4-8 at 2x speed.
  - Visual: strategy evolution -- Red's branches shift patterns over rounds.
  - Highlight: "Blue just predicted Red's bluff for the first time."
  - Show the Neo4j strategy graph in the sidebar: nodes and edges
    representing move relationships.

MINUTE 2:15-3:00 -- "The Climax & Close"
  - Final rounds play out live. Score is close.
  - The audience vote results appear: "67% predicted Blue would win."
  - Match ends. Winner celebration animation (confetti particles, glow pulse).
  - CopilotKit commentator summarizes the match in natural language.
  - Final card: tech stack logos arranged around the arena logo.
```

**Wireframe Description:**
- **Layout:** Same arena view but with "judge mode" activated by a subtle key combo or URL param.
- **Left panel (35%):** Match controls, agent personality selector, commentary feed.
- **Center (65%):** 3D arena visualization.
- **Bottom drawer:** Pull-up Datadog dashboard embed (iframe or screenshot with live data overlay).
- **Interaction points:** Clickable branches, personality toggle, speed control, Datadog drawer.

**Key Design Principle:** The judge demo is choreographed theater. Every click reveals a new layer of technical depth. Nothing is accidental.

---

### Persona 3: Returning User

**Context:** Has watched matches before. Wants depth, variety, and a reason to come back.

**Journey:**

```
RETURN VISIT 1: "The Strategist"
  - Match history page shows past matches with win/loss records.
  - User picks a specific matchup: "Aggressive Red vs Adaptive Blue"
  - Watches the full match with commentary enabled.
  - Post-match: strategy breakdown page with Neo4j graph visualization
    showing how strategies evolved.

RETURN VISIT 2: "The Competitor"
  - User configures their own agent personality (sliders for
    aggression, risk tolerance, bluff frequency).
  - Submits it to fight against preset agents.
  - Watches "their" agent compete. Personal investment = stickiness.

RETURN VISIT 3: "The Analyst"
  - Cross-match analytics page.
  - Which strategy beats which? (heatmap from Neo4j data)
  - Which agent personality has the highest win rate?
  - Leaderboard of prediction accuracy across all matches.
  - Shareable stat cards: "My custom agent won 7/10 matches with
    78% prediction accuracy"
```

**Key Design Principle:** Returning users need progression systems. They should feel like they are getting smarter about the meta-game, not just watching replays.

---

## 2. Core Interaction Loop

The sticky loop that creates engagement:

```
    ANTICIPATION              REVEAL               CONSEQUENCE
  "What will happen?"     "Was I right?"        "What changed?"
         |                     |                      |
         v                     v                      v
  +-------------+     +-----------------+     +----------------+
  | Branches    |     | Double Collapse |     | Score Update   |
  | grow out.   | --> | Gold flash or   | --> | Strategy shift |
  | Spectator   |     | red dissolve.   |     | visible.       |
  | votes.      |     | Spectator vote  |     | Next round     |
  |             |     | result shown.   |     | begins.        |
  +-------------+     +-----------------+     +----------------+
         ^                                           |
         |                                           |
         +-------------------------------------------+
                     6-second loop
```

**Why this works (game design principles):**

1. **Variable Reward Schedule:** The spectator does not know if predictions will be correct. This creates dopamine-driven engagement (same mechanism as slot machines, but ethical).

2. **Personal Investment via Voting:** When spectators vote on outcomes, they become emotionally invested. Being right feels good. Being wrong makes them watch the next round to "redeem."

3. **Legibility of Change:** After each round, the score visibly changes, strategies visibly shift, and the AI commentator explains why. The spectator is always learning.

4. **Compression:** 6 seconds per round means 10 rounds in 60 seconds. Fast enough to hold attention. Slow enough to process.

---

## 3. Demo Story Arc

The narrative structure for the 3-minute hackathon demo:

```
ACT 1: SETUP (0:00-0:45)
  "This is an arena where AI agents predict each other."
  - Visual: first round plays. Branches grow. Collapse happens.
  - Emotional beat: wonder. "Whoa, what am I looking at?"
  - Technical beat: "Each branch is a Bedrock Claude call predicting
    the opponent's move."

ACT 2: RISING ACTION (0:45-1:45)
  "But they don't just predict -- they LEARN."
  - Visual: rounds 2-5 at 2x speed. Strategy shifts visible.
  - Show Datadog dashboard: "We can see the learning happening in
    real-time metrics."
  - Show Neo4j graph: "Every strategy relationship is stored and
    queried."
  - Emotional beat: respect. "This is technically sophisticated."

ACT 3: CLIMAX (1:45-2:30)
  "Watch what happens when the student becomes the master."
  - Visual: round 7-8. Blue agent, previously losing, starts
    predicting correctly.
  - The moment: Blue predicts Red's bluff for the first time.
  - Camera (metaphorical) zooms into the correct prediction branch
    glowing gold.
  - Audience vote shows: "82% predicted Red. Blue surprised everyone."
  - Emotional beat: excitement. Narrative reversal.

ACT 4: RESOLUTION (2:30-3:00)
  "Agent Colosseum. Where AI agents learn to out-think each other."
  - Match ends. Winner celebration.
  - AI commentator delivers a 10-second summary.
  - Tech stack card fades in.
  - Emotional beat: satisfaction. Clean close.
```

**Critical rule:** The demo must tell a STORY, not demonstrate FEATURES. Features are revealed through the story, never listed.

---

## 4. Wow Moment Catalog

### Moment 1: "The Double Collapse"
**What:** Both agents' prediction trees collapse simultaneously when moves are revealed. Wrong predictions shatter with particle effects. Correct predictions crystallize with a gold flash and a chime sound.
**Why it works:** It is the single most visually distinctive thing about this project. Nobody has seen this before. It compresses complex AI behavior into one dramatic beat.
**Technical:** GSAP timeline for synchronized animation. Canvas API for particle effects. Howler.js for the crystallization chime. ~1.5 seconds.

### Moment 2: "Branch Click Deep-Dive"
**What:** Spectator clicks on a prediction branch. It expands into a panel showing the AI's reasoning: what it predicted, why, what counter-strategy it chose, and the Neo4j query that informed it.
**Why it works:** It reveals the technical depth without forcing it. Judges who click see the intelligence layer. Casual spectators skip it. Both are served.
**Technical:** Framer Motion for panel expansion. CopilotKit for rendering the AI reasoning text. Neo4j Cypher query result displayed as a mini-graph.

### Moment 3: "The Prediction Accuracy Counter"
**What:** A persistent counter in the corner shows each agent's running prediction accuracy. When a correct prediction happens, the counter animates upward with a satisfying tick. Over 10 rounds, watching one agent pull ahead in accuracy is as compelling as the score itself.
**Why it works:** It gamifies the meta-level. Spectators root for the "smarter" agent, not just the winning one. Creates a second narrative axis.
**Technical:** GSAP number counter animation. Color shift (red to gold as accuracy approaches 100%).

### Moment 4: "The Strategy Shift"
**What:** After a losing round, the agent's branches change pattern in the next round. If Red was making aggressive predictions and lost, the branches visibly thin (lower confidence) or change angle (different prediction types). The AI commentator calls it out: "Red is switching to a defensive stance."
**Why it works:** It makes learning visible. The audience sees adaptation happen in real-time, not as a metric on a dashboard, but as a visual change in the branches.
**Technical:** Branch angle and thickness mapped to strategy parameters. Smooth transitions with Framer Motion spring physics.

### Moment 5: "The Audience Got It Wrong"
**What:** When the spectator audience votes on who will win a round and the underdog wins, a special animation plays: the vote bar flips dramatically, and text appears "82% predicted Red. Blue surprised everyone."
**Why it works:** Collective prediction failure is entertaining. It creates social moments -- spectators look at each other, laugh, and immediately want to vote again.
**Technical:** Vote bar with flip animation (GSAP). WebSocket aggregation of votes server-side.

### Moment 6: "The Match Recap Card"
**What:** After a match ends, a shareable card auto-generates: a stylized summary with the final score, key moments, prediction accuracy, and a visual representation of the strategy graph. One-tap share to social.
**Why it works:** This is the viral mechanic. Every match produces a shareable artifact. When spectators post these cards, they drive new visitors to the arena.
**Technical:** html2canvas to capture the recap card as an image. Pre-designed template with dynamic data injection. Web Share API for native sharing on mobile.

### Moment 7: "The AI Commentator's Hot Take"
**What:** CopilotKit-powered AI commentator delivers a natural language play-by-play in the sidebar. After each round, a short sentence appears. After the match, a full summary. The tone is like a sports commentator -- dramatic, opinionated, occasionally surprised.
**Why it works:** It bridges the gap between visual spectacle and understanding. Spectators who don't fully understand the strategy still get the narrative from the commentator. Also makes the CopilotKit integration highly visible to judges.
**Technical:** CopilotKit chat component with custom system prompt. useCopilotReadable provides match state. Auto-generate commentary after each round_end WebSocket event.

---

## 5. Recommended Tools

### Tier 1: Must-Have (Core Experience)

| Tool | Role | Rationale |
|------|------|-----------|
| **3d-force-graph + Three.js** | Imagination tree visualization | Already validated by the reasoning-graph reference project. Active maintenance (v1.79.1, updated Feb 2026). Handles the core visual -- branching prediction trees with custom glowing nodes. The 3D depth makes it feel cinematic vs flat 2D SVG trees. |
| **Framer Motion** | UI animations and transitions | Already in the PROJECT.md plan. Handles enter/exit animations for branches, panel slides, score counters. Spring physics create organic, game-like motion. |
| **GSAP** | Timeline-choreographed animations | The Double Collapse needs frame-precise timing across multiple elements. GSAP timelines sequence the collapse, particle burst, gold flash, and score update in exact order. Framer Motion handles component-level animation; GSAP handles scene-level choreography. |
| **Howler.js** | Sound effects | 7KB gzipped. Handles the crystallization chime on correct predictions, the shatter sound on wrong predictions, a subtle ambient drone during thinking phases, and the celebration sound on match end. Sound sprite pattern (single audio file, multiple cues) keeps load times minimal. Sound is 50% of the "wow" factor and is often forgotten. |
| **CopilotKit** | AI commentator + spectator chat | Already planned. The commentator is the narrative glue. Without it, spectators see visuals but don't understand the story. |

### Tier 2: High-Value Additions

| Tool | Role | Rationale |
|------|------|-----------|
| **html2canvas** | Shareable match recap cards | Generates static images of the recap card for social sharing. Critical for virality. Low effort, high return. |
| **Lottie** | Micro-animations (loading states, icons, celebrations) | Vector-based, tiny file sizes. Perfect for the "thinking" pulse animation on agent avatars, the confetti celebration on match end, and loading spinners while Bedrock streams. Pre-made animations from LottieFiles library save design time. |
| **Canvas API** | Particle effects for branch dissolution | The shatter effect when wrong predictions dissolve. Canvas is more performant than SVG or DOM-based particles for this kind of effect (hundreds of particles, short lifetime). |
| **Web Share API** | Native mobile sharing | One-tap share on mobile. Falls back to copy-link on desktop. Zero library weight. |

### Tier 3: Nice-to-Have (If Time Permits)

| Tool | Role | Rationale |
|------|------|-----------|
| **Tone.js** | Data sonification | Map prediction confidence to musical pitch. Higher confidence = higher tone. Creates an audio landscape that changes as the match evolves. Very impressive for demos but complex to tune. Only pursue if sound design is ahead of schedule. |
| **Remotion** | Auto-generated match highlight reels | Programmatically generate MP4 highlight reels from match data. "Here's a 15-second clip of the best moment." Great for social sharing. However, Remotion adds build complexity and rendering time. Defer to post-MVP. |
| **Rive** | State-machine-driven agent avatars | Agent avatars that react to match state (thinking, winning, losing, surprised). Rive's state machines handle transitions natively. Beautiful but requires dedicated design work. Lottie is a simpler alternative for MVP. |
| **Recharts** | Post-match statistics page | Simple, well-maintained charting library for the analytics page (prediction accuracy over time, strategy distribution). Only needed for returning user persona. |

### Tools NOT Recommended

| Tool | Why Not |
|------|---------|
| **Mapbox GL JS** | Geographic metaphors don't map naturally to the game concept. Would feel forced. |
| **React Three Fiber** | Adds a React wrapper around Three.js but 3d-force-graph already integrates with Three.js directly. Adding R3F would create two competing abstractions. |
| **Victory / Visx** | Overkill for the charting needs. Recharts is simpler and sufficient. |
| **Observable Plot** | Great for exploration, not for production game UI. |

---

## 6. Mobile / Responsive Strategy

### Philosophy

Mobile spectators are the majority audience at a hackathon (people standing around watching on their phones). The experience must work on mobile **natively**, not as a degraded desktop view.

### Layout Breakpoints

```
DESKTOP (>1024px):
  - Split layout: 35% controls/commentary | 65% 3D arena
  - Full 3D imagination tree with camera orbit controls
  - Sidebar AI commentator always visible
  - Datadog dashboard embed in bottom drawer

TABLET (768-1024px):
  - Stacked layout: 100% arena on top, scrollable panels below
  - 3D imagination tree with reduced node count
  - AI commentator as a collapsible bottom sheet
  - Vote buttons as floating action buttons

MOBILE (<768px):
  - Full-screen arena (100vh)
  - 2D imagination tree (SVG, not 3D) for performance
  - Swipe-up for commentary and stats
  - Fixed bottom bar: vote buttons + score
  - Tap a branch to see prediction details (bottom sheet)
```

### Mobile-Specific Interactions

1. **Tap to Vote:** Large, thumb-friendly buttons at the bottom. Red left side, Blue right side. Matches how people hold phones.

2. **Swipe Up for Depth:** Swipe up from the bottom bar to reveal commentary, stats, and match history. The arena stays visible at 40% height above.

3. **Haptic Feedback:** Use the Vibration API on mobile browsers for the Double Collapse moment. A short vibration pulse (50ms) when predictions are revealed adds a physical dimension.

4. **Portrait Optimization:** The imagination trees render vertically on mobile -- agent avatars at the top, branches fanning downward. This matches the natural scroll direction and portrait orientation.

5. **Reduced Animation:** On mobile, skip the particle effects (Canvas performance varies). Use opacity fades instead of particle dissolution. The gold flash still works in 2D.

### Performance Targets

| Metric | Desktop | Mobile |
|--------|---------|--------|
| First Meaningful Paint | <1.5s | <2.5s |
| Imagination tree render | <100ms | <200ms |
| Double Collapse animation | 60fps | 30fps acceptable |
| Memory usage | <200MB | <100MB |
| Bundle size (gzipped) | <500KB | <300KB (code-split 3D) |

### Code-Splitting Strategy

```
Route: /arena (main match view)
  - Core: React + Framer Motion + GSAP + Howler.js (~120KB)
  - Lazy: 3d-force-graph + Three.js (~400KB, desktop only)
  - Lazy: Canvas particle system (~15KB, desktop only)
  - Mobile gets: 2D SVG tree + CSS transitions (~30KB)

Route: /replay (match replay)
  - Lazy: full visualization + Recharts (~200KB)

Route: /stats (analytics)
  - Lazy: Recharts + Neo4j graph viz (~150KB)
```

---

## 7. Sound Design Blueprint

Sound is the most overlooked dimension in hackathon demos. A well-designed sound palette elevates the experience from "cool visualization" to "immersive arena."

### Sound Palette

| Event | Sound | Duration | Tool |
|-------|-------|----------|------|
| Round start | Low timpani hit + rising synth pad | 0.5s | Howler.js |
| Thinking phase (ambient) | Soft pulsing drone, stereo panned (Red left, Blue right) | loops during thinking | Howler.js |
| Branch grows | Subtle click/pop, pitch rises with each successive branch | 0.1s each | Howler.js sprite |
| Double Collapse: correct | Glass crystallization chime (high, bright) | 0.3s | Howler.js |
| Double Collapse: wrong | Soft shatter/dissolve (low, muted) | 0.5s | Howler.js |
| Score update | Mechanical counter tick | 0.2s | Howler.js |
| Audience vote result | Crowd murmur + reaction | 0.8s | Howler.js |
| Match end: winner | Triumphant brass hit + crowd cheer | 1.5s | Howler.js |
| Match end: close game | Dramatic orchestral swell | 2.0s | Howler.js |

### Audio Rules

1. All sound is **off by default** until the spectator clicks/taps once (browser autoplay policy).
2. A subtle speaker icon in the top-right lets users toggle sound.
3. Volume is always low. Sound accents the visuals; it never dominates.
4. The thinking drone creates a "tension building" feeling that makes the Collapse more satisfying.
5. All sounds are loaded as a single audio sprite (~200KB total) for instant playback.

---

## 8. Accessibility Considerations

1. **Color independence:** Never rely solely on color to convey information. Branches have both color AND thickness/pattern changes. Correct predictions get a checkmark icon in addition to gold color.

2. **Screen reader support:** The AI Commentator text serves as a natural screen-reader-friendly description of what is happening. Add aria-live="polite" to the commentator panel.

3. **Reduced motion:** Respect prefers-reduced-motion media query. When active, replace animations with instant state transitions. The experience still works without animation -- it just becomes a turn-based display.

4. **Keyboard navigation:** Tab through branches to inspect predictions. Enter to expand details. Escape to close panels. Arrow keys to navigate match history.

---

## 9. Implementation Priority Order

**CONSTRAINT: This is a ONE-DAY hackathon (Feb 20, 2026).** All UX work must
compress into a single build day. The priority list below reflects a ruthless
scope cut. If it is not in the "Ship" tier, it does not exist.

### One-Day Build Plan (UX/Frontend)

```
SHIP (Hours 1-6 -- Non-negotiable for demo):
  [ ] Arena layout: full-screen dark canvas, two agent panels, center viz
  [ ] 3d-force-graph imagination tree with hardcoded fallback data
  [ ] The Double Collapse animation (GSAP timeline, ~1.5s)
  [ ] Score counter with GSAP number animation
  [ ] WebSocket round loop (branches grow -> collapse -> score update)
  [ ] CopilotKit AI Commentator (basic: round-end text summary)

IF-TIME (Hours 6-8 -- High impact, low effort):
  [ ] Sound effects via Howler.js (single audio sprite, 3 sounds:
      crystallization chime, shatter, round-start hit)
  [ ] Audience vote buttons (Red/Blue) with live result bar
  [ ] Branch click -> side panel showing prediction detail

CUT (Do not attempt on day-of):
  [ ] Particle effects for branch dissolution (use opacity fade instead)
  [ ] Lottie micro-animations (CSS pulse animation is sufficient)
  [ ] Mobile responsive layout (demo is on a large screen)
  [ ] Shareable recap cards / html2canvas
  [ ] Tone.js data sonification
  [ ] Remotion highlight reels
  [ ] Agent personality configurator
  [ ] Match history / replay / analytics pages
```

### One-Day UX Simplifications

1. **No mobile layout.** The demo is on a projector/large monitor at the
   hackathon venue. Mobile spectators are a post-hackathon concern.

2. **Hardcoded fallback data.** If the Bedrock streaming pipeline is not
   ready, the visualization must work with pre-recorded match data. Design
   the frontend to accept both live WebSocket data and static JSON.

3. **2D fallback ready.** If 3d-force-graph has integration issues, have a
   2D SVG tree (Framer Motion + D3 layout) ready as a drop-in replacement.
   The Double Collapse animation works in both 2D and 3D.

4. **Sound is a 30-minute task.** Pre-select 3 sound effects from freesound.org
   or similar. Compile into one audio sprite. Howler.js setup is ~20 lines of
   code. Do this in the last 2 hours only if core viz is stable.

5. **CopilotKit commentator is high-value, low-effort.** The basic setup is
   a CopilotChat component + useCopilotReadable with match state. Even a
   simple "Red predicted correctly with 72% confidence" after each round
   adds narrative depth for judges. Budget 1 hour.

### Pre-Hackathon Preparation (Before Feb 20)

These items can and should be done BEFORE the hackathon day:

```
PRE-WORK (Do this week):
  [x] Set up Next.js project with Tailwind + Framer Motion
  [x] Install and test 3d-force-graph with a static demo graph
  [x] Build the Double Collapse GSAP timeline with dummy data
  [x] Select and prepare the audio sprite (3 sounds)
  [x] Create the arena layout component (dark theme, split panels)
  [x] Wire up a mock WebSocket that replays recorded match data
  [x] Test CopilotKit chat component with static match state
```

This way, hackathon day is about INTEGRATION (connecting the real backend
to the pre-built frontend), not building from scratch.

---

## 10. The One-Sentence Test

Every design decision should pass this test:

> **"If someone walks up to the screen mid-match, can they understand what is happening within one round (~6 seconds)?"**

If the answer is no, the design is too complex. Simplify until the visual grammar is self-teaching.

---

*Prepared by the UX Strategy team for Agent Colosseum.*
*Design philosophy: Think like a game designer, not a software engineer. This is entertainment.*
