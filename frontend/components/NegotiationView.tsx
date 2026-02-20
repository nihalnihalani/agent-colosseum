'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { DollarSign, Handshake, XCircle, ArrowRightLeft, ShieldAlert } from 'lucide-react';
import type { NegotiationGameState } from '@/lib/types';
import { clsx } from 'clsx';

interface NegotiationViewProps {
  state: NegotiationGameState;
  currentRound: number;
  totalRounds: number;
  redMove?: { type: string; target: string; amount: number };
  blueMove?: { type: string; target: string; amount: number };
  phase: string;
}

function MoveTag({ move }: { move: string }) {
  const config: Record<string, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
    propose: { 
      label: 'Propose', 
      bg: 'bg-purple-500/20', 
      text: 'text-purple-300',
      icon: <ArrowRightLeft className="w-3 h-3" />
    },
    accept: { 
      label: 'Accept', 
      bg: 'bg-green-500/20', 
      text: 'text-green-300',
      icon: <Handshake className="w-3 h-3" />
    },
    reject: { 
      label: 'Reject', 
      bg: 'bg-red-500/20', 
      text: 'text-red-300',
      icon: <XCircle className="w-3 h-3" />
    },
    counter_offer: { 
      label: 'Counter', 
      bg: 'bg-yellow-500/20', 
      text: 'text-yellow-300',
      icon: <ArrowRightLeft className="w-3 h-3" />
    },
    bluff_walkaway: { 
      label: 'Bluff Walk', 
      bg: 'bg-orange-500/20', 
      text: 'text-orange-300',
      icon: <ShieldAlert className="w-3 h-3" />
    },
  };

  const style = config[move] || { label: move, bg: 'bg-white/10', text: 'text-white/60', icon: null };

  return (
    <span className={clsx("flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider", style.bg, style.text)}>
      {style.icon}
      {style.label}
    </span>
  );
}

export function NegotiationView({
  state,
  currentRound,
  totalRounds,
  redMove,
  blueMove,
  phase,
}: NegotiationViewProps) {
  const isRevealed = phase === 'revealed' || phase === 'round_end' || phase === 'match_end';
  const dealStruck = state.dealPrice !== null;

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <span className="text-xs font-display font-bold uppercase tracking-wider text-purple-400 flex items-center gap-2">
          <Handshake className="w-4 h-4" />
          Negotiation Table
        </span>
        <span className="text-[10px] text-zinc-500 font-mono uppercase">
          Round {currentRound} / {totalRounds}
        </span>
      </div>

      {/* Current offer display */}
      <div className="relative py-6">
        <div className="flex items-center justify-center">
          {state.currentOffer !== null ? (
            <motion.div
              className="text-center relative z-10"
              key={state.currentOffer}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2">Current Offer</p>
              <div className="flex items-center justify-center gap-1 text-5xl font-display font-black text-white text-glow">
                <span className="text-3xl opacity-50">$</span>
                {state.currentOffer}
              </div>
              <div className={clsx(
                "inline-flex items-center gap-2 mt-3 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border",
                state.offerBy === 'red' ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-blue-500/10 border-blue-500/20 text-blue-400"
              )}>
                <div className={clsx("w-2 h-2 rounded-full animate-pulse", state.offerBy === 'red' ? "bg-red-500" : "bg-blue-500")} />
                by {state.offerBy === 'red' ? 'Agent Red' : 'Agent Blue'}
              </div>
            </motion.div>
          ) : (
             <div className="text-center">
               <div className="w-16 h-16 rounded-full bg-white/5 mx-auto mb-3 flex items-center justify-center">
                 <DollarSign className="w-6 h-6 text-white/20" />
               </div>
               <p className="text-sm text-zinc-500 italic">Awaiting opening offer...</p>
             </div>
          )}
        </div>

        {/* Price range visualization */}
        <div className="mt-8 relative h-1 bg-white/10 rounded-full">
          {state.currentOffer !== null && (
            <motion.div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-purple-500 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.5)] z-10"
              style={{ left: `${state.currentOffer}%` }}
              animate={{ left: `${state.currentOffer}%` }}
              transition={{ type: 'spring', stiffness: 200 }}
            />
          )}
          <div className="absolute top-3 w-full flex justify-between text-[10px] font-mono text-zinc-600">
            <span>$0</span>
            <span>$50</span>
            <span>$100</span>
          </div>
        </div>
      </div>

      {/* Deal struck banner */}
      <AnimatePresence>
        {dealStruck && (
          <motion.div
            className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center relative overflow-hidden"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="absolute inset-0 bg-green-500/5 animate-pulse" />
            <div className="relative z-10">
              <div className="flex items-center justify-center gap-2 text-green-400 font-bold text-lg font-display uppercase tracking-wide">
                <Handshake className="w-5 h-5" />
                Deal Struck
              </div>
              <p className="text-4xl font-black text-white mt-1">${state.dealPrice}</p>
              {state.dealRound && (
                <p className="text-xs text-green-400/60 mt-2 font-mono">
                  AGREEMENT REACHED IN ROUND {state.dealRound}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Moves display (when revealed) */}
      <AnimatePresence>
        {isRevealed && (redMove || blueMove) && (
          <motion.div
            className="grid grid-cols-2 gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {redMove && (
              <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 relative overflow-hidden">
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-red-500/10">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  <span className="text-[10px] uppercase tracking-wider text-red-400 font-bold">Red Move</span>
                </div>
                <div className="flex flex-col gap-2">
                  <MoveTag move={redMove.type} />
                  {redMove.amount > 0 && (
                    <div className="text-lg font-bold text-white font-display">
                      <span className="text-xs text-zinc-500 mr-1">$</span>
                      {redMove.amount}
                    </div>
                  )}
                </div>
              </div>
            )}
            {blueMove && (
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 relative overflow-hidden">
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-blue-500/10">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  <span className="text-[10px] uppercase tracking-wider text-blue-400 font-bold">Blue Move</span>
                </div>
                <div className="flex flex-col gap-2">
                  <MoveTag move={blueMove.type} />
                  {blueMove.amount > 0 && (
                    <div className="text-lg font-bold text-white font-display">
                      <span className="text-xs text-zinc-500 mr-1">$</span>
                      {blueMove.amount}
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
