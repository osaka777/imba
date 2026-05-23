import { useEffect, useState, useCallback, useRef } from "react";

export const useWindowSize = (debounceMs: number = 100) => {
  const [width, setWidth] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 0);
  const [height, setHeight] = useState<number>(typeof window !== 'undefined' ? window.innerHeight : 0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleResize = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setWidth(window.innerWidth);
      setHeight(window.innerHeight);
    }, debounceMs);
  }, [debounceMs]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [handleResize]);

  return { height, width };
};
