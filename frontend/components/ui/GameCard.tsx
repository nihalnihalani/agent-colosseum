'use client';

import { motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ArrowRight, Sparkles } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface GameCardProps {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  rounds: number;
  isSelected: boolean;
  onClick: () => void;
}

export function GameCard({
  id,
  name,
  description,
  icon,
  rounds,
  isSelected,
  onClick,
}: GameCardProps) {
  return (
    <motion.div
      onClick={onClick}
      className={cn(
        "relative group cursor-pointer p-6 rounded-2xl border transition-all duration-300 overflow-hidden backdrop-blur-sm",
        isSelected 
          ? "bg-gradient-to-br from-violet-500/10 to-cyan-500/10 border-violet-500/30 shadow-[0_0_40px_rgba(139,92,246,0.1)]" 
          : "bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/10 hover:shadow-xl"
      )}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Active Indicator Line */}
      <div className={cn(
        "absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-violet-500 to-cyan-500 transition-opacity duration-300",
        isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-50"
      )} />

      <div className="flex items-start justify-between mb-5 pl-3">
        <div className={cn(
          "p-3 rounded-xl transition-all duration-300 shadow-lg",
          isSelected 
            ? "bg-gradient-to-br from-violet-500 to-cyan-500 text-white shadow-violet-500/20" 
            : "bg-zinc-800/50 text-zinc-400 group-hover:text-white group-hover:bg-zinc-700"
        )}>
          {icon}
        </div>
        
        {isSelected && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="px-2 py-1 rounded-full bg-violet-500/20 border border-violet-500/30 text-[10px] font-bold text-violet-300 uppercase tracking-wider flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3" /> Selected
          </motion.div>
        )}
      </div>

      <div className="space-y-3 pl-3">
        <h3 className={cn(
          "text-xl font-display font-bold uppercase tracking-wide transition-colors",
          isSelected ? "text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-300" : "text-zinc-200 group-hover:text-white"
        )}>
          {name}
        </h3>
        <p className="text-sm text-zinc-500 leading-relaxed line-clamp-2 group-hover:text-zinc-400 transition-colors">
          {description}
        </p>
      </div>

      <div className="mt-6 pl-3 flex items-center justify-between border-t border-white/5 pt-4">
        <div className="text-xs font-mono text-zinc-500 uppercase tracking-wider group-hover:text-zinc-400">
          <span className="text-zinc-300 font-bold">{rounds}</span> Rounds
        </div>
        
        <div className={cn(
          "flex items-center gap-2 text-xs font-bold uppercase tracking-wider transition-all duration-300",
          isSelected ? "text-cyan-400 translate-x-0 opacity-100" : "text-zinc-600 -translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
        )}>
          Deploy <ArrowRight className="w-3 h-3" />
        </div>
      </div>
    </motion.div>
  );
}
