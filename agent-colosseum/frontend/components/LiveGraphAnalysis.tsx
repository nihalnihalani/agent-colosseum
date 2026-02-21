'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Activity, TrendingUp, TrendingDown, Network, Brain, Zap } from 'lucide-react';
import type { GraphAnalysisData } from '@/lib/types';
import { cn } from '@/lib/utils';

interface LiveGraphAnalysisProps {
  graphAnalysis?: GraphAnalysisData;
  gameType: string;
}

function AccuracyBar({ label, accuracy, color }: { label: string; accuracy: number; color: 'red' | 'blue' }) {
  const pct = Math.round(accuracy * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[9px] font-mono uppercase tracking-wider">
        <span className={cn(color === 'red' ? 'text-rose-400' : 'text-blue-400')}>{label}</span>
        <span className="text-zinc-400">{pct}%</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          className={cn(
            'h-full rounded-full',
            color === 'red' ? 'bg-gradient-to-r from-rose-600 to-rose-400' : 'bg-gradient-to-r from-blue-600 to-blue-400'
          )}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

function StrategyBadge({ strategy, count }: { strategy: string; count: number }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 border border-white/10">
      <span className="text-[10px] font-mono text-zinc-300 truncate max-w-[80px]">{strategy}</span>
      <span className="text-[9px] text-zinc-500">×{count}</span>
    </div>
  );
}

function MiniGraph({ nodes, links }: { nodes: GraphAnalysisData['graphData']['nodes']; links: GraphAnalysisData['graphData']['links'] }) {
  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-600 text-xs font-mono">
        No graph data yet
      </div>
    );
  }

  const maxVal = Math.max(...nodes.map(n => n.val), 1);
  
  return (
    <div className="relative h-full flex items-center justify-center">
      <div className="flex flex-wrap gap-2 justify-center items-center p-2">
        {nodes.slice(0, 6).map((node) => {
          const size = 24 + (node.val / maxVal) * 24;
          const linkCount = links.filter(l => l.source === node.id || l.target === node.id).length;
          return (
            <motion.div
              key={node.id}
              className={cn(
                'rounded-full flex items-center justify-center border',
                'bg-gradient-to-br from-purple-500/20 to-violet-500/20 border-purple-500/30',
                'shadow-[0_0_10px_rgba(168,85,247,0.15)]'
              )}
              style={{ width: size, height: size }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3, delay: Math.random() * 0.2 }}
              title={`${node.name}: ${node.val} wins, ${linkCount} connections`}
            >
              <span className="text-[8px] font-mono text-purple-300 truncate px-1">
                {node.name.slice(0, 3)}
              </span>
            </motion.div>
          );
        })}
      </div>
      {nodes.length > 6 && (
        <div className="absolute bottom-1 right-1 text-[9px] text-zinc-600 font-mono">
          +{nodes.length - 6} more
        </div>
      )}
    </div>
  );
}

export function LiveGraphAnalysis({ graphAnalysis, gameType }: LiveGraphAnalysisProps) {
  if (!graphAnalysis) {
    return (
      <div className="rounded-xl border border-white/5 bg-[#0a0a0f] p-4">
        <div className="flex items-center gap-2 mb-3">
          <Network className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">Neo4j Analysis</span>
        </div>
        <div className="flex items-center justify-center h-24 text-zinc-600">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-purple-500/30 animate-pulse" />
            <span className="text-xs font-mono">Awaiting match data...</span>
          </div>
        </div>
      </div>
    );
  }

  const { redAnalysis, blueAnalysis, graphData } = graphAnalysis;

  const redAvgAccuracy = redAnalysis.predictionAccuracy.length > 0
    ? redAnalysis.predictionAccuracy.reduce((sum, p) => sum + p.accuracy, 0) / redAnalysis.predictionAccuracy.length
    : 0;
  const blueAvgAccuracy = blueAnalysis.predictionAccuracy.length > 0
    ? blueAnalysis.predictionAccuracy.reduce((sum, p) => sum + p.accuracy, 0) / blueAnalysis.predictionAccuracy.length
    : 0;

  const recentRedStrategies = redAnalysis.strategyEvolution.slice(-5);
  const recentBlueStrategies = blueAnalysis.strategyEvolution.slice(-5);

  const strategyCounts: Record<string, number> = {};
  [...recentRedStrategies, ...recentBlueStrategies].forEach(s => {
    if (s.strategy) {
      strategyCounts[s.strategy] = (strategyCounts[s.strategy] || 0) + 1;
    }
  });

  return (
    <motion.div
      className="rounded-xl border border-white/5 bg-[#0a0a0f] overflow-hidden"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="p-2.5 bg-white/[0.02] border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Network className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">Neo4j Live Analysis</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[9px] text-emerald-400 font-mono">SYNCED</span>
        </div>
      </div>

      <div className="p-3 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
            <Brain className="w-3 h-3" />
            <span>Historical Prediction Accuracy</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <AccuracyBar label="Red Agent" accuracy={redAvgAccuracy} color="red" />
            <AccuracyBar label="Blue Agent" accuracy={blueAvgAccuracy} color="blue" />
          </div>
        </div>

        {gameType === 'negotiation' && (redAnalysis.negotiationPatterns.length > 0 || blueAnalysis.negotiationPatterns.length > 0) && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
              <Activity className="w-3 h-3" />
              <span>Negotiation Patterns</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="space-y-1">
                <span className="text-rose-400 font-mono">Red:</span>
                {redAnalysis.negotiationPatterns.slice(-3).map((p, i) => (
                  <div key={i} className="flex items-center gap-1 text-zinc-400">
                    <span className="text-zinc-600">R{p.round_number}</span>
                    <span>{p.move_type}</span>
                    {p.price > 0 && <span className="text-amber-400">${p.price}</span>}
                  </div>
                ))}
              </div>
              <div className="space-y-1">
                <span className="text-blue-400 font-mono">Blue:</span>
                {blueAnalysis.negotiationPatterns.slice(-3).map((p, i) => (
                  <div key={i} className="flex items-center gap-1 text-zinc-400">
                    <span className="text-zinc-600">R{p.round_number}</span>
                    <span>{p.move_type}</span>
                    {p.price > 0 && <span className="text-amber-400">${p.price}</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
            <Zap className="w-3 h-3" />
            <span>Active Strategies</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(strategyCounts).slice(0, 5).map(([strategy, count]) => (
              <StrategyBadge key={strategy} strategy={strategy} count={count} />
            ))}
            {Object.keys(strategyCounts).length === 0 && (
              <span className="text-[10px] text-zinc-600 font-mono italic">Building strategy history...</span>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
              <Network className="w-3 h-3" />
              <span>Strategy Graph</span>
            </div>
            <span className="text-[9px] text-zinc-600 font-mono">
              {graphData.nodes.length} nodes · {graphData.links.length} edges
            </span>
          </div>
          <div className="h-20 rounded-lg bg-black/30 border border-white/5 overflow-hidden">
            <MiniGraph nodes={graphData.nodes} links={graphData.links} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
