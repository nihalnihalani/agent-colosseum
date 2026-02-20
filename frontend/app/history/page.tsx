'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Swords, Handshake, Gavel, Calendar, ArrowRight, ArrowLeft } from 'lucide-react';
import type { MatchSummary } from '@/lib/types';
import { clsx } from 'clsx';

const gameIcons: Record<string, React.ReactNode> = {
  resource_wars: <Swords className="w-5 h-5 text-purple-400" />,
  negotiation: <Handshake className="w-5 h-5 text-green-400" />,
  auction: <Gavel className="w-5 h-5 text-yellow-400" />,
};

export default function HistoryPage() {
  const router = useRouter();
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8888';
    fetch(`${apiUrl}/api/matches`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load matches');
        return res.json();
      })
      .then((data) => {
        setMatches(data.matches || data || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] relative overflow-hidden text-zinc-300">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]" />
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-purple-900/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-12">
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
              <h1 className="text-4xl md:text-5xl font-display font-black text-white uppercase tracking-wide text-glow">
                Match History
              </h1>
              <p className="text-sm text-zinc-500 mt-2 font-mono uppercase tracking-wider">
                Digital Colosseum Archives
              </p>
            </div>
          </div>
          
          <button
            onClick={() => router.push('/')}
            className="hidden md:flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm font-bold uppercase tracking-widest transition-all hover:scale-105 active:scale-95 text-white"
          >
            New Simulation
          </button>
        </div>

        {/* Content */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-32 text-zinc-500 gap-4">
            <div className="w-12 h-12 border-2 border-purple-500/50 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-mono uppercase tracking-widest animate-pulse">Accessing Archives...</span>
          </div>
        )}

        {error && (
          <motion.div
            className="glass-panel p-8 text-center border-red-500/20 bg-red-500/5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p className="text-red-400 font-bold mb-2">Connection Error</p>
            <p className="text-sm text-white/40 mb-4">{error}</p>
            <p className="text-xs text-white/20 font-mono">
              Ensure the backend service is operational.
            </p>
          </motion.div>
        )}

        {!loading && !error && matches.length === 0 && (
          <motion.div
            className="glass-panel p-12 text-center border-dashed border-zinc-800"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="w-16 h-16 rounded-full bg-white/5 mx-auto mb-6 flex items-center justify-center">
              <Swords className="w-8 h-8 text-white/20" />
            </div>
            <p className="text-white/40 mb-6 font-display text-xl uppercase tracking-widest">No archival data found</p>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold uppercase tracking-wide transition-colors"
            >
              Initiate First Protocol
            </button>
          </motion.div>
        )}

        <div className="grid gap-4">
          {matches.map((match, i) => (
            <motion.button
              key={match.matchId}
              onClick={() => router.push(`/replay/${match.matchId}`)} // Assuming replay page exists or fallback to just showing details
              className="w-full glass-panel p-5 text-left transition-all hover:border-purple-500/30 hover:bg-white/5 group relative overflow-hidden"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-purple-500 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                
                {/* Game Info */}
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5 group-hover:bg-purple-500/10 group-hover:border-purple-500/20 transition-colors">
                    {gameIcons[match.gameType] || <Swords className="w-5 h-5 text-zinc-400" />}
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-lg text-white group-hover:text-purple-300 transition-colors">
                      {match.gameType.replace('_', ' ').toUpperCase()}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-zinc-500 mt-1 font-mono uppercase">
                      <span>{match.totalRounds} Rounds</span>
                      <span>&bull;</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {match.createdAt ? new Date(match.createdAt).toLocaleDateString() : 'Unknown Date'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Matchup */}
                <div className="flex items-center gap-6 bg-black/20 px-6 py-3 rounded-lg border border-white/5">
                  <div className="text-center">
                    <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Agent Red</p>
                    <div className={clsx("font-display font-bold text-xl", match.winner === 'red' ? "text-red-400" : "text-zinc-400")}>
                      {match.finalScores?.red ?? '-'}
                    </div>
                    <p className="text-[10px] text-zinc-600 uppercase">{match.redPersonality}</p>
                  </div>

                  <div className="flex flex-col items-center">
                    <span className="text-xs font-display font-bold text-zinc-700 italic">VS</span>
                  </div>

                  <div className="text-center">
                    <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Agent Blue</p>
                    <div className={clsx("font-display font-bold text-xl", match.winner === 'blue' ? "text-blue-400" : "text-zinc-400")}>
                      {match.finalScores?.blue ?? '-'}
                    </div>
                    <p className="text-[10px] text-zinc-600 uppercase">{match.bluePersonality}</p>
                  </div>
                </div>

                {/* Status/Action */}
                <div className="flex items-center gap-4">
                   <div className={clsx(
                     "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border",
                     match.state === 'finished' 
                       ? "bg-green-500/10 text-green-400 border-green-500/20" 
                       : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                   )}>
                     {match.state === 'finished' ? 'Concluded' : 'In Progress'}
                   </div>
                   <ArrowRight className="w-5 h-5 text-zinc-600 group-hover:text-white transition-colors group-hover:translate-x-1 duration-300" />
                </div>

              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
