'use client';

import React, {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  maxLife: number;
  size: number;
}

interface ParticleCanvasProps {
  width: number;
  height: number;
}

export interface ParticleCanvasHandle {
  emitBurst: (x: number, y: number, color: string, count?: number) => void;
}

export const ParticleCanvas = forwardRef<
  ParticleCanvasHandle,
  ParticleCanvasProps
>(function ParticleCanvas({ width, height }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);
  const isRunningRef = useRef(false);

  const emitBurst = useCallback(
    (x: number, y: number, color: string, count: number = 25) => {
      const newParticles: Particle[] = [];
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 4;
        const life = 0.8 + Math.random() * 0.7;
        newParticles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1, // Slight upward bias
          color,
          life,
          maxLife: life,
          size: 1.5 + Math.random() * 3,
        });
      }
      particlesRef.current.push(...newParticles);

      if (!isRunningRef.current) {
        isRunningRef.current = true;
        animate();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useImperativeHandle(ref, () => ({ emitBurst }), [emitBurst]);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const particles = particlesRef.current;
    const gravity = 0.08;
    const dt = 1;

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= 0.016; // ~60fps

      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }

      // Physics
      p.vy += gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Slight drag
      p.vx *= 0.98;
      p.vy *= 0.98;

      // Draw
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(p.color, alpha);
      ctx.fill();

      // Glow effect
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha * 2, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(p.color, alpha * 0.2);
      ctx.fill();
    }

    if (particles.length > 0) {
      animFrameRef.current = requestAnimationFrame(animate);
    } else {
      isRunningRef.current = false;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      particlesRef.current = [];
    };
  }, []);

  // Update canvas dimensions
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = width;
      canvas.height = height;
    }
  }, [width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 10,
      }}
    />
  );
});

/**
 * Convert a hex color string to an rgba string with the given alpha.
 */
function hexToRgba(hex: string, alpha: number): string {
  const cleanHex = hex.replace('#', '');
  let r: number, g: number, b: number;

  if (cleanHex.length === 3) {
    r = parseInt(cleanHex[0] + cleanHex[0], 16);
    g = parseInt(cleanHex[1] + cleanHex[1], 16);
    b = parseInt(cleanHex[2] + cleanHex[2], 16);
  } else {
    r = parseInt(cleanHex.substring(0, 2), 16);
    g = parseInt(cleanHex.substring(2, 4), 16);
    b = parseInt(cleanHex.substring(4, 6), 16);
  }

  return `rgba(${r},${g},${b},${alpha})`;
}
