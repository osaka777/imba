"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

import type { WcEvent, WcEventDetail } from "~/entities/wc-odds/api/client";
import { mergeStatListForEvent } from "~/entities/wc-odds/lib/wcStatsMerge";
import { FEED_API, wcOddsFeedStore } from "~/entities/wc-odds/lib/wcOddsFeedStore";

const EMPTY_EVENTS: WcEvent[] = [];
const NOOP_UNSUB = () => undefined;

function subscribeConnection(listener: () => void) {
  return wcOddsFeedStore.subscribeConnection(listener);
}

function getConnectionSnapshot() {
  return wcOddsFeedStore.connected;
}

export function useWcOddsLineStream(enabled: boolean) {
  const subscribe = useCallback(
    (listener: () => void) => (
      enabled ? wcOddsFeedStore.subscribeLine(listener) : NOOP_UNSUB
    ),
    [enabled],
  );

  const getSnapshot = useCallback(
    () => (enabled ? wcOddsFeedStore.lineEvents : EMPTY_EVENTS),
    [enabled],
  );

  const events = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_EVENTS);

  const connected = useSyncExternalStore(
    subscribeConnection,
    getConnectionSnapshot,
    () => false,
  );

  const setEvents = useCallback((updater: WcEvent[] | ((prev: WcEvent[]) => WcEvent[])) => {
    wcOddsFeedStore.setLineEvents(updater);
  }, []);

  return { events, connected: enabled ? connected : false, setEvents };
}

export function useWcOddsLiveStream(enabled: boolean) {
  const subscribe = useCallback(
    (listener: () => void) => (
      enabled ? wcOddsFeedStore.subscribeLive(listener) : NOOP_UNSUB
    ),
    [enabled],
  );

  const getSnapshot = useCallback(
    () => (enabled ? wcOddsFeedStore.liveEvents : EMPTY_EVENTS),
    [enabled],
  );

  const events = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_EVENTS);

  const connected = useSyncExternalStore(
    subscribeConnection,
    getConnectionSnapshot,
    () => false,
  );

  const setEvents = useCallback((updater: WcEvent[] | ((prev: WcEvent[]) => WcEvent[])) => {
    wcOddsFeedStore.setLiveEvents(updater);
  }, []);

  return { events, connected: enabled ? connected : false, setEvents };
}

export function useWcOddsEventStream(
  ref: string,
  initial?: WcEventDetail | null,
) {
  const seeded = useMemo(() => initial ?? null, [initial]);

  useEffect(() => {
    if (seeded?.statList?.length) {
      mergeStatListForEvent(seeded.id, null, seeded.statList);
    }
  }, [seeded?.id, seeded?.statList]);

  useEffect(() => {
    if (!ref) return;
    if (seeded) {
      wcOddsFeedStore.setEventDetail(ref, seeded);
      // SSR/cache paint is immediate — WS UPD still refreshes in background.
      if (Object.keys(seeded.groupedMarkets ?? {}).length > 0) {
        wcOddsFeedStore.forceEventMarketsReady(ref);
      } else {
        wcOddsFeedStore.markEventMarketsPending(ref);
      }
    } else {
      wcOddsFeedStore.markEventMarketsPending(ref);
    }
  }, [seeded, ref]);

  const subscribe = useCallback(
    (listener: () => void) => (
      ref ? wcOddsFeedStore.subscribeEvent(ref, listener) : NOOP_UNSUB
    ),
    [ref],
  );

  const getSnapshot = useCallback(
    () => wcOddsFeedStore.getEventDetail(ref) ?? seeded ?? null,
    [seeded, ref],
  );

  const event = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => seeded ?? null,
  );

  const connected = useSyncExternalStore(
    subscribeConnection,
    getConnectionSnapshot,
    () => false,
  );

  const marketsReady = useSyncExternalStore(
    subscribe,
    () => (ref ? wcOddsFeedStore.isEventMarketsReady(ref) : true),
    // SSR: unlock when we already have markets in the payload.
    () => Boolean(seeded && Object.keys(seeded.groupedMarkets ?? {}).length > 0),
  );

  const setEvent = useCallback((value: WcEventDetail | null) => {
    wcOddsFeedStore.setEventDetail(ref, value);
  }, [ref]);

  // Safety: never leave the match page gated if WS UPD is delayed/missing.
  useEffect(() => {
    if (!ref || marketsReady) return undefined;
    const timer = window.setTimeout(() => {
      wcOddsFeedStore.forceEventMarketsReady(ref);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [ref, marketsReady]);

  return {
    event,
    connected,
    setEvent,
    marketsReady: Boolean(marketsReady),
  };
}

export { FEED_API };
