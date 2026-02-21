'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Shield, Sword, Brain, Zap } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface AgentOption {
  value: string;
  label: string;
  description: string;
  type: 'aggressive' | 'defensive' | 'adaptive' | 'chaotic';
}

interface AgentSelectorProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: AgentOption[];
  color: 'red' | 'blue';
}

const icons = {
  aggressive: Sword,
  defensive: Shield,
  adaptive: Brain,
  chaotic: Zap,
};

export function AgentSelector({
  label,
  value,
  onChange,
  options,
  color,
}: AgentSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);
  const SelectedIcon = selectedOption ? icons[selectedOption.type] : Brain;

  const accentColor = color === 'red' ? 'text-rose-400' : 'text-indigo-400';
  const bgColor = color === 'red' ? 'bg-rose-500/10' : 'bg-indigo-500/10';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={containerRef}>
      <label className="block text-[10px] uppercase tracking-wider font-bold mb-2 ml-1 text-zinc-500">
        {label}
      </label>

      <button
        onClick={() => {
          if (!isOpen && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const dropdownHeight = options.length * 52 + 12; // ~52px per option + padding
            const spaceBelow = window.innerHeight - rect.bottom;
            setDropUp(spaceBelow < dropdownHeight);
          }
          setIsOpen(!isOpen);
        }}
        className={cn(
          'w-full flex items-center justify-between p-3 rounded-xl border bg-white/[0.02] transition-all duration-200',
          isOpen ? 'border-white/20 bg-white/[0.05]' : 'border-white/10 hover:border-white/20 hover:bg-white/[0.04]'
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn('p-2 rounded-lg', bgColor)}>
            <SelectedIcon className={cn('w-4 h-4', accentColor)} />
          </div>
          <div className="text-left">
            <div className="font-sans font-medium text-white text-sm">{selectedOption?.label}</div>
            <div className="text-[10px] text-zinc-500 font-mono">{selectedOption?.type.toUpperCase()}</div>
          </div>
        </div>
        <ChevronDown className={cn('w-4 h-4 text-zinc-600 transition-transform duration-200', isOpen && 'rotate-180 text-zinc-400')} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={cn(
              "absolute z-50 w-full p-1.5 rounded-xl bg-[#0a0a0f] border border-white/10 shadow-2xl shadow-black/50",
              dropUp ? "bottom-full mb-2" : "top-full mt-2"
            )}
          >
            <div className="space-y-0.5">
              {options.map((option) => {
                const Icon = icons[option.type];
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 p-2.5 rounded-lg transition-all group/item relative',
                      isSelected ? 'bg-white/10' : 'hover:bg-white/5'
                    )}
                  >
                    <div className={cn(
                      'p-1.5 rounded-md transition-colors',
                      isSelected ? 'bg-white/10 text-white' : 'text-zinc-500 group-hover/item:text-zinc-300'
                    )}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className={cn(
                        'text-sm font-medium transition-colors',
                        isSelected ? 'text-white' : 'text-zinc-400 group-hover/item:text-zinc-200'
                      )}>
                        {option.label}
                      </span>
                      <span className="text-[10px] text-zinc-600 font-mono">
                        {option.description.slice(0, 30)}...
                      </span>
                    </div>
                    {isSelected && (
                      <motion.div
                        layoutId={`selected-${color}`}
                        className={cn('absolute right-2 w-1.5 h-1.5 rounded-full', accentColor.replace('text-', 'bg-'))}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
