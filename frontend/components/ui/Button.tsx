'use client';

import { motion, HTMLMotionProps } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Loader2 } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ButtonProps extends HTMLMotionProps<"button"> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'gradient';
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'icon';
  children: React.ReactNode;
  isLoading?: boolean;
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  children,
  isLoading,
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles = "relative inline-flex items-center justify-center font-display font-bold uppercase tracking-wider transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0B0C15] rounded-xl overflow-hidden group";
  
  const variants = {
    primary: "bg-white text-black hover:bg-zinc-200 shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:shadow-[0_0_30px_rgba(255,255,255,0.25)] border border-transparent",
    gradient: "bg-gradient-to-r from-violet-600 to-cyan-500 text-white shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.4)] border border-white/10 hover:brightness-110",
    secondary: "bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-zinc-700/50 hover:border-zinc-600 shadow-lg",
    outline: "bg-transparent border border-white/10 text-zinc-300 hover:text-white hover:bg-white/5 hover:border-white/20 backdrop-blur-sm",
    ghost: "bg-transparent text-zinc-400 hover:text-white hover:bg-white/5",
    danger: "bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 hover:border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.1)]",
  };

  const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-11 px-5 text-sm",
    lg: "h-14 px-8 text-base",
    xl: "h-16 px-10 text-lg",
    icon: "h-10 w-10 p-0",
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -1 }}
      whileTap={{ scale: 0.98 }}
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      disabled={isLoading || disabled}
      {...props}
    >
      <span className={cn("flex items-center gap-2 relative z-10", isLoading && "opacity-0")}>
        {children}
      </span>
      
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      )}

      {/* Shine effect */}
      {(variant === 'primary' || variant === 'gradient') && (
        <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent z-0 skew-x-12" />
      )}
    </motion.button>
  );
}
