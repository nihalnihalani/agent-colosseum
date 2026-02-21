'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Trophy, Target, Swords, TrendingUp } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface LeaderboardEntry {
  personality: string;
  total_matches: number;
  wins: number;
  win_rate: number;
  avg_accuracy: number;
}

const personalityColors: Record<string, { text: string; border: string; bg: string; badge: string }> = {
  aggressive: { text: 'text-red-400',    border: 'border-red-500/30',    bg: 'bg-red-500/10',    badge: 'bg-red-500/20 text-red-300' },
  defensive:  { text: 'text-blue-400',   border: 'border-blue-500/30',   bg: 'bg-blue-500/10',   badge: 'bg-blue-500/20 text-blue-300' },
  adaptive:   { text: 'text-green-400',  border: 'border-green-500/30',  bg: 'bg-green-500/10',  badge: 'bg-green-500/20 text-green-300' },
  chaotic:    { text: 'text-purple-400', border: 'border-purple-500/30', bg: 'bg-purple-500/10', badge: 'bg-purple-500/20 text-purple-300' },
};

const rankMedals = ['🥇', '🥈', '🥉'];

export default function LeaderboardPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [agentStats, setAgentStats] = useState<Record<string, LeaderboardEntry>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [lbRes, ...statRes] = await Promise.all([
          fetch(`${API_URL}/api/stats/leaderboard`),
          ...['aggressive', 'defensive', 'adaptive', 'chaotic'].map((p) =>
            fetch(`${API_URL}/api/stats/agent/${p}`)
          ),
        ]);

        if (lbRes.ok) {
          const data = await lbRes.json();
          setEntries(data.leaderboard || []);
        }

        const personalities = ['aggressive', 'defensive', 'adaptive', 'chaotic'];
        const stats: Record<string, LeaderboardEntry> = {};
        for (let i = 0; i < statRes.length; i++) {
          if (statRes[i].ok) {
            const d = await statRes[i].json();
            stats[personalities[i]] = d;
          }
        }
        setAgentStats(stats);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const displayEntries =
    entries.length > 0
      ? entries
      : Object.values(agentStats).sort((a, b) => b.win_rate - a.win_rate);

  return (
    <div className="min-h-screen bg-[#050505] relative overflow-hidden text-zinc-300">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]" />
        <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-yellow-900/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-purple-900/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors text-zinc-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight flex items-center gap-3">
                <Trophy className="w-9 h-9 text-yellow-400" />
                Leaderboard
              </h1>
              <p className="text-sm text-zinc-500 mt-1 font-mono uppercase tracking-wider">
                Agent rankings by win rate
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push('/')}
            className="hidden md:flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm font-bold uppercase tracking-widest transition-all text-white"
          >
            New Match
          </button>
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-32 gap-4 text-zinc-500">
            <div className="w-12 h-12 border-2 border-yellow-500/50 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-mono uppercase tracking-widest animate-pulse">
              Loading rankings...
            </span>
          </div>
        )}

        {error && (
          <motion.div
            className="p-8 text-center border border-red-500/20 bg-red-500/5 rounded-2xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p className="text-red-400 font-bold mb-2">Connection Error</p>
            <p className="text-sm text-white/40">{error}</p>
          </motion.div>
        )}

        {!loading && !error && displayEntries.length === 0 && (
          <motion.div
            className="p-12 text-center border border-dashed border-zinc-800 rounded-2xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="w-16 h-16 rounded-full bg-white/5 mx-auto mb-6 flex items-center justify-center border border-white/10">
              <Trophy className="w-8 h-8 text-zinc-700" />
            </div>
            <p className="text-xl font-bold text-zinc-500 mb-2">No rankings yet</p>
            <p className="text-sm text-zinc-700 max-w-sm mx-auto">
              Complete some matches to see agent personality rankings appear here.
            </p>
            <button
              onClick={() => router.push('/')}
              className="mt-6 px-6 py-2.5 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg font-bold uppercase tracking-wide transition-colors"
            >
              Start a Match
            </button>
          </motion.div>
        )}

        {!loading && displayEntries.length > 0 && (
          <div className="space-y-4">
            {/* Top podium for top 3 */}
            {displayEntries.length >= 2 && (
              <div className="grid grid-cols-3 gap-4 mb-8">
                {[displayEntries[1], displayEntries[0], displayEntries[2]]
                  .filter(Boolean)
                  .map((entry, podiumIdx) => {
                    const rank = podiumIdx === 1 ? 0 : podiumIdx === 0 ? 1 : 2;
                    const colors =
                      personalityColors[entry.personality] || personalityColors.chaotic;
                    const heights = ['h-28', 'h-36', 'h-24'];
                    return (
                      <motion.div
                        key={entry.personality}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: podiumIdx * 0.1 }}
                        className={`flex flex-col items-center justify-end rounded-2xl border ${colors.border} ${colors.bg} p-4 ${heights[podiumIdx]}`}
                      >
                        <span className="text-2xl mb-1">{rankMedals[rank]}</span>
                        <p className={`font-bold text-sm capitalize ${colors.text}`}>
                          {entry.personality}
                        </p>
                        <p className="text-xs text-zinc-400 font-mono">
                          {(entry.win_rate * 100).toFixed(0)}% WR
                        </p>
                      </motion.div>
                    );
                  })}
              </div>
            )}

            {/* Full table */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-white/10 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-yellow-400" />
                <h2 className="font-bold text-white text-sm uppercase tracking-wider">
                  Full Rankings
                </h2>
              </div>
              <div className="divide-y divide-white/5">
                {displayEntries.map((entry, i) => {
                  const colors =
                    personalityColors[entry.personality] || personalityColors.chaotic;
                  return (
                    <motion.div
                      key={entry.personality}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-6 px-6 py-4 hover:bg-white/5 transition-colors"
                    >
                      {/* Rank */}
                      <div className="w-8 text-center">
                        {i < 3 ? (
                          <span className="text-lg">{rankMedals[i]}</span>
                        ) : (
                          <span className="text-zinc-600 font-bold font-mono text-sm">
                            #{i + 1}
                          </span>
                        )}
                      </div>

                      {/* Personality */}
                      <div className="flex-1 flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors.bg} border ${colors.border}`}
                        >
                          <Swords className={`w-4 h-4 ${colors.text}`} />
                        </div>
                        <div>
                          <p className={`font-bold capitalize ${colors.text}`}>
                            {entry.personality}
                          </p>
                          <p className="text-xs text-zinc-600 font-mono">
                            {entry.total_matches} matches
                          </p>
                        </div>
                      </div>

                      {/* Win Rate */}
                      <div className="text-right">
                        <p className="font-bold text-white text-lg font-mono">
                          {(entry.win_rate * 100).toFixed(0)}%
                        </p>
                        <p className="text-xs text-zinc-500">win rate</p>
                      </div>

                      {/* Wins */}
                      <div className="text-right w-16">
                        <p className="font-bold text-zinc-300 font-mono">{entry.wins}</p>
                        <p className="text-xs text-zinc-600">wins</p>
                      </div>

                      {/* Accuracy */}
                      <div className="text-right w-20">
                        <div className="flex items-center gap-1.5 justify-end">
                          <Target className={`w-3.5 h-3.5 ${colors.text}`} />
                          <p className="font-mono text-sm text-zinc-300">
                            {(entry.avg_accuracy * 100).toFixed(0)}%
                          </p>
                        </div>
                        <p className="text-xs text-zinc-600">accuracy</p>
                      </div>

                      {/* Win rate bar */}
                      <div className="w-24 hidden md:block">
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${(entry.win_rate * 100).toFixed(0)}%`,
                              background: colors.text.includes('red')
                                ? '#f87171'
                                : colors.text.includes('blue')
                                ? '#60a5fa'
                                : colors.text.includes('green')
                                ? '#4ade80'
                                : '#c084fc',
                            }}
                          />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
