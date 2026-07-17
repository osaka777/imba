"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";

const CLOSED_KEY_PREFIX = "wc-broadcast-closed:";

export type WcBroadcastMeta = {
  homeTeam: string;
  awayTeam: string;
  leagueName?: string | null;
  homeTeamIcon?: string | null;
  awayTeamIcon?: string | null;
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
  /** Force-clear broadcast state when leaving a match page. */
  release: () => void;
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
  const pathname = usePathname();
  const [eventRef, setEventRef] = useState<string | null>(null);
  const [meta, setMeta] = useState<WcBroadcastMeta | null>(null);
  const [hasBroadcast, setHasBroadcast] = useState(false);
  const [visible, setVisible] = useState(false);
  const [userClosed, setUserClosed] = useState(false);
  const userOpenedRef = useRef(false);

  useLayoutEffect(() => {
    userOpenedRef.current = false;
    setVisible(false);
    setEventRef(null);
    setMeta(null);
    setHasBroadcast(false);
    setUserClosed(false);
  }, [pathname]);

  const register = useCallback(
    (ref: string, broadcast: boolean, nextMeta?: WcBroadcastMeta) => {
      const closed = wasBroadcastClosed(ref) && !userOpenedRef.current;
      setEventRef(ref);
      setMeta(nextMeta ?? null);
      setHasBroadcast(broadcast);
      setUserClosed(closed);
      setVisible((current) => {
        if (!broadcast) {
          if (!userOpenedRef.current) return false;
          return current;
        }
        if (closed) return false;
        if (userOpenedRef.current) return true;
        return current;
      });
    },
    [],
  );

  const unregister = useCallback(() => {
    if (userOpenedRef.current) return;
    setEventRef(null);
    setMeta(null);
    setHasBroadcast(false);
    setUserClosed(false);
    setVisible(false);
  }, []);

  const release = useCallback(() => {
    userOpenedRef.current = false;
    setEventRef(null);
    setMeta(null);
    setHasBroadcast(false);
    setUserClosed(false);
    setVisible(false);
  }, []);

  const open = useCallback(() => {
    if (eventRef) clearBroadcastClosed(eventRef);
    userOpenedRef.current = true;
    setUserClosed(false);
    setVisible(true);
  }, [eventRef]);

  const openBroadcast = useCallback(
    (ref: string, broadcast: boolean, nextMeta?: WcBroadcastMeta) => {
      if (!broadcast) return;
      clearBroadcastClosed(ref);
      userOpenedRef.current = true;
      setEventRef(ref);
      setMeta(nextMeta ?? null);
      setHasBroadcast(true);
      setUserClosed(false);
      setVisible(true);
    },
    [],
  );

  const close = useCallback(() => {
    userOpenedRef.current = false;
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
      release,
      open,
      openBroadcast,
      close,
    }),
    [eventRef, meta, hasBroadcast, visible, register, unregister, release, open, openBroadcast, close],
  );

  return (
    <WcBroadcastContext.Provider value={value}>{children}</WcBroadcastContext.Provider>
  );
}

export function useWcBroadcast() {
  return useContext(WcBroadcastContext);
}
