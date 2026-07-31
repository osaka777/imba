"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";

type WcLiveTrackerContextValue = {
  eventRef: null | string;
  meta: { awayTeam: string; homeTeam: string; leagueName?: null | string } | null;
  register: (
    eventRef: string,
    trackerUrl: null | string,
    meta?: { awayTeam: string; homeTeam: string; leagueName?: null | string },
  ) => void;
  trackerUrl: null | string;
  unregister: (eventRef: string) => void;
};

const WcLiveTrackerContext = createContext<WcLiveTrackerContextValue | null>(null);

export function WcLiveTrackerProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [eventRef, setEventRef] = useState<null | string>(null);
  const [trackerUrl, setTrackerUrl] = useState<null | string>(null);
  const [meta, setMeta] = useState<WcLiveTrackerContextValue["meta"]>(null);

  useLayoutEffect(() => {
    setEventRef(null);
    setTrackerUrl(null);
    setMeta(null);
  }, [pathname]);

  const register = useCallback(
    (ref: string, url: null | string, nextMeta?: WcLiveTrackerContextValue["meta"]) => {
      setEventRef(ref);
      setTrackerUrl(url);
      setMeta(nextMeta ?? null);
    },
    [],
  );

  const unregister = useCallback((ref: string) => {
    setEventRef((current) => {
      if (current !== ref) return current;
      setTrackerUrl(null);
      setMeta(null);
      return null;
    });
  }, []);

  const value = useMemo(
    () => ({ eventRef, meta, register, trackerUrl, unregister }),
    [eventRef, trackerUrl, meta, register, unregister],
  );

  return (
    <WcLiveTrackerContext.Provider value={value}>{children}</WcLiveTrackerContext.Provider>
  );
}

export function useWcLiveTrackerContext() {
  return useContext(WcLiveTrackerContext);
}
