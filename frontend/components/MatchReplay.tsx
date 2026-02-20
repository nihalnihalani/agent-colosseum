'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward, FastForward, RotateCcw } from 'lucide-react';
import { MatchViewer } from './MatchViewer';
import type {
  MatchState,
  MatchPhase,
  Prediction,
  GameState,
  GameType,
  NegotiationGameState,
  AuctionGameState,
  ReplayEvent,
  WSEvent,
} from '@/lib/types';
import { clsx } from 'clsx';

interface MatchReplayProps {
  matchId: string;
  events: ReplayEvent[];
}

const initialReplayState: MatchState = {
  matchId: '',
  gameType: 'resource_wars',
  agents: {
    red: { personality: 'aggressive' },
    blue: { personality: 'defensive' },
  },
  totalRounds: 10,
  currentRound: 0,
  gameState: {
    resources: { A: 100, B: 100, C: 100 },
    scores: { red: 0, blue: 0 },
  },
  phase: 'lobby',
  redPredictions: [],
  bluePredictions: [],
  accuracy: { red: 0, blue: 0 },
  totalFuturesSimulated: 0,
};

function applyEvent(state: MatchState, event: ReplayEvent): MatchState {
  const e = event as any; // Using any to bypass strict type checks for replay logic
  switch (e.type) {
    case 'match_start':
      return {
        ...state,
        matchId: e.matchId as string,
        gameType: (e.gameType as GameType) || 'resource_wars',
        agents: (e.agents as MatchState['agents']) || state.agents,
        totalRounds: (e.totalRounds as number) || state.totalRounds,
        phase: 'lobby',
        currentRound: 0,
      };

    case 'round_start': {
      const next = {
        ...state,
        currentRound: e.round as number,
        gameState: (e.gameState as GameState) || state.gameState,
        phase: 'thinking' as MatchPhase,
        redPredictions: [],
        bluePredictions: [],
        redMove: undefined,
        blueMove: undefined,
      };
      if (e.negotiationState) next.negotiationState = e.negotiationState as NegotiationGameState;
      if (e.auctionState) next.auctionState = e.auctionState as AuctionGameState;
      return next;
    }

    case 'thinking_start':
      return { ...state, phase: 'thinking' };

    case 'prediction': {
      const agent = e.agent as 'red' | 'blue';
      const prediction = e.prediction as Prediction;
      const key = agent === 'red' ? 'redPredictions' : 'bluePredictions';
      return {
        ...state,
        [key]: [...state[key], prediction],
        totalFuturesSimulated: state.totalFuturesSimulated + 1,
      };
    }

    case 'thinking_end': {
      const a = e.agent as 'red' | 'blue';
      const pKey = a === 'red' ? 'redPredictions' : 'bluePredictions';
      const mKey = a === 'red' ? 'redMove' : 'blueMove';
      return {
        ...state,
        [pKey]: (e.predictions as Prediction[]) || state[pKey],
        [mKey]: e.chosenMove,
        phase: 'committed',
      };
    }

    case 'collapse':
      return {
        ...state,
        redPredictions: (e.redPredictions as Prediction[]) || state.redPredictions,
        bluePredictions: (e.bluePredictions as Prediction[]) || state.bluePredictions,
        phase: 'revealed',
      };

    case 'round_end': {
      const rState = {
        ...state,
        gameState: {
          ...state.gameState,
          scores: (e.scores as GameState['scores']) || state.gameState.scores,
        },
        accuracy: (e.accuracy as MatchState['accuracy']) || state.accuracy,
        phase: 'round_end' as MatchPhase,
      };
      if (e.negotiationState) rState.negotiationState = e.negotiationState as NegotiationGameState;
      if (e.auctionState) rState.auctionState = e.auctionState as AuctionGameState;
      return rState;
    }

    case 'match_end':
      return {
        ...state,
        winner: e.winner as string,
        gameState: {
          ...state.gameState,
          scores: (e.finalScores as GameState['scores']) || state.gameState.scores,
        },
        accuracy: (e.predictionAccuracy as MatchState['accuracy']) || state.accuracy,
        totalFuturesSimulated: (e.totalFuturesSimulated as number) || state.totalFuturesSimulated,
        phase: 'match_end',
      };

    default:
      return state;
  }
}

export function MatchReplay({ matchId, events }: MatchReplayProps) {
  const [eventIndex, setEventIndex] = useState(0);
  const [matchState, setMatchState] = useState<MatchState>(initialReplayState);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let s = { ...initialReplayState, matchId };
    for (let i = 0; i <= eventIndex && i < events.length; i++) {
      s = applyEvent(s, events[i]);
    }
    setMatchState(s);
  }, [eventIndex, matchId, events]);

  const advance = useCallback(() => {
    setEventIndex((prev) => {
      if (prev >= events.length - 1) {
        setIsPlaying(false);
        if (timerRef.current) clearInterval(timerRef.current);
        return prev;
      }
      return prev + 1;
    });
  }, [events.length]);

  useEffect(() => {
    if (isPlaying) {
      const interval = 1000 / speed;
      timerRef.current = setInterval(advance, interval);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, speed, advance]);

  const handleSkipBack = () => {
    setEventIndex((prev) => Math.max(0, prev - 5));
  };

  const handleSkipForward = () => {
    setEventIndex((prev) => Math.min(events.length - 1, prev + 5));
  };

  const progress = events.length > 0 ? ((eventIndex + 1) / events.length) * 100 : 0;

  return (
    <div className="flex flex-col h-screen bg-[#050505]">
      {/* Replay viewer */}
      <div className="flex-1 overflow-hidden relative">
        <MatchViewer matchState={matchState} />
        
        {/* Replay Indicator Overlay */}
        <div className="absolute top-4 right-4 z-50 px-3 py-1 bg-red-500/20 border border-red-500/40 rounded-full flex items-center gap-2 backdrop-blur-md">
           <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
           <span className="text-[10px] font-bold uppercase tracking-widest text-red-300">Replay Mode</span>
        </div>
      </div>

      {/* Playback controls */}
      <motion.div
        className="border-t border-white/5 bg-[#0a0a0f]/90 backdrop-blur-xl px-6 py-4 z-50"
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <div className="max-w-5xl mx-auto flex flex-col gap-4">
          
          {/* Progress Bar */}
          <div className="relative w-full h-1.5 bg-white/10 rounded-full cursor-pointer group"
               onClick={(e) => {
                 const rect = e.currentTarget.getBoundingClientRect();
                 const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                 setEventIndex(Math.floor(pct * (events.length - 1)));
               }}
          >
             <div className="absolute inset-y-0 left-0 bg-purple-500 rounded-full transition-all duration-100 group-hover:bg-purple-400" 
                  style={{ width: `${progress}%` }} 
             />
             <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ left: `${progress}%` }}
             />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
               {/* Controls */}
               <div className="flex items-center gap-2">
                 <button
                   onClick={() => setEventIndex(0)}
                   className="p-2 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors"
                   title="Reset"
                 >
                   <RotateCcw className="w-4 h-4" />
                 </button>
                 
                 <button
                   onClick={handleSkipBack}
                   className="p-2 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors"
                   title="Back 5 steps"
                 >
                   <SkipBack className="w-4 h-4" />
                 </button>

                 <button
                   onClick={() => setIsPlaying(!isPlaying)}
                   className="w-10 h-10 rounded-full bg-purple-600 hover:bg-purple-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/20 transition-all hover:scale-105 active:scale-95"
                 >
                   {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                 </button>

                 <button
                   onClick={handleSkipForward}
                   className="p-2 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors"
                   title="Forward 5 steps"
                 >
                   <SkipForward className="w-4 h-4" />
                 </button>
               </div>

               {/* Divider */}
               <div className="w-px h-8 bg-white/10 mx-2" />

               {/* Speed */}
               <div className="flex items-center bg-white/5 rounded-lg p-1">
                 {[1, 2, 4, 8].map((s) => (
                   <button
                     key={s}
                     onClick={() => setSpeed(s)}
                     className={clsx(
                       "px-3 py-1 rounded-md text-xs font-bold transition-colors",
                       speed === s
                         ? "bg-purple-500/20 text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.1)]"
                         : "text-zinc-500 hover:text-zinc-300"
                     )}
                   >
                     {s}x
                   </button>
                 ))}
               </div>
            </div>

            {/* Status */}
            <div className="flex items-center gap-4 text-xs font-mono text-zinc-500">
               <span className="flex items-center gap-2">
                 <span className={clsx("w-2 h-2 rounded-full", isPlaying ? "bg-green-500 animate-pulse" : "bg-zinc-700")} />
                 {isPlaying ? `PLAYING @ ${speed}x` : "PAUSED"}
               </span>
               <span className="text-zinc-700">|</span>
               <span>EVENT {eventIndex + 1}/{events.length}</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
