'use client';

import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

interface CollapseResult {
  wasCorrect: boolean;
  confidence: number;
}

interface DoubleCollapseProps {
  isActive: boolean;
  redResults: CollapseResult[];
  blueResults: CollapseResult[];
  roundWinner: 'red' | 'blue' | 'draw';
  onComplete: () => void;
}

export function DoubleCollapse({
  isActive,
  redResults,
  blueResults,
  roundWinner,
  onComplete,
}: DoubleCollapseProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const winnerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);

  useEffect(() => {
    if (!isActive) {
      setShowOverlay(false);
      if (timelineRef.current) {
        timelineRef.current.kill();
        timelineRef.current = null;
      }
      return;
    }

    setShowOverlay(true);

    // Wait for DOM render
    const raf = requestAnimationFrame(() => {
      const tl = gsap.timeline({
        onComplete: () => {
          setTimeout(() => {
            setShowOverlay(false);
            onComplete();
          }, 200);
        },
      });
      timelineRef.current = tl;

      // 0.0s: Screen flash (brief white overlay)
      tl.to(
        overlayRef.current,
        { opacity: 0.15, duration: 0.15, ease: 'power1.in' },
        0
      );
      tl.to(
        overlayRef.current,
        { opacity: 0, duration: 0.15, ease: 'power1.out' },
        0.15
      );

      // 0.3s: Wrong predictions dissolve
      tl.to(
        '.prediction-wrong',
        {
          opacity: 0,
          scale: 0.3,
          duration: 0.5,
          stagger: 0.05,
          ease: 'power2.in',
        },
        0.3
      );

      // 0.3s: Correct predictions flash gold
      tl.to(
        '.prediction-correct',
        {
          borderColor: '#ffd700',
          boxShadow: '0 0 30px rgba(255, 215, 0, 0.6)',
          color: '#ffd700',
          duration: 0.5,
          ease: 'power2.out',
        },
        0.3
      );

      // 0.8s: Winner announcement flash
      tl.fromTo(
        winnerRef.current,
        { opacity: 0, scale: 0.5 },
        {
          opacity: 1,
          scale: 1,
          duration: 0.4,
          ease: 'back.out(1.7)',
        },
        0.8
      );

      // 1.2s: Settle
      tl.to(
        winnerRef.current,
        { opacity: 0.8, duration: 0.3, ease: 'power1.out' },
        1.2
      );
    });

    return () => {
      cancelAnimationFrame(raf);
      if (timelineRef.current) {
        timelineRef.current.kill();
        timelineRef.current = null;
      }
    };
  }, [isActive, onComplete]);

  if (!showOverlay && !isActive) return null;

  const winnerLabel =
    roundWinner === 'draw'
      ? 'DRAW'
      : `${roundWinner.toUpperCase()} WINS`;
  const winnerColor =
    roundWinner === 'red'
      ? '#ef4444'
      : roundWinner === 'blue'
        ? '#3b82f6'
        : '#a855f7';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        pointerEvents: isActive ? 'auto' : 'none',
      }}
    >
      {/* Flash overlay */}
      <div
        ref={overlayRef}
        className="collapse-overlay"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: '#ffffff',
          opacity: 0,
          pointerEvents: 'none',
        }}
      />

      {/* Prediction result markers - Red side */}
      <div
        style={{
          position: 'absolute',
          left: '10%',
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {redResults.map((r, i) => (
          <div
            key={`red-${i}`}
            className={r.wasCorrect ? 'prediction-correct' : 'prediction-wrong'}
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              border: `2px solid ${r.wasCorrect ? '#ef4444' : '#ef4444'}`,
              backgroundColor: r.wasCorrect
                ? 'rgba(239,68,68,0.3)'
                : 'rgba(239,68,68,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 'bold',
              fontFamily: 'monospace',
            }}
          >
            {Math.round(r.confidence * 100)}%
          </div>
        ))}
      </div>

      {/* Prediction result markers - Blue side */}
      <div
        style={{
          position: 'absolute',
          right: '10%',
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {blueResults.map((r, i) => (
          <div
            key={`blue-${i}`}
            className={r.wasCorrect ? 'prediction-correct' : 'prediction-wrong'}
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              border: `2px solid ${r.wasCorrect ? '#3b82f6' : '#3b82f6'}`,
              backgroundColor: r.wasCorrect
                ? 'rgba(59,130,246,0.3)'
                : 'rgba(59,130,246,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 'bold',
              fontFamily: 'monospace',
            }}
          >
            {Math.round(r.confidence * 100)}%
          </div>
        ))}
      </div>

      {/* Winner announcement */}
      <div
        ref={winnerRef}
        className="winner-flash"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          opacity: 0,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: '#94a3b8',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            fontFamily: 'monospace',
            marginBottom: '8px',
          }}
        >
          ROUND WINNER
        </div>
        <div
          style={{
            fontSize: '48px',
            fontWeight: 900,
            color: winnerColor,
            textShadow: `0 0 40px ${winnerColor}80, 0 0 80px ${winnerColor}40`,
            letterSpacing: '0.05em',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          {winnerLabel}
        </div>
      </div>
    </div>
  );
}
