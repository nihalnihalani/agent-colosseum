'use client';

import { useCopilotReadable, useCopilotAction, useCoAgent, useCoAgentStateRender } from '@copilotkit/react-core';
import { CopilotChat } from '@copilotkit/react-ui';
import type { MatchState } from '@/lib/types';
import { StrategyInsightCard, type CommentatorState } from './StrategyInsightCard';

interface AICommentatorProps {
  matchState: MatchState;
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

export function AICommentator({ matchState }: AICommentatorProps) {
  // 1. Provide match state as readable context
  useCopilotReadable({
    description: "Current match state in Agent Colosseum arena",
    value: matchState,
  });

  // 2. Bidirectional state sync with commentator agent
  const { state: commentatorState } = useCoAgent<CommentatorState>({
    name: "arena-commentator",
    initialState: defaultState,
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
