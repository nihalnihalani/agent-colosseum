'use client';

import React, { useState, useCallback } from 'react';

class SoundManagerClass {
  private ctx: AudioContext | null = null;
  private enabled: boolean = false;
  private thinkingOscillators: OscillatorNode[] = [];
  private thinkingGains: GainNode[] = [];

  init() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (enabled && !this.ctx) {
      this.init();
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private ensureContext(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) this.init();
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Crystallization chime: bright, satisfying major chord arpeggio.
   * Played when a prediction is revealed as correct.
   */
  playCollapseCorrect() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const now = ctx.currentTime;

    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0, now + i * 0.05);
      gain.gain.linearRampToValueAtTime(0.12, now + i * 0.05 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.05);
      osc.stop(now + 1.5);
    });

    // Add shimmer with a high-freq sine sweep
    const shimmer = ctx.createOscillator();
    const shimmerGain = ctx.createGain();
    shimmer.type = 'sine';
    shimmer.frequency.setValueAtTime(2000, now);
    shimmer.frequency.exponentialRampToValueAtTime(4000, now + 0.3);
    shimmerGain.gain.setValueAtTime(0.03, now);
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    shimmer.connect(shimmerGain).connect(ctx.destination);
    shimmer.start(now);
    shimmer.stop(now + 0.8);
  }

  /**
   * Shatter: descending noise burst with dissonant undertone.
   * Played when a prediction is revealed as wrong.
   */
  playCollapseWrong() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Descending sawtooth
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.5);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);

    // Noise burst using buffer
    const bufferSize = ctx.sampleRate * 0.3;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.06, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    // Bandpass filter for crunchier sound
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 800;
    filter.Q.value = 1;

    noise.connect(filter).connect(noiseGain).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.3);
  }

  /**
   * Thinking drone: low pulsing hum that loops.
   * Returns a stop function to end the drone.
   */
  playThinkingStart(): () => void {
    const ctx = this.ensureContext();
    if (!ctx) return () => {};

    const now = ctx.currentTime;

    // Base drone - low sine
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.value = 60;
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.06, now + 0.5);

    // Pulse modulation via LFO
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 2; // 2Hz pulse
    lfoGain.gain.value = 0.03;
    lfo.connect(lfoGain).connect(gain1.gain);

    // Overtone
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.value = 90;
    gain2.gain.setValueAtTime(0, now);
    gain2.gain.linearRampToValueAtTime(0.03, now + 0.5);

    osc1.connect(gain1).connect(ctx.destination);
    osc2.connect(gain2).connect(ctx.destination);
    lfo.start(now);
    osc1.start(now);
    osc2.start(now);

    this.thinkingOscillators = [osc1, osc2, lfo];
    this.thinkingGains = [gain1, gain2];

    return () => {
      const stopTime = ctx.currentTime;
      this.thinkingGains.forEach((g) => {
        g.gain.linearRampToValueAtTime(0.001, stopTime + 0.5);
      });
      setTimeout(() => {
        this.thinkingOscillators.forEach((o) => {
          try {
            o.stop();
          } catch {
            // Already stopped
          }
        });
        this.thinkingOscillators = [];
        this.thinkingGains = [];
      }, 600);
    };
  }

  /**
   * Branch grow: quick pop sound. Higher pitch for higher confidence.
   */
  playBranchGrow(pitch: number = 0.5) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const baseFreq = 400 + pitch * 800; // 400Hz - 1200Hz range

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq * 1.5, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq, now + 0.08);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);

    // Click transient
    const click = ctx.createOscillator();
    const clickGain = ctx.createGain();
    click.type = 'square';
    click.frequency.value = baseFreq * 2;
    clickGain.gain.setValueAtTime(0.05, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    click.connect(clickGain).connect(ctx.destination);
    click.start(now);
    click.stop(now + 0.03);
  }

  /**
   * Round end: mechanical tick sound.
   */
  playRoundEnd() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Metallic tick
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.05);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);

    // Second tick (lower, delayed)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(800, now + 0.08);
    osc2.frequency.exponentialRampToValueAtTime(400, now + 0.13);
    gain2.gain.setValueAtTime(0.06, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc2.connect(gain2).connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.2);
  }

  /**
   * Match end: triumphant fanfare with rising brass-like tones.
   */
  playMatchEnd() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Fanfare chord progression: root -> fifth -> octave
    const fanfareNotes = [
      { freq: 261.63, start: 0, dur: 0.8 },     // C4
      { freq: 329.63, start: 0, dur: 0.8 },      // E4
      { freq: 392.0, start: 0.2, dur: 0.6 },     // G4
      { freq: 523.25, start: 0.4, dur: 0.8 },    // C5
      { freq: 659.25, start: 0.6, dur: 0.6 },    // E5
      { freq: 783.99, start: 0.8, dur: 1.0 },    // G5
      { freq: 1046.5, start: 1.0, dur: 1.2 },    // C6
    ];

    fanfareNotes.forEach(({ freq, start, dur }) => {
      // Main tone (brass-like: combination of triangle and sawtooth)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;

      // Filter to warm it up
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = freq * 3;
      filter.Q.value = 0.5;

      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(0.06, now + start + 0.05);
      gain.gain.setValueAtTime(0.06, now + start + dur * 0.7);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);

      osc.connect(filter).connect(gain).connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur);

      // Sine overtone for richness
      const sine = ctx.createOscillator();
      const sineGain = ctx.createGain();
      sine.type = 'sine';
      sine.frequency.value = freq;
      sineGain.gain.setValueAtTime(0, now + start);
      sineGain.gain.linearRampToValueAtTime(0.04, now + start + 0.05);
      sineGain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
      sine.connect(sineGain).connect(ctx.destination);
      sine.start(now + start);
      sine.stop(now + start + dur);
    });
  }
}

// Singleton instance
const soundManager = new SoundManagerClass();

/**
 * Hook to access the sound manager singleton.
 */
export function useSoundManager() {
  return soundManager;
}

/**
 * Sound toggle button component.
 * Renders a speaker icon in the top-right corner.
 * Sound is OFF by default (browser autoplay policy).
 */
export function SoundToggle() {
  const [enabled, setEnabled] = useState(false);

  const toggle = useCallback(() => {
    const next = !enabled;
    setEnabled(next);
    soundManager.setEnabled(next);
    if (next) {
      soundManager.init();
      // Play a subtle click to confirm sound is on
      soundManager.playBranchGrow(0.3);
    }
  }, [enabled]);

  return (
    <button
      onClick={toggle}
      aria-label={enabled ? 'Mute sound' : 'Unmute sound'}
      style={{
        position: 'fixed',
        top: '16px',
        right: '16px',
        zIndex: 100,
        background: 'rgba(0,0,0,0.5)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: '8px',
        padding: '8px 12px',
        cursor: 'pointer',
        color: enabled ? '#ffffff' : '#64748b',
        fontSize: '18px',
        backdropFilter: 'blur(8px)',
        transition: 'color 0.2s, border-color 0.2s',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        {enabled ? (
          <>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </>
        ) : (
          <>
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </>
        )}
      </svg>
      <span style={{ fontSize: '12px', fontWeight: 500 }}>
        {enabled ? 'ON' : 'OFF'}
      </span>
    </button>
  );
}

export { soundManager, SoundManagerClass };
