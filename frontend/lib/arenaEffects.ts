/**
 * arenaEffects — lightweight cross-component event bridge.
 *
 * The AI commentator agent calls frontend tools (via useFrontendTool).
 * Those tool handlers dispatch CustomEvents on `window`.
 * Visualization components listen for those events to apply effects.
 */

export type ArenaHighlightDetail = { agent: "red" | "blue"; index: number };
export type ArenaSfxDetail = { sound: "fanfare" | "clash" | "suspense" | "victory" };
export type ArenaAnnounceDetail = { message: string };

export function dispatchHighlight(detail: ArenaHighlightDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ArenaHighlightDetail>("arena:highlight", { detail }));
}

export function dispatchSfx(detail: ArenaSfxDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ArenaSfxDetail>("arena:sfx", { detail }));
}

export function dispatchAnnounce(detail: ArenaAnnounceDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ArenaAnnounceDetail>("arena:announce", { detail }));
}

export function playTone(
  frequency = 440,
  duration = 0.3,
  type: OscillatorType = "sine"
): void {
  if (typeof window === "undefined") return;
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {
    // AudioContext may be blocked before user interaction — silently ignore
  }
}

export const SFX_TONES: Record<ArenaSfxDetail["sound"], () => void> = {
  fanfare:  () => { playTone(523, 0.15); setTimeout(() => playTone(659, 0.15), 150); setTimeout(() => playTone(784, 0.3), 300); },
  clash:    () => { playTone(200, 0.1, "sawtooth"); setTimeout(() => playTone(150, 0.1, "sawtooth"), 80); },
  suspense: () => { playTone(220, 0.5, "triangle"); },
  victory:  () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playTone(f, 0.2), i * 120)); },
};
