"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  isBroadcastAuthed,
  requestBroadcastAuth,
} from "~/entities/wc-odds/lib/wcBroadcastAuth";

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
  /** True after the user explicitly opened the player (survives route changes). */
  userOpened: boolean;
  register: (eventRef: string, hasBroadcast: boolean, meta?: WcBroadcastMeta) => void;
  unregister: () => void;
  /** Clear auto-registered state when leaving a match page — never kills a user-opened player. */
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
  const [eventRef, setEventRef] = useState<string | null>(null);
  const [meta, setMeta] = useState<WcBroadcastMeta | null>(null);
  const [hasBroadcast, setHasBroadcast] = useState(false);
  const [visible, setVisible] = useState(false);
  const [userClosed, setUserClosed] = useState(false);
  const [userOpened, setUserOpened] = useState(false);
  const userOpenedRef = useRef(false);

  const register = useCallback(
    (ref: string, broadcast: boolean, nextMeta?: WcBroadcastMeta) => {
      // Don't steal focus from an already user-opened stream on another event.
      if (userOpenedRef.current && eventRef && eventRef !== ref) {
        return;
      }
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
    [eventRef],
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
    // Match-page unmount must not kill a player the user explicitly opened —
    // they may navigate elsewhere while keeping the stream.
    if (userOpenedRef.current) return;
    setEventRef(null);
    setMeta(null);
    setHasBroadcast(false);
    setUserClosed(false);
    setVisible(false);
    setUserOpened(false);
  }, []);

  const open = useCallback(() => {
    // Guest click must not steal the Live Tracker rail with an auth gate.
    if (!isBroadcastAuthed()) {
      requestBroadcastAuth("login");
      return;
    }
    if (eventRef) clearBroadcastClosed(eventRef);
    userOpenedRef.current = true;
    setUserOpened(true);
    setUserClosed(false);
    setVisible(true);
  }, [eventRef]);

  const openBroadcast = useCallback(
    (ref: string, broadcast: boolean, nextMeta?: WcBroadcastMeta) => {
      if (!broadcast) return;
      // Bind match meta, but only open the video slot when the user can play.
      // Otherwise guests lose the 1win Live Tracker above the coupon.
      setEventRef(ref);
      setMeta(nextMeta ?? null);
      setHasBroadcast(true);
      if (!isBroadcastAuthed()) {
        requestBroadcastAuth("login");
        return;
      }
      clearBroadcastClosed(ref);
      userOpenedRef.current = true;
      setUserOpened(true);
      setUserClosed(false);
      setVisible(true);
    },
    [],
  );

  const close = useCallback(() => {
    userOpenedRef.current = false;
    setUserOpened(false);
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
      userOpened,
      register,
      unregister,
      release,
      open,
      openBroadcast,
      close,
    }),
    [
      eventRef,
      meta,
      hasBroadcast,
      visible,
      userOpened,
      register,
      unregister,
      release,
      open,
      openBroadcast,
      close,
    ],
  );

  return (
    <WcBroadcastContext.Provider value={value}>{children}</WcBroadcastContext.Provider>
  );
}

export function useWcBroadcast() {
  return useContext(WcBroadcastContext);
}
