'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Gavel, Coins, TrendingUp, AlertOctagon } from 'lucide-react';
import type { AuctionGameState } from '@/lib/types';
import { clsx } from 'clsx';

interface AuctionViewProps {
  state: AuctionGameState;
  currentRound: number;
  totalRounds: number;
  redMove?: { type: string; target: string; amount: number };
  blueMove?: { type: string; target: string; amount: number };
  phase: string;
}

const STARTING_CREDITS = 1000;

function CreditBar({ credits, agent }: { credits: number; agent: 'red' | 'blue' }) {
  const pct = Math.max(0, (credits / STARTING_CREDITS) * 100);
  const isRed = agent === 'red';
  const color = isRed ? "text-red-400" : "text-blue-400";
  const bgBar = isRed ? "bg-red-500" : "bg-blue-500";
  const glow = isRed ? "shadow-[0_0_10px_rgba(239,68,68,0.3)]" : "shadow-[0_0_10px_rgba(59,130,246,0.3)]";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className={clsx("text-[10px] font-bold uppercase tracking-wider", color)}>
          {isRed ? 'Agent Red' : 'Agent Blue'}
        </span>
        <span className="text-xs font-mono text-zinc-400">{credits} CR</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          className={clsx("h-full rounded-full relative", bgBar, glow)}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 100 }}
        >
           <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-l from-white/30 to-transparent" />
        </motion.div>
      </div>
    </div>
  );
}

export function AuctionView({
  state,
  currentRound,
  totalRounds,
  redMove,
  blueMove,
  phase,
}: AuctionViewProps) {
  const isRevealed = phase === 'revealed' || phase === 'round_end' || phase === 'match_end';

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <span className="text-xs font-display font-bold uppercase tracking-wider text-yellow-400 flex items-center gap-2">
          <Gavel className="w-4 h-4" />
          Auction House
        </span>
        <span className="text-[10px] text-zinc-500 font-mono uppercase">
          Lot {currentRound}/{totalRounds} &middot; {state.itemsRemaining} Left
        </span>
      </div>

      {/* Current item */}
      {state.currentItem ? (
        <motion.div
          className="bg-gradient-to-b from-yellow-500/10 to-transparent border border-yellow-500/20 rounded-xl p-6 text-center relative overflow-hidden"
          key={state.currentItem.name}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring' }}
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.5)]" />
          
          <p className="text-[10px] text-yellow-500/60 uppercase tracking-widest mb-2 font-bold">Current Lot</p>
          <p className="text-2xl md:text-3xl font-display font-black text-white uppercase tracking-wide text-glow-gold">
            {state.currentItem.name}
          </p>
          <div className="flex items-center justify-center gap-2 mt-2 text-sm text-zinc-400 font-mono">
             <Coins className="w-3 h-3" />
             <span>Base Value: {state.currentItem.baseValue}</span>
          </div>
        </motion.div>
      ) : (
        <div className="text-center py-8 border border-white/5 rounded-xl border-dashed">
          <Gavel className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
          <p className="text-sm text-zinc-500 italic">Auction proceedings concluded.</p>
        </div>
      )}

      {/* Credit bars */}
      <div className="grid grid-cols-2 gap-6 bg-white/5 p-4 rounded-xl border border-white/5">
        <CreditBar credits={state.credits.red} agent="red" />
        <CreditBar credits={state.credits.blue} agent="blue" />
      </div>

      {/* Bids revealed */}
      <AnimatePresence>
        {isRevealed && (redMove || blueMove) && (
          <motion.div
            className="grid grid-cols-2 gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {redMove && (
              <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 text-center relative overflow-hidden">
                <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest mb-1">Red Bid</p>
                <div className="text-2xl font-display font-bold text-white">
                  {redMove.type === 'pass' ? <span className="text-zinc-500">PASS</span> : redMove.amount}
                </div>
                {redMove.type === 'bluff_bid' && (
                  <div className="absolute top-2 right-2 text-[10px] flex items-center gap-1 text-orange-400 font-bold uppercase">
                     <AlertOctagon className="w-3 h-3" /> Bluff
                  </div>
                )}
              </div>
            )}
            {blueMove && (
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 text-center relative overflow-hidden">
                <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mb-1">Blue Bid</p>
                <div className="text-2xl font-display font-bold text-white">
                  {blueMove.type === 'pass' ? <span className="text-zinc-500">PASS</span> : blueMove.amount}
                </div>
                {blueMove.type === 'bluff_bid' && (
                  <div className="absolute top-2 right-2 text-[10px] flex items-center gap-1 text-orange-400 font-bold uppercase">
                     <AlertOctagon className="w-3 h-3" /> Bluff
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Items won tally */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="text-[10px] text-red-400 font-bold uppercase tracking-wider border-b border-red-500/10 pb-1">
            Red Inventory ({state.wonItems.red.length})
          </p>
          <div className="space-y-1 max-h-32 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10">
            {state.wonItems.red.length === 0 ? (
              <p className="text-[10px] text-zinc-600 italic">Empty</p>
            ) : (
              state.wonItems.red.map((item, i) => (
                <div key={i} className="text-[10px] text-zinc-400 flex justify-between bg-white/5 px-2 py-1 rounded">
                  <span className="truncate max-w-[80px]">{item.name}</span>
                  <span className="text-zinc-600 font-mono">-{item.paid}</span>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider border-b border-blue-500/10 pb-1">
            Blue Inventory ({state.wonItems.blue.length})
          </p>
          <div className="space-y-1 max-h-32 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10">
            {state.wonItems.blue.length === 0 ? (
              <p className="text-[10px] text-zinc-600 italic">Empty</p>
            ) : (
              state.wonItems.blue.map((item, i) => (
                <div key={i} className="text-[10px] text-zinc-400 flex justify-between bg-white/5 px-2 py-1 rounded">
                  <span className="truncate max-w-[80px]">{item.name}</span>
                  <span className="text-zinc-600 font-mono">-{item.paid}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
