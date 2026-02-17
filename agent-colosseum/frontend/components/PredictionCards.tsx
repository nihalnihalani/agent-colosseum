'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Target, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import type { Prediction, MatchPhase } from '@/lib/types';
import { clsx } from 'clsx';

interface PredictionCardsProps {
  predictions: Prediction[];
  agentColor: 'red' | 'blue';
  phase: MatchPhase;
}

export function PredictionCards({
  predictions,
  agentColor,
  phase,
}: PredictionCardsProps) {
  const isRevealed = phase === 'revealed' || phase === 'round_end' || phase === 'match_end';
  
  return (
    <div className="space-y-3">
      <AnimatePresence mode="popLayout">
        {predictions.map((pred, i) => {
          const isCorrect = pred.wasCorrect;
          
          let borderColor = "border-white/5";
          let bgColor = "bg-white/5";
          let textColor = "text-zinc-400";
          let icon = <Target className="w-3 h-3 text-zinc-500" />;
          let barColor = agentColor === 'red' ? 'bg-red-500' : 'bg-blue-500';

          if (isRevealed && isCorrect !== undefined) {
            if (isCorrect) {
              borderColor = "border-green-500/50";
              bgColor = "bg-green-500/10";
              textColor = "text-green-300";
              icon = <CheckCircle2 className="w-3 h-3 text-green-400" />;
              barColor = "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]";
            } else {
              borderColor = "border-red-500/30";
              bgColor = "bg-red-500/5";
              textColor = "text-red-400/60 line-through";
              icon = <XCircle className="w-3 h-3 text-red-500/50" />;
              barColor = "bg-red-500/30";
            }
          } else {
             // Default thinking/committed state
             borderColor = agentColor === 'red' ? "border-red-500/20" : "border-blue-500/20";
             bgColor = agentColor === 'red' ? "bg-red-500/5" : "bg-blue-500/5";
             textColor = agentColor === 'red' ? "text-red-200" : "text-blue-200";
          }

          return (
            <motion.div
              key={`${pred.opponentMove}-${i}`}
              className={clsx(
                "p-3 rounded-lg border transition-all duration-300 relative overflow-hidden group",
                borderColor,
                bgColor
              )}
              initial={{ opacity: 0, x: agentColor === 'red' ? -20 : 20 }}
              animate={{
                opacity: isRevealed && isCorrect === false ? 0.6 : 1,
                x: 0,
              }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 25,
                delay: i * 0.1,
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {icon}
                  <span className={clsx("text-xs font-mono font-bold uppercase tracking-wider", textColor)}>
                    Op: {pred.opponentMove}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  {isRevealed && isCorrect !== undefined && (
                    <span
                      className={clsx(
                        "text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-sm",
                        isCorrect ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                      )}
                    >
                      {isCorrect ? 'HIT' : 'MISS'}
                    </span>
                  )}
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {Math.round(pred.confidence * 100)}%
                  </span>
                </div>
              </div>

              {/* Confidence Bar */}
              <div className="w-full h-1 bg-black/40 rounded-full overflow-hidden mb-2">
                <motion.div
                  className={clsx("h-full rounded-full relative", barColor)}
                  initial={{ width: 0 }}
                  animate={{ width: `${pred.confidence * 100}%` }}
                  transition={{ duration: 0.8, delay: i * 0.1 + 0.2, ease: "easeOut" }}
                >
                  <div className="absolute top-0 right-0 w-1 h-full bg-white/50" />
                </motion.div>
              </div>

              {/* Footer */}
              <div className="flex justify-between items-center text-[10px] text-zinc-500">
                <span className="flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-zinc-600" />
                  Counter: <span className="text-zinc-300 font-bold uppercase">{pred.counter}</span>
                </span>
                {pred.reasoning && (
                  <span className="opacity-50 truncate max-w-[100px] italic">
                    {pred.reasoning.slice(0, 15)}...
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
