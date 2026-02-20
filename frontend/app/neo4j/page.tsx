'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Network, TrendingUp, Crosshair, AlertCircle } from 'lucide-react';
import { StrategyGraph3D } from '@/components/viz/StrategyGraph3D';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8888';

interface GraphNode {
  id: string;
  name: string;
  val?: number;
  type?: string;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  type?: string;
  wins?: number;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface WinMatrixRow {
  winner_strategy: string;
  loser_strategy: string;
  wins: number;
}

interface AccuracyRow {
  predicted_move: string;
  total_predictions: number;
  correct: number;
  accuracy: number;
}

interface BluffPattern {
  pattern: string;
  occurrences: number;
}

interface CounterRow {
  counter: string;
  times_used: number;
}

const PERSONALITIES = ['aggressive', 'defensive', 'adaptive', 'chaotic'];
const MOVE_PATTERNS = [
  'aggressive_bid',
  'defensive_hold',
  'balanced_allocation',
  'high_bid',
  'low_bid',
];

export default function Neo4jPage() {
  const router = useRouter();

  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [winMatrix, setWinMatrix] = useState<WinMatrixRow[]>([]);
  const [redAccuracy, setRedAccuracy] = useState<AccuracyRow[]>([]);
  const [blueAccuracy, setBlueAccuracy] = useState<AccuracyRow[]>([]);
  const [redBluffs, setRedBluffs] = useState<BluffPattern[]>([]);
  const [blueBluffs, setBlueBluffs] = useState<BluffPattern[]>([]);
  const [counters, setCounters] = useState<CounterRow[]>([]);
  const [selectedPattern, setSelectedPattern] = useState(MOVE_PATTERNS[0]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  // Fetch all data on mount
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [graphRes, matrixRes, redRes, blueRes] = await Promise.all([
          fetch(`${API_URL}/api/neo4j/graph`),
          fetch(`${API_URL}/api/neo4j/win-matrix`),
          fetch(`${API_URL}/api/neo4j/patterns/red`),
          fetch(`${API_URL}/api/neo4j/patterns/blue`),
        ]);

        if (graphRes.ok) {
          const d = await graphRes.json();
          setGraphData(d);
        }
        if (matrixRes.ok) {
          const d = await matrixRes.json();
          setWinMatrix(d.matrix || []);
        }
        if (redRes.ok) {
          const d = await redRes.json();
          setRedAccuracy(d.prediction_accuracy || []);
          setRedBluffs(d.bluff_patterns || []);
        }
        if (blueRes.ok) {
          const d = await blueRes.json();
          setBlueAccuracy(d.prediction_accuracy || []);
          setBlueBluffs(d.bluff_patterns || []);
        }
      } catch (err) {
        console.error('Failed to load Neo4j data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  // Fetch counter strategies when pattern changes
  useEffect(() => {
    fetch(`${API_URL}/api/neo4j/counter-strategy?pattern=${selectedPattern}`)
      .then((r) => r.json())
      .then((d) => setCounters(d.counters || []))
      .catch(() => setCounters([]));
  }, [selectedPattern]);

  const isEmpty =
    graphData.nodes.length === 0 &&
    winMatrix.length === 0 &&
    redAccuracy.length === 0;

  // Build all-strategies set for the win matrix table
  const allStrategies = Array.from(
    new Set([
      ...winMatrix.map((r) => r.winner_strategy),
      ...winMatrix.map((r) => r.loser_strategy),
      ...PERSONALITIES,
    ])
  );

  const getWins = (winner: string, loser: string) => {
    const row = winMatrix.find(
      (r) => r.winner_strategy === winner && r.loser_strategy === loser
    );
    return row ? row.wins : 0;
  };

  return (
    <div className="min-h-screen bg-[#050505] relative overflow-hidden text-zinc-300">
      {/* Background grid */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]" />
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-purple-900/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-cyan-900/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors text-zinc-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight flex items-center gap-3">
                <Network className="w-8 h-8 text-cyan-400" />
                Neo4j Strategy Graph
              </h1>
              <p className="text-sm text-zinc-500 mt-1 font-mono uppercase tracking-wider">
                Live strategy relationships &amp; analytics
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push('/')}
            className="hidden md:flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm font-bold uppercase tracking-widest transition-all text-white"
          >
            <ArrowLeft className="w-4 h-4" /> Home
          </button>
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-32 text-zinc-500 gap-4">
            <div className="w-12 h-12 border-2 border-cyan-500/50 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-mono uppercase tracking-widest animate-pulse">
              Connecting to Neo4j...
            </span>
          </div>
        )}

        {!loading && isEmpty && (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-6">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
              <AlertCircle className="w-10 h-10 text-zinc-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-zinc-400 mb-2">No graph data yet</p>
              <p className="text-sm text-zinc-600 max-w-md">
                Run some matches to populate the strategy graph. Neo4j records BEATS relationships
                between personality types after each completed match.
              </p>
            </div>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-bold uppercase tracking-wide transition-colors"
            >
              Start a Match
            </button>
          </div>
        )}

        {!loading && (
          <div className="space-y-8">
            {/* Row 1: 3D Graph + Win Matrix */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* 3D Strategy Graph */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
                  <Network className="w-4 h-4 text-cyan-400" />
                  <h2 className="font-bold text-white text-sm uppercase tracking-wider">
                    3D Strategy Graph
                  </h2>
                  <span className="ml-auto text-xs text-zinc-500 font-mono">
                    {graphData.nodes.length} nodes · {graphData.links.length} edges
                  </span>
                </div>
                {graphData.nodes.length === 0 ? (
                  <div className="h-[420px] flex items-center justify-center text-zinc-600 text-sm">
                    No strategy relationships recorded yet
                  </div>
                ) : (
                  <StrategyGraph3D
                    data={graphData}
                    width={600}
                    height={420}
                    onNodeClick={(node) => setSelectedNode(node)}
                  />
                )}
                {selectedNode && (
                  <div className="px-5 py-3 border-t border-white/10 text-xs text-zinc-400 font-mono">
                    Selected: <span className="text-white font-bold">{selectedNode.name}</span>
                    {' '}· wins: <span className="text-cyan-400">{selectedNode.val ?? 0}</span>
                  </div>
                )}
              </div>

              {/* Win Matrix */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-purple-400" />
                  <h2 className="font-bold text-white text-sm uppercase tracking-wider">
                    Win Matrix
                  </h2>
                  <span className="ml-auto text-xs text-zinc-500 font-mono">
                    personality vs personality
                  </span>
                </div>
                <div className="p-5 overflow-x-auto">
                  {winMatrix.length === 0 ? (
                    <p className="text-zinc-600 text-sm text-center py-16">
                      No match data recorded yet
                    </p>
                  ) : (
                    <table className="w-full text-xs font-mono">
                      <thead>
                        <tr>
                          <th className="text-left text-zinc-500 pb-2 pr-3">Winner →</th>
                          {allStrategies.map((s) => (
                            <th key={s} className="text-zinc-400 pb-2 px-2 text-center capitalize">
                              {s.slice(0, 4)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {allStrategies.map((winner) => (
                          <tr key={winner} className="border-t border-white/5">
                            <td className="text-zinc-400 py-2 pr-3 capitalize font-bold">
                              {winner}
                            </td>
                            {allStrategies.map((loser) => {
                              const wins = getWins(winner, loser);
                              return (
                                <td key={loser} className="text-center py-2 px-2">
                                  {winner === loser ? (
                                    <span className="text-zinc-700">—</span>
                                  ) : wins > 0 ? (
                                    <span
                                      className="px-2 py-0.5 rounded font-bold"
                                      style={{
                                        background: `rgba(255,107,107,${Math.min(wins / 10, 0.6)})`,
                                        color: '#ff6b6b',
                                      }}
                                    >
                                      {wins}
                                    </span>
                                  ) : (
                                    <span className="text-zinc-700">0</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>

            {/* Row 2: Prediction Accuracy + Counter Strategies */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Prediction Accuracy */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-white/10">
                  <h2 className="font-bold text-white text-sm uppercase tracking-wider">
                    Prediction Accuracy
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">Breakdown by predicted move type</p>
                </div>
                <div className="p-5 space-y-4">
                  {redAccuracy.length === 0 && blueAccuracy.length === 0 ? (
                    <p className="text-zinc-600 text-sm text-center py-10">
                      No prediction data recorded yet
                    </p>
                  ) : (
                    <>
                      <AccuracyTable label="Agent Red" rows={redAccuracy} color="#ff6b6b" />
                      <AccuracyTable label="Agent Blue" rows={blueAccuracy} color="#00CED1" />
                    </>
                  )}
                </div>
              </div>

              {/* Counter Strategies */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3">
                  <Crosshair className="w-4 h-4 text-red-400" />
                  <h2 className="font-bold text-white text-sm uppercase tracking-wider">
                    Counter Strategies
                  </h2>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="text-xs text-zinc-500 uppercase font-mono mb-1.5 block">
                      Opponent opens with
                    </label>
                    <select
                      value={selectedPattern}
                      onChange={(e) => setSelectedPattern(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-cyan-500/50"
                    >
                      {MOVE_PATTERNS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                  {counters.length === 0 ? (
                    <p className="text-zinc-600 text-sm text-center py-8">
                      No counter data for this pattern
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {counters.map((c, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-white/5 border border-white/5"
                        >
                          <span className="text-sm font-mono text-white capitalize">{c.counter}</span>
                          <span className="text-xs text-zinc-400 font-mono">
                            used {c.times_used}×
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Row 3: Bluff Patterns */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-white/10">
                <h2 className="font-bold text-white text-sm uppercase tracking-wider">
                  Bluff Patterns
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">3-move sequences detected in match history</p>
              </div>
              <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/5">
                <BluffPanel label="Agent Red" patterns={redBluffs} color="#ff6b6b" />
                <BluffPanel label="Agent Blue" patterns={blueBluffs} color="#00CED1" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AccuracyTable({
  label,
  rows,
  color,
}: {
  label: string;
  rows: Array<{ predicted_move: string; total_predictions: number; correct: number; accuracy: number }>;
  color: string;
}) {
  if (rows.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-bold mb-2" style={{ color }}>
        {label}
      </p>
      <div className="space-y-1.5">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="text-xs text-zinc-400 font-mono w-32 truncate">{r.predicted_move}</span>
            <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${(r.accuracy * 100).toFixed(0)}%`, background: color }}
              />
            </div>
            <span className="text-xs font-mono text-zinc-300 w-10 text-right">
              {(r.accuracy * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BluffPanel({
  label,
  patterns,
  color,
}: {
  label: string;
  patterns: BluffPattern[];
  color: string;
}) {
  return (
    <div className="p-5">
      <p className="text-xs font-bold mb-3" style={{ color }}>
        {label}
      </p>
      {patterns.length === 0 ? (
        <p className="text-zinc-700 text-xs font-mono">No patterns detected yet</p>
      ) : (
        <div className="space-y-2">
          {patterns.map((p, i) => (
            <div
              key={i}
              className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/5"
            >
              <span className="text-xs font-mono text-zinc-300">{p.pattern}</span>
              <span
                className="text-xs font-bold font-mono px-2 py-0.5 rounded"
                style={{ color, background: `${color}20` }}
              >
                {p.occurrences}×
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
