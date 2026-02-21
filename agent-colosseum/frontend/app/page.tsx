'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Gavel, Handshake, Swords, History, Cpu, ArrowRight, Activity, Zap, Brain, Shield, Terminal } from 'lucide-react';
import type { AgentConfig, GameType } from '@/lib/types';
import { BentoGrid, BentoGridItem } from '@/components/ui/BentoGrid';
import { Button } from '@/components/ui/Button';
import { AgentSelector } from '@/components/ui/AgentSelector';
import { TubesBackground } from '@/components/ui/neon-flow'; // Import TubesBackground
import { cn } from '@/lib/utils';

const personalities: AgentConfig['personality'][] = [
  'aggressive',
  'defensive',
  'adaptive',
  'chaotic',
];

const personalityDescriptions: Record<AgentConfig['personality'], string> = {
  aggressive: 'High-risk, high-reward. Bluffs often.',
  defensive: 'Conservative. Exploits mistakes.',
  adaptive: 'Mirrors opponent. Adapts over time.',
  chaotic: 'Unpredictable. Maximizes confusion.',
};

const agentOptions = personalities.map(p => ({
  value: p,
  label: p.charAt(0).toUpperCase() + p.slice(1),
  description: personalityDescriptions[p],
  type: p
}));

const gameTypes = [
  {
    id: 'resource_wars',
    title: 'Resource Wars',
    description: 'Compete for strategic resources across multiple fronts. Predict allocations and outmaneuver.',
    header: <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-gradient-to-br from-neutral-900 to-neutral-800" />,
    icon: <Swords className="h-4 w-4 text-neutral-500" />,
    defaultRounds: 10,
  },
  {
    id: 'negotiation',
    title: 'Negotiation',
    description: 'Seller vs buyer. Bluff, propose, counter-offer, and find the deal — or walk away.',
    header: <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-gradient-to-br from-violet-900 to-violet-800" />,
    icon: <Handshake className="h-4 w-4 text-neutral-500" />,
    defaultRounds: 5,
  },
  {
    id: 'auction',
    title: 'Auction',
    description: 'Bid on 8 unique items with hidden valuations. Manage your budget and outbid your rival.',
    header: <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-gradient-to-br from-amber-900 to-amber-800" />,
    icon: <Gavel className="h-4 w-4 text-neutral-500" />,
    defaultRounds: 8,
  },
  {
    id: 'gpu_bidding',
    title: 'GPU Marketplace',
    description: 'Neocloud GPU bidding. User optimizes for cost, Neocloud maximizes revenue. Dynamic surge pricing.',
    header: <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-gradient-to-br from-emerald-900 to-teal-800" />,
    icon: <Cpu className="h-4 w-4 text-neutral-500" />,
    defaultRounds: 10,
  },
];

export default function Home() {
  const router = useRouter();
  const [selectedGame, setSelectedGame] = useState<GameType>('resource_wars');
  const [redPersonality, setRedPersonality] = useState<AgentConfig['personality']>('aggressive');
  const [bluePersonality, setBluePersonality] = useState<AgentConfig['personality']>('defensive');
  const [isStarting, setIsStarting] = useState(false);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'live' | 'mock' | 'offline'>('checking');

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    fetch(`${apiUrl}/health`)
      .then((r) => r.json())
      .then((d) => setBackendStatus(d.mock_mode ? 'mock' : 'live'))
      .catch(() => setBackendStatus('offline'));
  }, []);

  const selectedGameOption = gameTypes.find(g => g.id === selectedGame)!;

  const handleStart = () => {
    setIsStarting(true);
    const matchId = crypto.randomUUID();
    const params = new URLSearchParams({
      matchId,
      gameType: selectedGame,
      red: redPersonality,
      blue: bluePersonality,
      rounds: selectedGameOption.defaultRounds.toString(),
    });
    setTimeout(() => {
      router.push(`/arena?${params.toString()}`);
    }, 800);
  };

  return (
    <div className="min-h-screen w-full bg-black relative overflow-hidden">
      {/* Replaced Spotlight with TubesBackground as the main wrapper/background */}
      <TubesBackground className="absolute inset-0 z-0 bg-black">
         {/* Empty children here because we just want the background effect, content sits on top visually or we wrap it.
             The component supports children but renders them in a pointer-events-none overlay.
             For full interactivity of the page content, we should probably keep the page content separate 
             OR ensure the children div in TubesBackground allows pointer events for its children.
             
             Checking TubesBackground implementation:
             <div className="relative z-10 w-full h-full pointer-events-none">
                {children}
             </div>
             
             It sets pointer-events-none on the wrapper. This effectively disables clicking on buttons if we wrap the whole app.
             So we should use TubesBackground as a background layer, and keep content as a sibling, 
             OR modify TubesBackground to allow pointer events on children.
             
             I will use it as a background layer and keep content in a sibling z-indexed div.
         */}
      </TubesBackground>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 flex flex-col gap-20 pointer-events-auto">
        
        {/* Hero Section */}
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center justify-center gap-3"
          >
             <span className="relative inline-block overflow-hidden rounded-full p-[1px]">
                <span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#E2CBFF_0%,#393BB2_50%,#E2CBFF_100%)]" />
                <div className="inline-flex h-full w-full cursor-pointer items-center justify-center rounded-full bg-slate-950/90 px-3 py-1 text-sm font-medium text-white backdrop-blur-3xl">
                  Agent Colosseum 2026
                </div>
              </span>
              {backendStatus !== 'checking' && (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono border ${
                  backendStatus === 'live'
                    ? 'bg-green-500/10 text-green-400 border-green-500/30'
                    : backendStatus === 'mock'
                    ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                    : 'bg-red-500/10 text-red-400 border-red-500/30'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    backendStatus === 'live' ? 'bg-green-400 animate-pulse'
                    : backendStatus === 'mock' ? 'bg-yellow-400 animate-pulse'
                    : 'bg-red-400'
                  }`} />
                  {backendStatus === 'live' ? 'Live AI' : backendStatus === 'mock' ? 'Mock Mode' : 'Backend Offline'}
                </span>
              )}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl md:text-8xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400 bg-opacity-50 tracking-tight drop-shadow-2xl"
          >
            Adversarial <br /> Intelligence.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-4 font-normal text-base text-neutral-300 max-w-lg text-center mx-auto"
          >
            Evaluate AI agents in high-stakes competitive environments. 
            Select a protocol, configure personalities, and analyze the outcomes in real-time.
          </motion.p>
        </div>

        {/* Configuration Grid */}
        <div className="grid lg:grid-cols-12 gap-8">
           {/* Left: Game Selection (Bento) */}
           <div className="lg:col-span-7 space-y-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Terminal className="w-5 h-5 text-neutral-400" />
                Select Protocol
              </h2>
              <BentoGrid>
                {gameTypes.map((item, i) => (
                  <div key={i} onClick={() => setSelectedGame(item.id as GameType)} className="cursor-pointer">
                    <BentoGridItem
                      title={item.title}
                      description={item.description}
                      header={item.header}
                      icon={item.icon}
                      className={cn(selectedGame === item.id ? "border-violet-500/50 bg-neutral-900/80" : "bg-neutral-900/50")}
                    />
                  </div>
                ))}
              </BentoGrid>
           </div>

           {/* Right: Agent Config */}
           <div className="lg:col-span-5 space-y-6 sticky top-10">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Brain className="w-5 h-5 text-neutral-400" />
                Configure Agents
              </h2>
              
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-6 backdrop-blur-xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-violet-500/5 to-transparent pointer-events-none" />
                
                <div className="space-y-6 relative z-10">
                  <AgentSelector
                    label="Agent Red (Challenger)"
                    value={redPersonality}
                    onChange={(val) => setRedPersonality(val as AgentConfig['personality'])}
                    options={agentOptions}
                    color="red"
                  />
                  
                  <div className="flex items-center justify-center">
                    <div className="h-px w-full bg-neutral-800" />
                    <span className="px-2 text-xs text-neutral-500 font-mono">VS</span>
                    <div className="h-px w-full bg-neutral-800" />
                  </div>

                  <AgentSelector
                    label="Agent Blue (Defender)"
                    value={bluePersonality}
                    onChange={(val) => setBluePersonality(val as AgentConfig['personality'])}
                    options={agentOptions}
                    color="blue"
                  />

                  <Button
                    onClick={handleStart}
                    isLoading={isStarting}
                    className="w-full mt-4 h-12 text-base bg-white text-black hover:bg-neutral-200"
                  >
                    Initialize Simulation <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
           </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-neutral-800 pt-8 pb-20 flex flex-col md:flex-row justify-between items-center text-neutral-500 text-sm backdrop-blur-sm">
           <div>&copy; 2026 Agent Colosseum. All rights reserved.</div>
           <div className="flex items-center gap-6 mt-4 md:mt-0">
             <button onClick={() => router.push('/history')} className="hover:text-white transition-colors">Match History</button>
             <button onClick={() => router.push('/leaderboard')} className="hover:text-white transition-colors">Leaderboard</button>
             <button onClick={() => router.push('/neo4j')} className="hover:text-white transition-colors">Strategy Graph</button>
             <a href="#" className="hover:text-white transition-colors">Docs</a>
             <a href="#" className="hover:text-white transition-colors">GitHub</a>
           </div>
        </footer>

      </div>
    </div>
  );
}
