"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

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

export function useWcOddsEventStream(ref: string, initial?: WcEventDetail | null) {
  useEffect(() => {
    if (initial?.statList?.length) {
      mergeStatListForEvent(initial.id, null, initial.statList);
    }
  }, [initial?.id, initial?.statList]);

  useEffect(() => {
    if (initial) wcOddsFeedStore.setEventDetail(ref, initial);
  }, [initial, ref]);

  const subscribe = useCallback(
    (listener: () => void) => (
      ref ? wcOddsFeedStore.subscribeEvent(ref, listener) : NOOP_UNSUB
    ),
    [ref],
  );

  const getSnapshot = useCallback(
    () => wcOddsFeedStore.getEventDetail(ref) ?? initial ?? null,
    [initial, ref],
  );

  const event = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => initial ?? null,
  );

  const connected = useSyncExternalStore(
    subscribeConnection,
    getConnectionSnapshot,
    () => false,
  );

  const setEvent = useCallback((value: WcEventDetail | null) => {
    wcOddsFeedStore.setEventDetail(ref, value);
  }, [ref]);

  return { event, connected, setEvent };
}

export { FEED_API };
