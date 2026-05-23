import { useState, useCallback, useRef, useEffect } from 'react';

// Оптимизированный хук для управления состоянием с дебаунсингом
export const useOptimizedState = <T>(
  initialState: T,
  debounceMs: number = 100
) => {
  const [state, setState] = useState<T>(initialState);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestStateRef = useRef<T>(initialState);

  const setOptimizedState = useCallback((newState: T | ((prev: T) => T)) => {
    const actualNewState = typeof newState === 'function' 
      ? (newState as (prev: T) => T)(latestStateRef.current)
      : newState;

    latestStateRef.current = actualNewState;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setState(actualNewState);
    }, debounceMs);
  }, [debounceMs]);

  // Немедленное обновление без дебаунсинга
  const setImmediateState = useCallback((newState: T | ((prev: T) => T)) => {
    const actualNewState = typeof newState === 'function' 
      ? (newState as (prev: T) => T)(latestStateRef.current)
      : newState;

    latestStateRef.current = actualNewState;
    setState(actualNewState);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [state, setOptimizedState, setImmediateState] as const;
};

// Хук для оптимизированного управления булевыми состояниями
export const useOptimizedBoolean = (initialValue: boolean = false) => {
  const [value, setValue] = useState(initialValue);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const setTrue = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setValue(true);
  }, []);

  const setFalse = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setValue(false);
  }, []);

  const setTrueWithDelay = useCallback((delayMs: number) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => setValue(true), delayMs);
  }, []);

  const setFalseWithDelay = useCallback((delayMs: number) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => setValue(false), delayMs);
  }, []);

  const toggle = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setValue(prev => !prev);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    value,
    setValue,
    setTrue,
    setFalse,
    setTrueWithDelay,
    setFalseWithDelay,
    toggle
  };
};

// Хук для оптимизированного управления счетчиками
export const useOptimizedCounter = (initialValue: number = 0) => {
  const [count, setCount] = useState(initialValue);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const increment = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setCount(prev => prev + 1);
  }, []);

  const decrement = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setCount(prev => prev - 1);
  }, []);

  const reset = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setCount(initialValue);
  }, [initialValue]);

  const setCountWithDelay = useCallback((newCount: number, delayMs: number) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => setCount(newCount), delayMs);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    count,
    setCount,
    increment,
    decrement,
    reset,
    setCountWithDelay
  };
}; 