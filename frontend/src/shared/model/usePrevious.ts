import { useEffect, useRef } from "react";

export const usePrevious = <T>(value: T, debounceMs: number = 500) => {
  const ref = useRef<T>();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    const now = Date.now();
    
    // Если прошло меньше времени чем debounceMs, откладываем обновление
    if (now - lastUpdateRef.current < debounceMs) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        ref.current = value;
        lastUpdateRef.current = Date.now();
      }, debounceMs - (now - lastUpdateRef.current));
    } else {
      // Немедленное обновление если прошло достаточно времени
      ref.current = value;
      lastUpdateRef.current = now;
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, debounceMs]);

  return { prevState: ref.current };
};
