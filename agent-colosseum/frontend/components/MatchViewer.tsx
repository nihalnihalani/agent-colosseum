'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AgentPanel } from './AgentPanel';
import { ScoreDisplay } from './ScoreDisplay';
import { AICommentator } from './AICommentator';
import { NegotiationView } from './NegotiationView';
import { AuctionView } from './AuctionView';
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
          
          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 bg-white text-black hover:bg-zinc-200 rounded-lg text-sm font-medium transition-colors"
            >
              Return to Lobby
            </button>
            {matchState.matchId && (
              <button
                onClick={() => router.push(`/replay/${matchState.matchId}`)}
                className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-lg text-sm font-medium transition-colors"
              >
                View Replay
              </button>
            )}
            <button
              onClick={() => router.push('/history')}
              className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-lg text-sm font-medium transition-colors"
            >
              Match History
            </button>
            <button
              onClick={() => router.push('/leaderboard')}
              className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-lg text-sm font-medium transition-colors"
            >
              Leaderboard
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ResourceWarsView({ matchState }: { matchState: MatchState }) {
  const resources = matchState.gameState?.resources ?? { A: 100, B: 100, C: 100 };
  const resourceColors: Record<string, string> = {
    A: 'from-rose-500 to-rose-400',
    B: 'from-violet-500 to-violet-400',
    C: 'from-cyan-500 to-cyan-400',
  };
  const resourceBorders: Record<string, string> = {
    A: 'border-rose-500/30',
    B: 'border-violet-500/30',
    C: 'border-cyan-500/30',
  };

  return (
    <div className="h-full flex flex-col gap-6 justify-center px-2">
      {/* Resource bars */}
      <div className="space-y-4">
        <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">Contested Resources</p>
        {Object.entries(resources).map(([key, value]) => (
          <div key={key} className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-mono text-zinc-400">RESOURCE {key}</span>
              <span className="text-xs font-mono text-zinc-300 tabular-nums">{value}</span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className={`h-full bg-gradient-to-r ${resourceColors[key] ?? 'from-zinc-500 to-zinc-400'} rounded-full`}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (value / 100) * 100)}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Current moves */}
      {(matchState.redMove || matchState.blueMove) && (
        <div className="grid grid-cols-2 gap-3">
          {matchState.redMove && (
            <div className={`p-3 rounded-lg bg-rose-500/10 border ${resourceBorders.A}`}>
              <p className="text-[10px] font-mono text-rose-400 uppercase tracking-wider mb-1.5">Red Move</p>
              <p className="text-sm font-mono text-white truncate">{matchState.redMove.type}</p>
              {matchState.redMove.amount > 0 && (
                <p className="text-xs text-zinc-500 mt-1 font-mono">{matchState.redMove.target} · {matchState.redMove.amount}</p>
              )}
            </div>
          )}
          {matchState.blueMove && (
            <div className={`p-3 rounded-lg bg-blue-500/10 border ${resourceBorders.C}`}>
              <p className="text-[10px] font-mono text-blue-400 uppercase tracking-wider mb-1.5">Blue Move</p>
              <p className="text-sm font-mono text-white truncate">{matchState.blueMove.type}</p>
              {matchState.blueMove.amount > 0 && (
                <p className="text-xs text-zinc-500 mt-1 font-mono">{matchState.blueMove.target} · {matchState.blueMove.amount}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Phase status when no moves yet */}
      {!matchState.redMove && !matchState.blueMove && (
        <div className="flex items-center justify-center gap-2 py-4">
          <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
          <span className="text-xs font-mono text-zinc-600">
            {matchState.phase === 'thinking' ? 'Agents calculating moves...' : 'Waiting for round start...'}
          </span>
        </div>
      )}
    </div>
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

  return <ResourceWarsView matchState={matchState} />;
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
      <div className="flex-1 relative z-10 p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0 overflow-y-auto">

        {/* Left: Agent Red */}
        <div className="lg:col-span-3 min-h-[400px]">
          <AgentPanel
            agent="red"
            personality={matchState.agents.red.personality}
            predictions={matchState.redPredictions}
            phase={matchState.phase}
            accuracy={matchState.accuracy.red}
          />
        </div>

        {/* Center: Arena Action */}
        <div className="lg:col-span-6 flex flex-col gap-6">
          <ScoreDisplay
            scores={matchState.gameState.scores}
            accuracy={matchState.accuracy}
            currentRound={matchState.currentRound}
            totalRounds={matchState.totalRounds}
            totalFuturesSimulated={matchState.totalFuturesSimulated}
            phase={matchState.phase}
          />

          <div className="glass-panel rounded-xl border border-white/5 relative overflow-hidden bg-gradient-to-b from-white/[0.02] to-transparent">
            <div className="relative z-10 p-6 min-h-[280px]">
              <GameSpecificView matchState={matchState} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <AICommentator matchState={matchState} />
             <AudiencePoll
               currentRound={matchState.currentRound}
               phase={matchState.phase}
               roundWinner={lastRoundWinner}
             />
          </div>
        </div>

        {/* Right: Agent Blue */}
        <div className="lg:col-span-3 min-h-[400px]">
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
