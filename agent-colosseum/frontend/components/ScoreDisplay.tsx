'use client';

import { motion, useMotionValue, useTransform, animate, AnimatePresence } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { Activity, Radio, Cpu, Zap, BrainCircuit } from 'lucide-react';
import type { MatchState } from '@/lib/types';
import { clsx } from 'clsx';

interface ScoreDisplayProps {
  scores: { red: number; blue: number };
  accuracy: { red: number; blue: number };
  currentRound: number;
  totalRounds: number;
  totalFuturesSimulated: number;
  phase: MatchState['phase'];
}

function AnimatedNumber({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, (latest) => Math.round(latest));

  useEffect(() => {
    const controls = animate(motionValue, value, {
      type: 'spring',
      stiffness: 50,
      damping: 15,
    });
    return controls.stop;
  }, [value, motionValue]);

  useEffect(() => {
    const unsubscribe = rounded.on('change', (latest) => {
      if (ref.current) {
        ref.current.textContent = String(latest);
      }
    });
    return unsubscribe;
  }, [rounded]);

  return <span ref={ref}>0</span>;
}

export function ScoreDisplay({
  scores,
  accuracy,
  currentRound,
  totalRounds,
  totalFuturesSimulated,
  phase,
}: ScoreDisplayProps) {
  const safeScores = scores ?? { red: 0, blue: 0 };
  const total = (safeScores.red + safeScores.blue) || 1;
  const redPercent = (safeScores.red / total) * 100;
  const bluePercent = (safeScores.blue / total) * 100;

  return (
    <motion.div
      className="glass-panel p-6 relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-b from-white/[0.03] to-transparent"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      {/* Top Meta Bar */}
      <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-md bg-white/5 text-zinc-400">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <span className="block text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Round Status</span>
            <span className="text-sm font-medium text-white">{currentRound} / {totalRounds}</span>
          </div>
        </div>
        
        {phase === 'thinking' ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20">
             <BrainCircuit className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
             <span className="text-xs text-amber-400 font-medium tracking-wide">SIMULATING</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
             <span className="text-xs text-emerald-400 font-medium tracking-wide">ACTIVE</span>
          </div>
        )}

        <div className="flex items-center gap-3 text-right">
          <div>
            <span className="block text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Simulations</span>
            <span className="text-sm font-medium text-white font-mono">{totalFuturesSimulated.toLocaleString()}</span>
          </div>
          <div className="p-1.5 rounded-md bg-white/5 text-zinc-400">
            <Cpu className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Main Score Display */}
      <div className="flex items-center justify-between gap-12 mb-8 px-4">
        {/* Red Score */}
        <div className="text-center flex-1 relative group">
          <div className="absolute inset-0 bg-rose-500/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          <div className="relative">
             <div className="text-7xl font-sans font-bold tracking-tighter text-white">
               <AnimatedNumber value={safeScores.red} />
             </div>
             <div className="text-xs text-rose-400 font-medium uppercase tracking-widest mt-2">Agent Red</div>
          </div>
        </div>

        {/* VS Divider */}
        <div className="flex flex-col items-center gap-3 opacity-30">
           <div className="h-12 w-px bg-gradient-to-b from-transparent via-white to-transparent" />
        </div>

        {/* Blue Score */}
        <div className="text-center flex-1 relative group">
          <div className="absolute inset-0 bg-indigo-500/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          <div className="relative">
             <div className="text-7xl font-sans font-bold tracking-tighter text-white">
               <AnimatedNumber value={safeScores.blue} />
             </div>
             <div className="text-xs text-indigo-400 font-medium uppercase tracking-widest mt-2">Agent Blue</div>
          </div>
        </div>
      </div>

      {/* Progress / Momentum Bar */}
      <div className="relative h-1.5 bg-zinc-800 rounded-full overflow-hidden mb-2 mx-4">
        <motion.div
          className="absolute inset-y-0 left-0 bg-rose-500"
          animate={{ width: `${redPercent}%` }}
          transition={{ type: 'spring', stiffness: 40, damping: 15 }}
        />
        <motion.div
          className="absolute inset-y-0 right-0 bg-indigo-500"
          animate={{ width: `${bluePercent}%` }}
          transition={{ type: 'spring', stiffness: 40, damping: 15 }}
        />
        {/* Center marker */}
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-black/50 -translate-x-1/2 z-10" />
      </div>

      {/* Status Footer */}
      <div className="h-6 flex items-center justify-center mt-4">
        <AnimatePresence mode="wait">
          {phase === 'thinking' && (
            <motion.span 
              key="thinking"
              initial={{ opacity: 0, y: 5 }} 
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="text-xs text-zinc-500 font-mono flex items-center gap-2"
            >
              <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-pulse" />
              Processing neural pathways...
            </motion.span>
          )}
          {phase === 'revealed' && (
            <motion.span 
              key="revealed"
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }}
              className="text-xs text-white font-medium uppercase tracking-widest px-3 py-1 bg-white/5 rounded-full border border-white/5"
            >
              Outcome Locked
            </motion.span>
          )}
        </AnimatePresence>
      </div>

    </motion.div>
  );
}
