"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const CLOSED_KEY_PREFIX = "wc-broadcast-closed:";

export type WcBroadcastMeta = {
  homeTeam: string;
  awayTeam: string;
  leagueName?: string | null;
};

function wasBroadcastClosed(ref: string) {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(`${CLOSED_KEY_PREFIX}${ref}`) === "1";
}

function markBroadcastClosed(ref: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(`${CLOSED_KEY_PREFIX}${ref}`, "1");
}

function clearBroadcastClosed(ref: string) {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(`${CLOSED_KEY_PREFIX}${ref}`);
}

type WcBroadcastContextValue = {
  eventRef: string | null;
  meta: WcBroadcastMeta | null;
  hasBroadcast: boolean;
  visible: boolean;
  register: (eventRef: string, hasBroadcast: boolean, meta?: WcBroadcastMeta) => void;
  unregister: () => void;
  open: () => void;
  /** Atomically bind event + show player (mobile-safe). */
  openBroadcast: (
    eventRef: string,
    hasBroadcast: boolean,
    meta?: WcBroadcastMeta,
  ) => void;
  close: () => void;
};

const WcBroadcastContext = createContext<WcBroadcastContextValue | null>(null);

export function WcBroadcastProvider({ children }: { children: React.ReactNode }) {
  const [eventRef, setEventRef] = useState<string | null>(null);
  const [meta, setMeta] = useState<WcBroadcastMeta | null>(null);
  const [hasBroadcast, setHasBroadcast] = useState(false);
  const [visible, setVisible] = useState(false);
  const [userClosed, setUserClosed] = useState(false);

  const register = useCallback(
    (ref: string, broadcast: boolean, nextMeta?: WcBroadcastMeta) => {
      const closed = wasBroadcastClosed(ref);
      setEventRef(ref);
      setMeta(nextMeta ?? null);
      setHasBroadcast(broadcast);
      setUserClosed(closed);
      setVisible((current) => {
        if (!broadcast || closed) return false;
        // Open only via explicit user action (scoreboard / list icon), not on page load.
        return current;
      });
    },
    [],
  );

  const unregister = useCallback(() => {
    setEventRef(null);
    setMeta(null);
    setHasBroadcast(false);
    setVisible(false);
    setUserClosed(false);
  }, []);

  const open = useCallback(() => {
    if (eventRef) clearBroadcastClosed(eventRef);
    setUserClosed(false);
    setVisible(true);
  }, [eventRef]);

  const openBroadcast = useCallback(
    (ref: string, broadcast: boolean, nextMeta?: WcBroadcastMeta) => {
      if (!broadcast) return;
      clearBroadcastClosed(ref);
      setEventRef(ref);
      setMeta(nextMeta ?? null);
      setHasBroadcast(true);
      setUserClosed(false);
      setVisible(true);
    },
    [],
  );

  const close = useCallback(() => {
    if (eventRef) markBroadcastClosed(eventRef);
    setUserClosed(true);
    setVisible(false);
  }, [eventRef]);

  const value = useMemo(
    () => ({
      eventRef,
      meta,
      hasBroadcast,
      visible,
      register,
      unregister,
      open,
      openBroadcast,
      close,
    }),
    [eventRef, meta, hasBroadcast, visible, register, unregister, open, openBroadcast, close],
  );

  return (
    <WcBroadcastContext.Provider value={value}>{children}</WcBroadcastContext.Provider>
  );
}

export function useWcBroadcast() {
  return useContext(WcBroadcastContext);
}
