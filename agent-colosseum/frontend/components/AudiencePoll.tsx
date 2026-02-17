'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, Users } from 'lucide-react';
import type { MatchPhase } from '@/lib/types';
import { clsx } from 'clsx';

interface AudiencePollProps {
  currentRound: number;
  phase: MatchPhase;
  roundWinner?: string;
}

interface Vote {
  round: number;
  votedFor: 'red' | 'blue';
  wasCorrect?: boolean;
}

export function AudiencePoll({ currentRound, phase, roundWinner }: AudiencePollProps) {
  const [votes, setVotes] = useState<Vote[]>([]);
  const [currentVote, setCurrentVote] = useState<'red' | 'blue' | null>(null);
  const [showResult, setShowResult] = useState(false);

  const totalVoted = votes.filter(v => v.wasCorrect !== undefined).length;
  const totalCorrect = votes.filter(v => v.wasCorrect === true).length;
  const accuracyPct = totalVoted > 0 ? Math.round((totalCorrect / totalVoted) * 100) : 0;

  // Reset vote each round
  useEffect(() => {
    if (phase === 'thinking') {
      setCurrentVote(null);
      setShowResult(false);
    }
  }, [currentRound, phase]);

  // Show result when round ends
  useEffect(() => {
    if ((phase === 'round_end' || phase === 'match_end') && currentVote && roundWinner) {
      const wasCorrect = currentVote === roundWinner;
      setVotes(prev => {
        const existing = prev.find(v => v.round === currentRound);
        if (existing) return prev;
        return [...prev, { round: currentRound, votedFor: currentVote, wasCorrect }];
      });
      setShowResult(true);
    }
  }, [phase, currentVote, roundWinner, currentRound]);

  const handleVote = useCallback((agent: 'red' | 'blue') => {
    if (currentVote || phase === 'round_end' || phase === 'match_end') return;
    setCurrentVote(agent);
  }, [currentVote, phase]);

  const canVote = phase === 'thinking' || phase === 'committed' || phase === 'revealed';
  const lastVote = votes.find(v => v.round === currentRound);

  return (
    <motion.div
      className="glass-panel overflow-hidden rounded-xl border border-white/5 bg-[#0a0a0f]"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7 }}
    >
      <div className="flex items-center justify-between p-3 border-b border-white/5 bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <Users className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-xs font-mono font-medium uppercase tracking-wider text-zinc-300">
            Consensus
          </span>
        </div>
        {totalVoted > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <TrendingUp className="w-3 h-3 text-emerald-400" />
            <span className="text-[10px] font-mono text-emerald-400 font-bold">{accuracyPct}% ACC</span>
          </div>
        )}
      </div>

      <div className="p-4">
        <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold text-center mb-3">
          Predict Round Winner
        </p>

        <div className="flex gap-3 mb-4">
          <motion.button
            onClick={() => handleVote('red')}
            disabled={!canVote || !!currentVote}
            className={clsx(
              "flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all relative overflow-hidden group border",
              currentVote === 'red'
                ? "bg-rose-500/10 border-rose-500/40 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.1)]"
                : "bg-white/[0.02] border-white/5 text-zinc-500 hover:bg-rose-500/5 hover:border-rose-500/20 hover:text-rose-200"
            )}
            whileTap={canVote && !currentVote ? { scale: 0.98 } : undefined}
          >
             <span className="relative z-10 font-sans tracking-wide">RED</span>
             {currentVote === 'red' && <motion.div layoutId="vote-indicator" className="absolute inset-0 bg-rose-500/5" />}
          </motion.button>
          
          <motion.button
            onClick={() => handleVote('blue')}
            disabled={!canVote || !!currentVote}
            className={clsx(
              "flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all relative overflow-hidden group border",
              currentVote === 'blue'
                ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.1)]"
                : "bg-white/[0.02] border-white/5 text-zinc-500 hover:bg-indigo-500/5 hover:border-indigo-500/20 hover:text-indigo-200"
            )}
            whileTap={canVote && !currentVote ? { scale: 0.98 } : undefined}
          >
            <span className="relative z-10 font-sans tracking-wide">BLUE</span>
            {currentVote === 'blue' && <motion.div layoutId="vote-indicator" className="absolute inset-0 bg-indigo-500/5" />}
          </motion.button>
        </div>

        {/* Vote result */}
        <div className="h-6 flex items-center justify-center">
          <AnimatePresence mode="wait">
            {showResult && lastVote ? (
              <motion.div
                key="result"
                className={clsx(
                  "px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider border flex items-center gap-2",
                  lastVote.wasCorrect
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                )}
                initial={{ opacity: 0, y: 2 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                {lastVote.wasCorrect ? (
                  <><span>+100 XP</span><span className="w-px h-3 bg-current opacity-20"/><span>PREDICTION VALID</span></>
                ) : (
                  <><span>PREDICTION FAILED</span></>
                )}
              </motion.div>
            ) : (
               <motion.div
                 key="status"
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 exit={{ opacity: 0 }}
                 className="text-[10px] text-zinc-600 font-mono"
               >
                 {currentVote ? "VOTE REGISTERED // AWAITING OUTCOME" : "MARKET OPEN"}
               </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Vote history bar */}
        {votes.length > 0 && (
          <div className="flex gap-px mt-3 h-1 rounded-full overflow-hidden bg-white/5 w-full max-w-[200px] mx-auto">
            {votes.map((v, i) => (
              <div
                key={i}
                className={clsx(
                  "flex-1 transition-colors",
                  v.wasCorrect ? "bg-emerald-500" : "bg-rose-500/20"
                )}
                title={`R${v.round}: ${v.votedFor} - ${v.wasCorrect ? 'Correct' : 'Wrong'}`}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
