import { useEffect, useRef, useState } from "react";

export type FlashDirection = "up" | "down" | "neutral";

export function useFlashOnChange(
  value: string | number | null | undefined,
): FlashDirection | null {
  const prev = useRef<string | null>(null);
  const [flash, setFlash] = useState<FlashDirection | null>(null);

  useEffect(() => {
    const next = value == null ? "" : String(value);
    if (prev.current === null) {
      prev.current = next;
      return;
    }
    if (prev.current === next) return;

    const prevNum = Number.parseFloat(prev.current);
    const nextNum = Number.parseFloat(next);
    let dir: FlashDirection = "neutral";
    if (Number.isFinite(prevNum) && Number.isFinite(nextNum)) {
      if (nextNum > prevNum) dir = "up";
      else if (nextNum < prevNum) dir = "down";
    }
    prev.current = next;
    setFlash(dir);
    const timer = window.setTimeout(() => setFlash(null), 1200);
    return () => window.clearTimeout(timer);
  }, [value]);

  return flash;
}
