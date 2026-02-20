'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { GPUBiddingGameState, Move, MatchPhase } from '@/lib/types';
import { Cpu, TrendingUp, TrendingDown, DollarSign, Zap, Activity, Server, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface GPUBiddingViewProps {
  state: GPUBiddingGameState;
  currentRound: number;
  totalRounds: number;
  redMove?: Move;
  blueMove?: Move;
  phase: MatchPhase;
}

function DemandMeter({ demand, label }: { demand: number; label: string }) {
  const percentage = Math.round(demand * 100);
  const isHigh = demand > 0.7;
  const isLow = demand < 0.4;
  
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-500">{label}</span>
        <span className={`font-mono ${isHigh ? 'text-orange-400' : isLow ? 'text-emerald-400' : 'text-zinc-400'}`}>
          {percentage}%
        </span>
      </div>
      <div className="h-2 bg-zinc-800/50 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${
            isHigh ? 'bg-gradient-to-r from-orange-500 to-red-500' :
            isLow ? 'bg-gradient-to-r from-emerald-500 to-teal-500' :
            'bg-gradient-to-r from-blue-500 to-indigo-500'
          }`}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

function GPUCard({ gpu, isActive }: { gpu: GPUBiddingGameState['gpuResources'][0]; isActive: boolean }) {
  const priceChange = gpu.currentPrice - gpu.basePrice;
  const priceChangePercent = ((priceChange / gpu.basePrice) * 100).toFixed(1);
  
  return (
    <motion.div
      className={`relative p-3 rounded-lg border ${
        isActive 
          ? 'border-emerald-500/50 bg-emerald-500/10' 
          : 'border-zinc-800 bg-zinc-900/50'
      }`}
      animate={isActive ? { scale: [1, 1.02, 1] } : {}}
      transition={{ duration: 0.5, repeat: isActive ? Infinity : 0, repeatDelay: 1 }}
    >
      {isActive && (
        <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-emerald-500 text-black text-xs font-bold rounded-full">
          BIDDING
        </div>
      )}
      
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Cpu className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-zinc-500'}`} />
          <span className="text-sm font-medium text-zinc-200 truncate">{gpu.name}</span>
        </div>
        {gpu.surgeActive && (
          <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-400 text-[10px] font-bold rounded">
            SURGE
          </span>
        )}
      </div>
      
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-zinc-500">Compute</span>
          <div className="font-mono text-zinc-300">{gpu.computeUnits} units</div>
        </div>
        <div>
          <span className="text-zinc-500">Price</span>
          <div className="flex items-center gap-1">
            <span className="font-mono text-zinc-200">${gpu.currentPrice}</span>
            {priceChange !== 0 && (
              <span className={`text-[10px] ${priceChange > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {priceChange > 0 ? '+' : ''}{priceChangePercent}%
              </span>
            )}
          </div>
        </div>
      </div>
      
      <div className="mt-2">
        <DemandMeter demand={gpu.demandLevel} label="Demand" />
      </div>
    </motion.div>
  );
}

function ProviderComparisonTable({ providers, currentGpuName }: { providers: GPUBiddingGameState['providers']; currentGpuName: string }) {
  const sortedProviders = [...providers].sort((a, b) => {
    const priceA = a.gpuPrices[currentGpuName] || 0;
    const priceB = b.gpuPrices[currentGpuName] || 0;
    return priceA - priceB;
  });
  
  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden">
      <div className="bg-zinc-800/50 px-3 py-2 text-xs font-medium text-zinc-400 flex items-center gap-2">
        <Server className="w-3 h-3" />
        Provider Comparison
      </div>
      <div className="divide-y divide-zinc-800">
        {sortedProviders.map((provider, index) => {
          const price = provider.gpuPrices[currentGpuName] || 0;
          const isCheapest = index === 0;
          
          return (
            <div
              key={provider.name}
              className={`px-3 py-2 flex items-center justify-between ${
                isCheapest ? 'bg-emerald-500/5' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                {isCheapest && (
                  <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded">
                    BEST
                  </span>
                )}
                <span className="text-sm text-zinc-300">{provider.name}</span>
                <span className="text-[10px] text-zinc-500 capitalize">({provider.pricingStyle})</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`font-mono text-sm ${isCheapest ? 'text-emerald-400' : 'text-zinc-300'}`}>
                  ${price}/hr
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatsPanel({ 
  userBudget, 
  userCompute, 
  neocloudRevenue, 
  resourcesSold,
  efficiency 
}: { 
  userBudget: number; 
  userCompute: number; 
  neocloudRevenue: number; 
  resourcesSold: number;
  efficiency: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* User Stats (Red Agent) */}
      <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-rose-500" />
          <span className="text-xs font-medium text-rose-400">USER (Bidder)</span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">Budget</span>
            <span className="font-mono text-sm text-zinc-200">${userBudget.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">Compute</span>
            <span className="font-mono text-sm text-zinc-200">{userCompute.toLocaleString()} units</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">Efficiency</span>
            <span className="font-mono text-sm text-emerald-400">{efficiency.toFixed(2)} u/$</span>
          </div>
        </div>
      </div>
      
      {/* Neocloud Stats (Blue Agent) */}
      <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-xs font-medium text-blue-400">NEOCLOUD (Seller)</span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">Revenue</span>
            <span className="font-mono text-sm text-zinc-200">${neocloudRevenue.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">Resources Sold</span>
            <span className="font-mono text-sm text-zinc-200">{resourcesSold}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">Avg Price</span>
            <span className="font-mono text-sm text-blue-400">
              ${resourcesSold > 0 ? Math.round(neocloudRevenue / resourcesSold) : 0}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MoveDisplay({ move, agent }: { move?: Move; agent: 'red' | 'blue' }) {
  if (!move) return null;
  
  const isUser = agent === 'red';
  const moveType = move.type;
  
  const getMoveBadge = () => {
    if (isUser) {
      switch (moveType) {
        case 'bid': return { label: 'BID', color: 'bg-emerald-500/20 text-emerald-400' };
        case 'surge_bid': return { label: 'SURGE BID', color: 'bg-orange-500/20 text-orange-400' };
        case 'wait': return { label: 'WAIT', color: 'bg-yellow-500/20 text-yellow-400' };
        case 'pass': return { label: 'PASS', color: 'bg-zinc-500/20 text-zinc-400' };
        default: return { label: moveType.toUpperCase(), color: 'bg-zinc-500/20 text-zinc-400' };
      }
    } else {
      switch (moveType) {
        case 'surge_pricing': return { label: 'SURGE', color: 'bg-red-500/20 text-red-400' };
        case 'set_price': return { label: 'SET PRICE', color: 'bg-blue-500/20 text-blue-400' };
        case 'discount': return { label: 'DISCOUNT', color: 'bg-emerald-500/20 text-emerald-400' };
        case 'hold': return { label: 'HOLD', color: 'bg-zinc-500/20 text-zinc-400' };
        default: return { label: moveType.toUpperCase(), color: 'bg-zinc-500/20 text-zinc-400' };
      }
    }
  };
  
  const badge = getMoveBadge();
  
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
      isUser ? 'bg-rose-500/10 border border-rose-500/20' : 'bg-blue-500/10 border border-blue-500/20'
    }`}>
      <span className={`px-2 py-0.5 rounded text-xs font-bold ${badge.color}`}>
        {badge.label}
      </span>
      {move.amount > 0 && (
        <span className="font-mono text-sm text-zinc-300">${move.amount}</span>
      )}
    </div>
  );
}

export function GPUBiddingView({
  state,
  currentRound,
  totalRounds,
  redMove,
  blueMove,
  phase,
}: GPUBiddingViewProps) {
  // Add null safety for initial render before state is populated
  if (!state) {
    return (
      <div className="w-full flex items-center justify-center py-12">
        <div className="flex items-center gap-3 text-zinc-500">
          <Cpu className="w-5 h-5 animate-pulse" />
          <span>Initializing GPU Marketplace...</span>
        </div>
      </div>
    );
  }

  const currentGpu = state.currentGpu;
  const isThinking = phase === 'thinking';
  const marketDemand = state.marketDemand ?? 0.5;
  const userBudget = state.userBudget ?? 10000;
  const userCompute = state.userComputeAcquired ?? 0;
  const neocloudRevenue = state.neocloudRevenue ?? 0;
  const resourcesSold = state.neocloudResourcesSold ?? 0;
  const efficiency = state.userCostEfficiency ?? 0;
  const gpuResources = state.gpuResources ?? [];
  const providers = state.providers ?? [];
  
  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <Cpu className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">GPU Marketplace</h2>
            <p className="text-xs text-zinc-500">Round {currentRound + 1} of {totalRounds}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <DemandMeter demand={marketDemand} label="Market Demand" />
        </div>
      </div>
      
      {/* Stats Panel */}
      <StatsPanel
        userBudget={userBudget}
        userCompute={userCompute}
        neocloudRevenue={neocloudRevenue}
        resourcesSold={resourcesSold}
        efficiency={efficiency}
      />
      
      {/* Current GPU Being Bid On */}
      {currentGpu && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Zap className="w-4 h-4 text-emerald-400" />
            <span>Current Auction</span>
          </div>
          <GPUCard gpu={currentGpu} isActive={true} />
        </div>
      )}
      
      {/* Provider Comparison */}
      {currentGpu && providers.length > 0 && (
        <ProviderComparisonTable 
          providers={providers} 
          currentGpuName={currentGpu.name} 
        />
      )}
      
      {/* Moves Display */}
      <AnimatePresence>
        {(redMove || blueMove) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center gap-6"
          >
            {redMove && <MoveDisplay move={redMove} agent="red" />}
            {blueMove && <MoveDisplay move={blueMove} agent="blue" />}
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Available GPUs Grid */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Activity className="w-4 h-4" />
          <span>Market Overview</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {state.gpuResources.slice(0, 6).map((gpu) => (
            <GPUCard 
              key={gpu.name} 
              gpu={gpu} 
              isActive={currentGpu?.name === gpu.name}
            />
          ))}
        </div>
      </div>
      
      {/* Thinking Indicator */}
      <AnimatePresence>
        {isThinking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center gap-2 py-4"
          >
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 rounded-full bg-emerald-500"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </div>
            <span className="text-sm text-zinc-500">Agents analyzing market...</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
