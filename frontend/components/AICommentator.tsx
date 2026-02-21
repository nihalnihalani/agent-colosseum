'use client';

import { useCopilotReadable, useCopilotAction, useCoAgentStateRender, useLangGraphInterrupt, useFrontendTool, useCopilotAdditionalInstructions, useCopilotChatSuggestions } from '@copilotkit/react-core';
import { CopilotPopup } from '@copilotkit/react-ui';
import type { MatchState } from '@/lib/types';
import { StrategyInsightCard, type CommentatorState } from './StrategyInsightCard';
import { dispatchHighlight, dispatchSfx, dispatchAnnounce, SFX_TONES } from '@/lib/arenaEffects';

interface AICommentatorProps {
  matchState: MatchState;
  commentatorState: CommentatorState;
}

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
  useFrontendTool({
    name: "showInsightCard",
    description: "Display a strategy insight to the spectator",
    parameters: [
      { name: "title", type: "string" as const, description: "Insight title" },
      { name: "content", type: "string" as const, description: "Insight content" },
      { name: "severity", type: "string" as const, description: "low, medium, or high" },
    ],
    handler: async ({ title, content }: { title: string; content: string }) => {
      return { status: "displayed", title, content };
    },
    render: ({ status, args, result }) => {
      if (status === "inProgress") return (
        <div className="p-2 rounded bg-white/5 border border-white/10 text-xs text-zinc-400 font-mono animate-pulse">
          Preparing insight: {args?.title ?? "..."}
        </div>
      );
      if (status === "complete") return (
        <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-xs font-mono space-y-1">
          <span className="text-amber-300">{result?.title}</span>
          <p className="text-zinc-400">{result?.content}</p>
        </div>
      );
      return null;
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
    render: ({ status, args, result }) => {
      if (status === "inProgress") return (
        <div className="p-2 rounded bg-white/5 border border-white/10 text-xs text-zinc-400 font-mono animate-pulse">
          Highlighting {args?.agent} prediction #{args?.index}...
        </div>
      );
      if (status === "complete") return (
        <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 font-mono">
          Highlighted {result?.agent} prediction #{result?.index}
        </div>
      );
      return null;
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
    render: ({ status, args, result }) => {
      if (status === "inProgress") return (
        <div className="p-2 rounded bg-white/5 border border-white/10 text-xs text-zinc-400 font-mono animate-pulse">
          Cueing sound: {args?.sound ?? "..."}
        </div>
      );
      if (status === "complete") return (
        <div className="p-2 rounded bg-violet-500/10 border border-violet-500/20 text-xs text-violet-300 font-mono">
          Played SFX: {result?.sound}
        </div>
      );
      return null;
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
      return { status: "announced", message };
    },
    render: ({ status, args, result }) => {
      if (status === "inProgress") return (
        <div className="p-2 rounded bg-white/5 border border-white/10 text-xs text-zinc-400 font-mono animate-pulse">
          Preparing announcement...
        </div>
      );
      if (status === "complete") return (
        <div className="p-2 rounded bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 font-mono">
          Announced: {result?.message}
        </div>
      );
      return null;
    },
  });

  return (
    <>
      {/* Strategy Insights Panel - stays inline */}
      <div className="flex flex-col gap-3 h-full">
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
      </div>

      {/* CopilotKit Chat - floating popup */}
      <CopilotPopup
        labels={{
          title: "Arena Commentator",
          initial: "I'm your Arena Commentator! Ask me anything about the match.",
          placeholder: "Ask about the match...",
        }}
        instructions="You are the Arena Commentator for Agent Colosseum. Provide engaging, insightful commentary on the AI agent match. Analyze strategies, predict outcomes, and highlight key moments."
        suggestions={[
          { title: "Who's winning?", message: "Who's currently winning and why?" },
          { title: "Analyze Red's strategy", message: "Break down Red agent's strategy so far" },
          { title: "Analyze Blue's strategy", message: "Break down Blue agent's strategy so far" },
          { title: "Prediction accuracy", message: "How accurate have the predictions been?" },
          { title: "Key moments", message: "What were the key turning points in this match?" },
          { title: "What should I watch for?", message: "What should I watch for in the next round?" },
        ]}
      />
    </>
  );
}
