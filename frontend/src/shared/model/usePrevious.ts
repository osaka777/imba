import { useEffect, useRef, useState } from "react";

/**
 * Returns the previous value for coef-flash animations.
 * Keeps `prevState` visible for `holdMs` after each change so CSS animation
 * isn't cut off by the next re-render.
 */
export const usePrevious = <T>(value: T, holdMs = 2100) => {
  const committedRef = useRef<T | undefined>(undefined);
  const [prevState, setPrevState] = useState<T | undefined>(undefined);

  useEffect(() => {
    const committed = committedRef.current;
    if (committed === value) return;

    if (committed !== undefined) {
      setPrevState(committed);
      const timer = setTimeout(() => setPrevState(undefined), holdMs);
      committedRef.current = value;
      return () => clearTimeout(timer);
    }

    committedRef.current = value;
  }, [value, holdMs]);

  return { prevState };
};
