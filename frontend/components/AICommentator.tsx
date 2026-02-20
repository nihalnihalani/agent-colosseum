'use client';

import { useCopilotReadable, useCopilotAction, useCoAgentStateRender, useLangGraphInterrupt, useFrontendTool } from '@copilotkit/react-core';
import { CopilotChat } from '@copilotkit/react-ui';
import type { MatchState } from '@/lib/types';
import { StrategyInsightCard, type CommentatorState } from './StrategyInsightCard';
import { dispatchHighlight, dispatchSfx, dispatchAnnounce, SFX_TONES } from '@/lib/arenaEffects';

interface AICommentatorProps {
  matchState: MatchState;
  commentatorState: CommentatorState;
}

const defaultState: CommentatorState = {
  strategyAnalysis: {
    red: { style: 'unknown', currentTactic: 'analyzing...', riskLevel: 0 },
    blue: { style: 'unknown', currentTactic: 'analyzing...', riskLevel: 0 },
  },
  momentum: { leader: 'none', confidence: 0, reason: 'Match starting...' },
  predictionTrends: { red: [], blue: [] },
  keyMoments: [],
  currentInsight: 'Initializing arena commentary...',
  matchProgress: { round: 0, totalRounds: 10, phase: 'lobby' },
};

export function AICommentator({ matchState, commentatorState }: AICommentatorProps) {
  // 1. Provide match state as readable context
  useCopilotReadable({
    description: "Current match state in Agent Colosseum arena",
    value: matchState,
  });

  // 3. Render agent state in chat as custom UI
  useCoAgentStateRender<CommentatorState>({
    name: "arena-commentator",
    render: ({ state }) => {
      if (!state || !state.currentInsight) return null;
      return <StrategyInsightCard state={state} />;
    },
  });

  // 4. Human-in-the-loop action: spectator can choose analysis focus
  useCopilotAction({
    name: "analyzeStrategy",
    description: "Let the spectator choose what to analyze",
    parameters: [
      { name: "options", type: "string[]" as const, description: "Analysis options to present" }
    ],
    renderAndWaitForResponse: ({ args, respond }) => (
      <div className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-3">
        <p className="text-xs text-zinc-400 font-mono uppercase tracking-wider">Choose analysis focus:</p>
        <div className="flex flex-wrap gap-2">
          {(args?.options || ["Red's strategy", "Blue's strategy", "Prediction accuracy", "Key moments"]).map((opt: string) => (
            <button
              key={opt}
              onClick={() => respond?.(opt)}
              className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 text-zinc-300 rounded-md border border-white/10 transition-colors"
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    ),
  });

  // 5. Frontend tool: show insight card overlay (agent can call this)
  useCopilotAction({
    name: "showInsightCard",
    description: "Display a strategy insight to the spectator",
    parameters: [
      { name: "title", type: "string" as const, description: "Insight title" },
      { name: "content", type: "string" as const, description: "Insight content" },
      { name: "severity", type: "string" as const, description: "low, medium, or high" },
    ],
    handler: async ({ title, content }) => {
      return `Insight: ${title} - ${content}`;
    },
  });

  // 6. Human-in-the-loop: audience tiebreaker decision
  useLangGraphInterrupt<string>({
    render: ({ event, resolve }) => (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="max-w-sm w-full mx-4 p-6 rounded-2xl border border-white/10 bg-[#0a0a0f] space-y-4 shadow-2xl">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400">Audience Decision</span>
          </div>
          <p className="text-sm text-zinc-300 leading-relaxed">{event.value}</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => resolve("chaos")}
              className="py-2.5 px-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm font-medium hover:bg-rose-500/20 transition-colors"
            >
              CHAOS MODE
            </button>
            <button
              onClick={() => resolve("precision")}
              className="py-2.5 px-4 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-sm font-medium hover:bg-indigo-500/20 transition-colors"
            >
              PRECISION MODE
            </button>
          </div>
        </div>
      </div>
    ),
  });

  // 7. Frontend tool: highlight a prediction card
  useFrontendTool({
    name: "highlight_prediction",
    description: "Highlight a specific prediction card in the agent visualization panel",
    parameters: [
      { name: "agent", type: "string" as const, description: "red or blue" },
      { name: "index", type: "number" as const, description: "Prediction index (0-based)" },
    ],
    handler: async ({ agent, index }: { agent: string; index: number }) => {
      dispatchHighlight({ agent: agent as "red" | "blue", index });
      return { status: "highlighted", agent, index };
    },
  });

  // 8. Frontend tool: play a sound effect
  useFrontendTool({
    name: "play_sfx",
    description: "Play a sound effect in the browser for dramatic moments",
    parameters: [
      { name: "sound", type: "string" as const, description: "fanfare, clash, suspense, or victory" },
    ],
    handler: async ({ sound }: { sound: string }) => {
      dispatchSfx({ sound: sound as "fanfare" | "clash" | "suspense" | "victory" });
      const sfxFn = SFX_TONES[sound as keyof typeof SFX_TONES];
      if (sfxFn) sfxFn();
      return { status: "played", sound };
    },
  });

  // 9. Frontend tool: full-screen announcement
  useFrontendTool({
    name: "announce_insight",
    description: "Display a prominent announcement in the arena",
    parameters: [
      { name: "message", type: "string" as const, description: "Short announcement text" },
    ],
    handler: async ({ message }: { message: string }) => {
      dispatchAnnounce({ message });
      return { status: "announced" };
    },
  });

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Strategy Insights Panel */}
      <div className="rounded-xl border border-white/5 bg-[#0a0a0f] overflow-hidden">
        <div className="p-2.5 bg-white/[0.02] border-b border-white/5 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">Strategy Analysis</span>
        </div>
        <div className="p-3">
          {commentatorState ? (
            <StrategyInsightCard state={commentatorState} />
          ) : (
            <p className="text-xs text-zinc-600 italic font-mono">Awaiting analysis...</p>
          )}
        </div>
      </div>

      {/* CopilotKit Chat - inline */}
      <div className="rounded-xl border border-white/5 bg-[#0a0a0f] overflow-hidden flex-1 min-h-[200px]">
        <CopilotChat
          labels={{
            title: "Arena Commentator",
            initial: "Ask about the match! Try: 'Analyze Red\\'s strategy' or 'Who\\'s winning?'",
            placeholder: "Ask about the match...",
          }}
          className="h-full [&_.copilotKitChat]:bg-transparent [&_.copilotKitHeader]:bg-white/[0.02] [&_.copilotKitHeader]:border-b [&_.copilotKitHeader]:border-white/5"
        />
      </div>
    </div>
  );
}
