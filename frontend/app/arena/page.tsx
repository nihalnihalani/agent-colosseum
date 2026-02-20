'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, Suspense } from 'react';
import { useMatchWebSocket } from '@/hooks/useMatchWebSocket';
import { MatchViewer } from '@/components/MatchViewer';
import { motion } from 'framer-motion';
import type { AgentConfig, GameType, MatchConfig } from '@/lib/types';

function ArenaContent() {
  const searchParams = useSearchParams();
  const matchId = searchParams.get('matchId');
  const gameType = (searchParams.get('gameType') || 'resource_wars') as GameType;
  const redPersonality = (searchParams.get('red') || 'aggressive') as AgentConfig['personality'];
  const bluePersonality = (searchParams.get('blue') || 'defensive') as AgentConfig['personality'];
  const totalRounds = parseInt(searchParams.get('rounds') || '10');

  const { matchState, isConnected, startMatch, error } =
    useMatchWebSocket(matchId);

  useEffect(() => {
    if (matchId && matchState.phase === 'lobby') {
      const config: MatchConfig = {
        gameType,
        redPersonality,
        bluePersonality,
        totalRounds,
      };
      const timer = setTimeout(() => startMatch(config), 500);
      return () => clearTimeout(timer);
    }
  }, [matchId, matchState.phase, gameType, redPersonality, bluePersonality, totalRounds, startMatch]);

  if (!matchId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-white/40">No match ID provided.</p>
      </div>
    );
  }

  if (error && !isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          className="glass-panel p-8 text-center max-w-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <p className="text-red-400 mb-2">Connection Error</p>
          <p className="text-white/40 text-sm">{error}</p>
        </motion.div>
      </div>
    );
  }

  if (matchState.phase === 'lobby' && matchState.currentRound === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="w-12 h-12 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-white/60 text-sm">Preparing the Arena...</p>
        </motion.div>
      </div>
    );
  }

  return <MatchViewer matchState={matchState} />;
}

export default function ArenaPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-12 h-12 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ArenaContent />
    </Suspense>
  );
}
