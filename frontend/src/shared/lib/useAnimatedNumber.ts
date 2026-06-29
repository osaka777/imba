import { useEffect, useRef, useState } from "react";

export type BalanceAnimDirection = "up" | "down" | "none";

export type AnimatedNumberState = {
  value: number;
  isAnimating: boolean;
  direction: BalanceAnimDirection;
  /** Last stretch — digits crawl to the final value (slot stop). */
  isLanding: boolean;
};

/** Fast spin at first, very slow crawl at the end — like a slot reel stopping. */
function easeCasinoStop(t: number): number {
  if (t >= 1) return 1;
  if (t <= 0) return 0;
  return 1 - 2 ** (-11 * t);
}

/** Win: overshoot slightly then settle — satisfying “cha-ching”. */
function easeCasinoWin(t: number): number {
  if (t >= 1) return 1;
  if (t <= 0) return 0;
  const overshoot = 1.006;
  if (t < 0.88) {
    return easeCasinoStop(t / 0.88) * overshoot;
  }
  const settle = (t - 0.88) / 0.12;
  return overshoot + (1 - overshoot) * (1 - (1 - settle) ** 3);
}

function animationDurationMs(from: number, to: number, direction: BalanceAnimDirection): number {
  const delta = Math.abs(to - from);
  if (delta < 0.000_001) return 0;

  const base = direction === "up" ? 2200 : 1800;
  const scaled = base + Math.sqrt(delta) * 22 + Math.log10(delta + 1) * 280;
  const max = direction === "up" ? 5200 : 4500;
  return Math.min(max, Math.max(base, scaled));
}

const IDLE: AnimatedNumberState = {
  value: 0,
  isAnimating: false,
  direction: "none",
  isLanding: false,
};

/** Casino-style count-up / count-down with reel-stop deceleration. */
export function useAnimatedNumber(target: number): AnimatedNumberState {
  const [state, setState] = useState<AnimatedNumberState>(() => ({
    ...IDLE,
    value: Number.isFinite(target) ? target : 0,
  }));

  const displayRef = useRef(Number.isFinite(target) ? target : 0);
  const frameRef = useRef<number | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!Number.isFinite(target)) return;

    if (!mountedRef.current) {
      mountedRef.current = true;
      displayRef.current = target;
      setState({ value: target, isAnimating: false, direction: "none", isLanding: false });
      return;
    }

    const from = displayRef.current;
    if (Math.abs(from - target) < 0.000_001) return;

    const direction: BalanceAnimDirection = target > from ? "up" : "down";
    const duration = animationDurationMs(from, target, direction);
    const start = performance.now();
    const ease = direction === "up" ? easeCasinoWin : easeCasinoStop;

    setState((prev) => ({
      ...prev,
      isAnimating: true,
      direction,
      isLanding: false,
    }));

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = ease(progress);
      const next = from + (target - from) * eased;
      displayRef.current = next;

      setState({
        value: next,
        isAnimating: progress < 1,
        direction: progress < 1 ? direction : "none",
        isLanding: progress >= 0.72 && progress < 1,
      });

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        displayRef.current = target;
        setState({
          value: target,
          isAnimating: false,
          direction: "none",
          isLanding: false,
        });
      }
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current != null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [target]);

  return state;
}
