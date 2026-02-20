'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { Brain, Target, Loader2 } from 'lucide-react';
import type { Prediction, AgentConfig, MatchPhase } from '@/lib/types';
import { PredictionCards } from './PredictionCards';
import { BorderBeam } from '@/components/ui/BorderBeam'; // New import
import { clsx } from 'clsx';

type ArenaHighlightDetail = { agent: "red" | "blue"; index: number };

interface AgentPanelProps {
  agent: 'red' | 'blue';
  personality: AgentConfig['personality'];
  predictions: Prediction[];
  phase: MatchPhase;
  accuracy: number;
}

const ImaginationTree = dynamic(
  () => import('./viz/ImaginationTree'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full text-neutral-500 gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-xs uppercase tracking-wider font-mono">Loading Viz...</span>
      </div>
    ),
  }
);

const phaseLabels: Record<MatchPhase, string> = {
  lobby: 'Waiting...',
  thinking: 'Thinking...',
  committed: 'Locked',
  revealed: 'Revealed',
  round_end: 'Round End',
  match_end: 'Finished',
};

function toVizPhase(phase: MatchPhase): 'waiting' | 'thinking' | 'committed' | 'revealed' {
  switch (phase) {
    case 'lobby': return 'waiting';
    case 'thinking': return 'thinking';
    case 'committed': return 'committed';
    case 'revealed':
    case 'round_end':
    case 'match_end': return 'revealed';
    default: return 'waiting';
  }
}

export function AgentPanel({
  agent,
  personality,
  predictions,
  phase,
  accuracy,
}: AgentPanelProps) {
  // Listen for arena:highlight events dispatched by the AI commentator agent
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const { agent: targetAgent, index } = (e as CustomEvent<ArenaHighlightDetail>).detail;
      if (targetAgent === agent) {
        setHighlightedIndex(index);
        setTimeout(() => setHighlightedIndex(null), 2500);
      }
    };
    window.addEventListener("arena:highlight", handler);
    return () => window.removeEventListener("arena:highlight", handler);
  }, [agent]);

  const isRed = agent === 'red';
  const isThinking = phase === 'thinking';
  
  // Use "21st.dev" style neutral colors with subtle semantic accents
  const accentColor = isRed ? 'text-red-500' : 'text-blue-500';
  const borderColor = isRed ? 'border-red-500/20' : 'border-blue-500/20';
  
  const use3DTree = process.env.NEXT_PUBLIC_USE_3D_TREE === 'true';

  return (
    <motion.div
      className="relative flex flex-col h-full overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/50 backdrop-blur-xl"
      initial={{ opacity: 0, x: isRed ? -20 : 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 25 }}
    >
      {/* Active State Border Beam */}
      {isThinking && (
        <BorderBeam 
          size={300} 
          duration={8} 
          colorFrom={isRed ? "#ef4444" : "#3b82f6"} 
          colorTo={isRed ? "#7f1d1d" : "#1e3a8a"} 
        />
      )}

      {/* Header */}
      <div className="p-5 border-b border-neutral-800 flex items-start gap-4 relative z-10">
        <div className={clsx(
          "w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold border",
          isRed ? "bg-red-500/10 border-red-500/20 text-red-500" : "bg-blue-500/10 border-blue-500/20 text-blue-500"
        )}>
          {isRed ? 'R' : 'B'}
        </div>

        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-sans font-semibold text-base text-neutral-200">
              Agent {isRed ? 'Red' : 'Blue'}
            </h3>
            <div className="flex items-center gap-1.5">
               <Target className="w-3 h-3 text-neutral-500" />
               <span className={clsx("font-mono font-bold text-sm", accuracy > 0.7 ? "text-emerald-400" : "text-neutral-400")}>
                 {Math.round(accuracy * 100)}%
               </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-neutral-700 bg-neutral-800 text-neutral-400 font-medium">
              {personality}
            </span>
            {isThinking && (
              <span className="text-[10px] text-neutral-500 font-mono uppercase tracking-wide flex items-center gap-1">
                <Brain className="w-3 h-3 animate-pulse" /> Generating...
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-5 overflow-y-auto relative min-h-[300px] z-10">
        {phase === 'thinking' && predictions.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-12 h-12 rounded-full border-2 border-neutral-800 border-t-neutral-500 animate-spin mb-4" />
            <p className="text-neutral-500 text-xs font-mono uppercase tracking-widest">
              Processing...
            </p>
          </div>
        )}

        {predictions.length > 0 && (
          <div className="h-full">
            {use3DTree ? (
              <div className="h-full min-h-[300px] rounded-xl overflow-hidden border border-neutral-800 bg-black/40 relative">
                <ImaginationTree
                  predictions={predictions}
                  phase={toVizPhase(phase)}
                  agentColor={isRed ? '#ef4444' : '#3b82f6'}
                  agentName={isRed ? 'Agent Red' : 'Agent Blue'}
                />
              </div>
            ) : (
              <PredictionCards
                predictions={predictions}
                agentColor={agent}
                phase={phase}
                highlightedIndex={highlightedIndex}
              />
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
