'use client';

import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Zap, Shield, Brain, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CommentatorState {
  strategyAnalysis: {
    red: { style: string; currentTactic: string; riskLevel: number };
    blue: { style: string; currentTactic: string; riskLevel: number };
  };
  momentum: { leader: string; confidence: number; reason: string };
  predictionTrends: { red: number[]; blue: number[] };
  keyMoments: Array<{ round: number; event: string; impact: string }>;
  currentInsight: string;
  matchProgress: { round: number; totalRounds: number; phase: string };
}

function MomentumBar({ leader, confidence }: { leader: string; confidence: number }) {
  // Position: 0 = far left (red), 50 = center, 100 = far right (blue)
  const position = leader === 'red'
    ? 50 - (confidence * 50)
    : leader === 'blue'
      ? 50 + (confidence * 50)
      : 50;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[9px] font-mono uppercase tracking-wider text-zinc-600">
        <span>RED</span>
        <span>BLUE</span>
      </div>
      <div className="relative h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-rose-500/30 via-transparent to-blue-500/30" />
        <motion.div
          className="absolute top-0 h-full w-2 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.4)]"
          animate={{ left: `calc(${position}% - 4px)` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>
    </div>
  );
}

function RiskMeter({ level, color }: { level: number; color: 'red' | 'blue' }) {
  const clampedLevel = Math.max(0, Math.min(1, level));
  return (
    <div className="flex items-center gap-1.5">
      {clampedLevel > 0.7 ? (
        <AlertTriangle className={cn('w-2.5 h-2.5', color === 'red' ? 'text-rose-400' : 'text-blue-400')} />
      ) : (
        <Shield className={cn('w-2.5 h-2.5', color === 'red' ? 'text-rose-400' : 'text-blue-400')} />
      )}
      <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          className={cn(
            'h-full rounded-full',
            color === 'red' ? 'bg-rose-500/60' : 'bg-blue-500/60'
          )}
          animate={{ width: `${clampedLevel * 100}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>
    </div>
  );
}

export function StrategyInsightCard({ state }: { state: CommentatorState }) {
  const recentMoments = state.keyMoments.slice(-3);

  return (
    <motion.div
      className="space-y-3"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Momentum */}
      <MomentumBar leader={state.momentum.leader} confidence={state.momentum.confidence} />
      {state.momentum.reason && (
        <p className="text-[9px] text-zinc-600 font-mono text-center truncate">{state.momentum.reason}</p>
      )}

      {/* Strategy badges */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Zap className="w-2.5 h-2.5 text-rose-400" />
          <span className="text-[10px] font-mono text-zinc-400 px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/10 truncate max-w-[100px]">
            {state.strategyAnalysis.red.style}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-zinc-400 px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/10 truncate max-w-[100px]">
            {state.strategyAnalysis.blue.style}
          </span>
          <Brain className="w-2.5 h-2.5 text-blue-400" />
        </div>
      </div>

      {/* Risk meters */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-0.5">
          <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-wider">Red Risk</span>
          <RiskMeter level={state.strategyAnalysis.red.riskLevel} color="red" />
        </div>
        <div className="space-y-0.5">
          <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-wider">Blue Risk</span>
          <RiskMeter level={state.strategyAnalysis.blue.riskLevel} color="blue" />
        </div>
      </div>

      {/* Key moments */}
      {recentMoments.length > 0 && (
        <div className="space-y-1">
          <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-wider">Key Moments</span>
          <div className="space-y-1">
            {recentMoments.map((moment, i) => (
              <div key={`${moment.round}-${i}`} className="flex items-start gap-2 text-[10px]">
                <span className="font-mono text-zinc-600 shrink-0">R{moment.round}</span>
                <span className="text-zinc-400 truncate">{moment.event}</span>
                {(moment.impact === 'high' || moment.impact === 'positive') ? (
                  <TrendingUp className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                ) : (moment.impact === 'medium') ? (
                  <Zap className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                ) : (moment.impact === 'low' || moment.impact === 'negative') ? (
                  <TrendingDown className="w-2.5 h-2.5 text-rose-400 shrink-0" />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Current insight */}
      {state.currentInsight && (
        <div className="pt-1 border-t border-white/5">
          <p className="text-[11px] text-zinc-300 leading-relaxed">{state.currentInsight}</p>
        </div>
      )}
    </motion.div>
  );
}
