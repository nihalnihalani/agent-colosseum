'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AgentPanel } from './AgentPanel';
import { ScoreDisplay } from './ScoreDisplay';
import { AICommentator } from './AICommentator';
import { NegotiationView } from './NegotiationView';
import { AuctionView } from './AuctionView';
import { GPUBiddingView } from './GPUBiddingView';
import { AudiencePoll } from './AudiencePoll';
import type { MatchState } from '@/lib/types';
import { Trophy, ArrowLeft, Activity, Radio, Cpu, Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';

interface MatchViewerProps {
  matchState: MatchState;
}

function ConfettiCelebration({ winner }: { winner: string }) {
  // ... (Keep existing confetti logic, maybe refine colors)
  const particles = useMemo(() => {
    const colors =
      winner === 'red'
        ? ['#ef4444', '#f97316', '#fbbf24', '#ffffff'] // Rose/Orange/Amber/White
        : ['#3b82f6', '#06b6d4', '#8b5cf6', '#ffffff']; // Blue/Cyan/Violet/White

    return Array.from({ length: 60 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 2,
      duration: 2 + Math.random() * 3,
      size: 4 + Math.random() * 8,
      rotation: Math.random() * 360,
    }));
  }, [winner]);

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute top-[-20px]"
          style={{
            left: p.left,
            backgroundColor: p.color,
            width: p.size,
            height: p.size,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
          }}
          animate={{
            y: ['0vh', '100vh'],
            rotate: [p.rotation, p.rotation + 360],
            opacity: [1, 1, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: "linear",
            repeat: Infinity,
          }}
        />
      ))}
    </div>
  );
}

function MatchEndOverlay({ matchState }: { matchState: MatchState }) {
  const isRed = matchState.winner === 'red';
  const router = useRouter();

  return (
    <motion.div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        className="text-center max-w-2xl w-full p-12 rounded-3xl border border-white/10 bg-[#0a0a0f] shadow-2xl relative overflow-hidden"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 25, delay: 0.1 }}
      >
        {/* Refined Glow effect */}
        <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-full h-64 bg-${isRed ? 'rose' : 'indigo'}-500/10 blur-[100px] pointer-events-none`} />

        <div className="relative z-10 space-y-8">
          <div className="inline-flex items-center justify-center p-4 rounded-full bg-white/5 border border-white/10 mb-4">
            <Trophy className={`w-8 h-8 ${isRed ? 'text-amber-400' : 'text-blue-400'}`} />
          </div>
          
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-mono">
              Simulation Complete
            </p>
            <h2 className="text-6xl md:text-7xl font-sans font-bold tracking-tight text-white">
              {isRed ? 'Red Victory' : 'Blue Victory'}
            </h2>
          </div>
          
          <div className="grid grid-cols-3 gap-8 py-8 border-y border-white/5">
            <div className="text-center">
              <p className="text-3xl font-mono font-bold text-white mb-1">
                {matchState.gameState.scores.red}
              </p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Red Score</p>
            </div>
            <div className="flex items-center justify-center">
              <span className="text-zinc-700 font-mono text-xl">VS</span>
            </div>
            <div className="text-center">
              <p className="text-3xl font-mono font-bold text-white mb-1">
                {matchState.gameState.scores.blue}
              </p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Blue Score</p>
            </div>
          </div>
          
          <div className="flex justify-center gap-4">
            <button 
              onClick={() => router.push('/')}
              className="px-8 py-3 bg-white text-black hover:bg-zinc-200 rounded-lg text-sm font-medium transition-colors"
            >
              Return to Lobby
            </button>
            <button 
              onClick={() => window.location.reload()}
              className="px-8 py-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-lg text-sm font-medium transition-colors"
            >
              Replay Match
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function GameSpecificView({ matchState }: { matchState: MatchState }) {
  if (matchState.gameType === 'negotiation' && matchState.negotiationState) {
    return (
      <NegotiationView
        state={matchState.negotiationState}
        currentRound={matchState.currentRound}
        totalRounds={matchState.totalRounds}
        redMove={matchState.redMove}
        blueMove={matchState.blueMove}
        phase={matchState.phase}
      />
    );
  }

  if (matchState.gameType === 'auction' && matchState.auctionState) {
    return (
      <AuctionView
        state={matchState.auctionState}
        currentRound={matchState.currentRound}
        totalRounds={matchState.totalRounds}
        redMove={matchState.redMove}
        blueMove={matchState.blueMove}
        phase={matchState.phase}
      />
    );
  }

  if (matchState.gameType === 'gpu_bidding' && matchState.gpuBiddingState) {
    return (
      <GPUBiddingView
        state={matchState.gpuBiddingState}
        currentRound={matchState.currentRound}
        totalRounds={matchState.totalRounds}
        redMove={matchState.redMove}
        blueMove={matchState.blueMove}
        phase={matchState.phase}
      />
    );
  }

  return null;
}

export function MatchViewer({ matchState }: MatchViewerProps) {
  const router = useRouter();
  const isMatchEnd = matchState.phase === 'match_end';
  const showFlash = matchState.phase === 'revealed';

  // Track round winner for audience poll
  const [lastRoundWinner, setLastRoundWinner] = useState<string | undefined>();

  useEffect(() => {
    if (matchState.phase === 'round_end' || matchState.phase === 'match_end') {
      const redCorrect = matchState.redPredictions.filter(p => p.wasCorrect).length;
      const blueCorrect = matchState.bluePredictions.filter(p => p.wasCorrect).length;
      if (redCorrect > blueCorrect) {
        setLastRoundWinner('red');
      } else if (blueCorrect > redCorrect) {
        setLastRoundWinner('blue');
      } else {
        setLastRoundWinner(matchState.gameState.scores.red >= matchState.gameState.scores.blue ? 'red' : 'blue');
      }
    }
  }, [matchState.phase, matchState.currentRound, matchState.redPredictions, matchState.bluePredictions, matchState.gameState.scores]);

  const gameTypeLabel = matchState.gameType.replace('_', ' ');

  return (
    <div className="min-h-screen flex flex-col relative bg-[#030304] overflow-hidden font-sans text-zinc-300">
      
      {/* Subtle Background Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_80%)] pointer-events-none" />

      {/* Screen flash on collapse */}
      <AnimatePresence>
        {showFlash && (
          <motion.div
            className="fixed inset-0 z-30 bg-white pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.05 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        )}
      </AnimatePresence>

      {/* Confetti on match end */}
      {isMatchEnd && matchState.winner && (
        <ConfettiCelebration winner={matchState.winner} />
      )}

      {/* Match end overlay */}
      <AnimatePresence>
        {isMatchEnd && <MatchEndOverlay matchState={matchState} />}
      </AnimatePresence>

      {/* Header - Clean & Minimal */}
      <header className="relative z-20 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#030304]/80 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push('/')}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors text-zinc-500 hover:text-zinc-300"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-white tracking-tight">
              Agent Colosseum
            </span>
            <span className="text-zinc-700">/</span>
            <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
              {gameTypeLabel}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-[10px] text-emerald-400 font-medium tracking-wide">LIVE UPLINK</span>
          </div>
          <div className="h-4 w-px bg-zinc-800" />
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Cpu className="w-3 h-3" />
            <span className="font-mono">v2.1.0</span>
          </div>
        </div>
      </header>

      {/* Main Layout Grid */}
      <div className="flex-1 overflow-hidden relative z-10 p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
        
        {/* Left: Agent Red */}
        <div className="lg:col-span-3 lg:h-full min-h-[400px]">
          <AgentPanel
            agent="red"
            personality={matchState.agents.red.personality}
            predictions={matchState.redPredictions}
            phase={matchState.phase}
            accuracy={matchState.accuracy.red}
          />
        </div>

        {/* Center: Arena Action */}
        <div className="lg:col-span-6 flex flex-col gap-6 lg:h-full lg:overflow-y-auto no-scrollbar">
          <ScoreDisplay
            scores={matchState.gameState?.scores ?? matchState.gpuBiddingState?.scores ?? { red: 0, blue: 0 }}
            accuracy={matchState.accuracy}
            currentRound={matchState.currentRound}
            totalRounds={matchState.totalRounds}
            totalFuturesSimulated={matchState.totalFuturesSimulated}
            phase={matchState.phase}
          />

          <div className="flex-1 min-h-[360px] glass-panel p-1 rounded-xl border border-white/5 relative overflow-hidden bg-gradient-to-b from-white/[0.02] to-transparent">
             <div className="relative z-10 h-full p-6">
               <GameSpecificView matchState={matchState} />
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-20 lg:pb-0">
             <AICommentator matchState={matchState} />
             <AudiencePoll
               currentRound={matchState.currentRound}
               phase={matchState.phase}
               roundWinner={lastRoundWinner}
             />
          </div>
        </div>

        {/* Right: Agent Blue */}
        <div className="lg:col-span-3 lg:h-full min-h-[400px]">
           <AgentPanel
            agent="blue"
            personality={matchState.agents.blue.personality}
            predictions={matchState.bluePredictions}
            phase={matchState.phase}
            accuracy={matchState.accuracy.blue}
          />
        </div>
      </div>
    </div>
  );
}
