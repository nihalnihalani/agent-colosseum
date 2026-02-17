'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MatchReplay } from '@/components/MatchReplay';
import type { ReplayEvent } from '@/lib/types';

export default function ReplayPage() {
  const params = useParams();
  const matchId = params.matchId as string;
  const [events, setEvents] = useState<ReplayEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!matchId) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8888';
    fetch(`${apiUrl}/api/match/${matchId}/replay`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load replay');
        return res.json();
      })
      .then((data) => {
        setEvents(data.events || data || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [matchId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-white/40">Loading replay...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <motion.div
          className="glass-panel p-8 text-center max-w-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <p className="text-red-400 mb-2">Replay Error</p>
          <p className="text-white/40 text-sm">{error}</p>
          <p className="text-xs text-white/20 mt-2">Match ID: {matchId}</p>
        </motion.div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <motion.div
          className="glass-panel p-8 text-center max-w-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <p className="text-white/40">No replay events found for this match.</p>
        </motion.div>
      </div>
    );
  }

  return <MatchReplay matchId={matchId} events={events} />;
}
