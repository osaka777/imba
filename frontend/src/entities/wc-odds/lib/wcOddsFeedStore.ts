"use client";

import type { WcEvent, WcEventDetail } from "~/entities/wc-odds/api/client";
import { mergeWcEventDetail } from "~/entities/wc-odds/lib/wcEventDetail";
import { FEED_API, SYNC_WS_PATH, SyncMsg } from "~/entities/wc-odds/lib/feedSync.protocol";
import { getFeedToken } from "~/entities/wc-odds/lib/feedSession";
import { mergeWcFeedDelta, mergeWcListSnapshot, mergeWcLiveEvents } from "~/entities/wc-odds/lib/wcLineEvents";

type Listener = () => void;

/** WS always carries RU DB labels — strip so HTTP-localized names are not overwritten. */
function stripDisplayLabels<T extends Partial<Pick<WcEvent, "homeTeam" | "awayTeam" | "leagueName">>>(
  events: T[],
): T[] {
  return events.map((event) => {
    const { homeTeam: _h, awayTeam: _a, leagueName: _l, ...rest } = event;
    return rest as T;
  });
}

function stripDetailLabels(detail: WcEventDetail): WcEventDetail {
  const { homeTeam: _h, awayTeam: _a, leagueName: _l, ...rest } = detail;
  return {
    ...rest,
    homeTeam: "",
    awayTeam: "",
    leagueName: "",
  } as WcEventDetail;
}

type ListFeedMsg = {
  type: typeof SyncMsg.SNAP_LINE | typeof SyncMsg.UPD_LINE | typeof SyncMsg.HB_LINE
    | typeof SyncMsg.SNAP_LIVE | typeof SyncMsg.UPD_LIVE | typeof SyncMsg.HB_LIVE;
  payload?: WcEvent[];
  rm?: string[];
};

type EventFeedMsg = {
  type: typeof SyncMsg.SNAP_EVENT | typeof SyncMsg.UPD_EVENT | typeof SyncMsg.HB_EVENT;
  ref: string;
  payload?: WcEventDetail;
};

const RECONNECT_BASE_MS = 500;
const RECONNECT_MAX_MS = 30_000;
const PING_INTERVAL_MS = 25_000;
const PONG_TIMEOUT_MS = 10_000;

function wsUrl(): string | null {
  if (typeof window === "undefined") return null;
  const token = getFeedToken();
  const withToken = (base: string) => {
    if (!token) return base;
    const join = base.includes("?") ? "&" : "?";
    return `${base}${join}ft=${encodeURIComponent(token)}`;
  };
  if (process.env.NEXT_PUBLIC_SYNC_WS_URL) {
    return withToken(process.env.NEXT_PUBLIC_SYNC_WS_URL);
  }
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return withToken(`${protocol}//${window.location.host}${SYNC_WS_PATH}`);
}

class WcOddsFeedStore {
  private socket: WebSocket | null = null;
  private closed = true;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;

  private lineSubs = 0;
  private liveSubs = 0;
  private readonly eventSubs = new Map<string, number>();
  private readonly eventDetails = new Map<string, WcEventDetail>();
  /** False until first UPD_EVENT after SUB — avoids painting cold SSR markets. */
  private readonly eventMarketsReady = new Map<string, boolean>();

  private readonly lineListeners = new Set<Listener>();
  private readonly liveListeners = new Set<Listener>();
  private readonly eventListeners = new Map<string, Set<Listener>>();
  private readonly connectionListeners = new Set<Listener>();

  lineEvents: WcEvent[] = [];
  liveEvents: WcEvent[] = [];
  connected = false;

  private notify(listeners: Set<Listener>) {
    for (const listener of listeners) listener();
  }

  private notifyConnection() {
    this.notify(this.connectionListeners);
  }

  subscribeConnection(listener: Listener): () => void {
    this.connectionListeners.add(listener);
    return () => this.connectionListeners.delete(listener);
  }

  subscribeLine(listener: Listener): () => void {
    this.lineListeners.add(listener);
    this.lineSubs += 1;
    this.ensureConnected();
    this.sendSub(SyncMsg.SUB_LINE);
    return () => {
      this.lineListeners.delete(listener);
      this.lineSubs = Math.max(0, this.lineSubs - 1);
      if (this.lineSubs === 0) this.sendSub(SyncMsg.UNSUB_LINE);
      this.maybeClose();
    };
  }

  subscribeLive(listener: Listener): () => void {
    this.liveListeners.add(listener);
    this.liveSubs += 1;
    this.ensureConnected();
    this.sendSub(SyncMsg.SUB_LIVE);
    return () => {
      this.liveListeners.delete(listener);
      this.liveSubs = Math.max(0, this.liveSubs - 1);
      if (this.liveSubs === 0) this.sendSub(SyncMsg.UNSUB_LIVE);
      this.maybeClose();
    };
  }

  subscribeEvent(ref: string, listener: Listener): () => void {
    const listeners = this.eventListeners.get(ref) ?? new Set<Listener>();
    listeners.add(listener);
    this.eventListeners.set(ref, listeners);
    const prevSubs = this.eventSubs.get(ref) ?? 0;
    this.eventSubs.set(ref, prevSubs + 1);
    if (prevSubs === 0) {
      const existing = this.eventDetails.get(ref);
      const hasMarkets = Boolean(
        existing && Object.keys(existing.groupedMarkets ?? {}).length > 0,
      );
      // Do not blank an already-seeded SSR/cache paint on subscribe.
      if (!hasMarkets && this.eventMarketsReady.get(ref) !== true) {
        this.eventMarketsReady.set(ref, false);
      }
    }
    this.ensureConnected();
    this.sendSub(SyncMsg.SUB_EVENT, ref);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.eventListeners.delete(ref);
      const next = Math.max(0, (this.eventSubs.get(ref) ?? 1) - 1);
      if (next === 0) {
        this.eventSubs.delete(ref);
        this.sendSub(SyncMsg.UNSUB_EVENT, ref);
      } else {
        this.eventSubs.set(ref, next);
      }
      this.maybeClose();
    };
  }

  getEventDetail(ref: string): WcEventDetail | null {
    return this.eventDetails.get(ref) ?? null;
  }

  findListEvent(ref: string): WcEvent | null {
    if (!ref) return null;
    const match = (event: WcEvent) =>
      event.slug === ref || event.id === ref || event.id.endsWith(ref) || event.slug?.endsWith(ref);
    return this.liveEvents.find(match) ?? this.lineEvents.find(match) ?? null;
  }

  markEventMarketsPending(ref: string): void {
    if (!ref) return;
    this.eventMarketsReady.set(ref, false);
    const listeners = this.eventListeners.get(ref);
    if (listeners) this.notify(listeners);
  }

  isEventMarketsReady(ref: string): boolean {
    return this.eventMarketsReady.get(ref) === true;
  }

  private markEventMarketsReady(ref: string): void {
    if (this.eventMarketsReady.get(ref) === true) return;
    this.eventMarketsReady.set(ref, true);
    const listeners = this.eventListeners.get(ref);
    if (listeners) this.notify(listeners);
  }

  /** Safety valve when WS UPD is delayed / polling-only. */
  forceEventMarketsReady(ref: string): void {
    this.markEventMarketsReady(ref);
  }

  setLineEvents(updater: WcEvent[] | ((prev: WcEvent[]) => WcEvent[])) {
    this.lineEvents = typeof updater === "function" ? updater(this.lineEvents) : updater;
    this.notify(this.lineListeners);
  }

  setLiveEvents(updater: WcEvent[] | ((prev: WcEvent[]) => WcEvent[])) {
    this.liveEvents = typeof updater === "function" ? updater(this.liveEvents) : updater;
    this.notify(this.liveListeners);
  }

  setEventDetail(ref: string, detail: WcEventDetail | null) {
    if (detail) this.eventDetails.set(ref, detail);
    else this.eventDetails.delete(ref);
    const listeners = this.eventListeners.get(ref);
    if (listeners) this.notify(listeners);
  }

  private clearTimers() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    this.clearPongTimer();
  }

  private clearPongTimer() {
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }

  private ensureConnected() {
    if (this.socket?.readyState === WebSocket.OPEN || this.socket?.readyState === WebSocket.CONNECTING) {
      return;
    }
    this.closed = false;
    this.connect();
  }

  private maybeClose() {
    if (this.lineSubs > 0 || this.liveSubs > 0 || this.eventSubs.size > 0) return;
    this.closed = true;
    this.clearTimers();
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.close();
    this.socket = null;
    if (this.connected) {
      this.connected = false;
      this.notifyConnection();
    }
  }

  private sendSub(type: string, ref?: string) {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(ref ? { type, ref } : { type }));
  }

  private scheduleReconnect() {
    if (this.closed) return;
    const delay = Math.min(
      RECONNECT_BASE_MS * 2 ** this.reconnectAttempt,
      RECONNECT_MAX_MS,
    ) + Math.random() * 200;
    this.reconnectAttempt += 1;
    this.retryTimer = setTimeout(() => this.connect(), delay);
  }

  private startPing() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = setInterval(() => {
      if (this.socket?.readyState !== WebSocket.OPEN) return;
      this.socket.send(JSON.stringify({ type: SyncMsg.PING }));
      this.clearPongTimer();
      this.pongTimer = setTimeout(() => {
        this.socket?.close(4000, "pong timeout");
      }, PONG_TIMEOUT_MS);
    }, PING_INTERVAL_MS);
  }

  private connect() {
    const url = wsUrl();
    if (!url || this.closed) return;

    const socket = new WebSocket(url);
    this.socket = socket;

    socket.onopen = () => {
      this.reconnectAttempt = 0;
      this.connected = true;
      this.notifyConnection();
      if (this.lineSubs > 0) this.sendSub(SyncMsg.SUB_LINE);
      if (this.liveSubs > 0) this.sendSub(SyncMsg.SUB_LIVE);
      for (const ref of this.eventSubs.keys()) this.sendSub(SyncMsg.SUB_EVENT, ref);
      this.startPing();
    };

    socket.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as ListFeedMsg | EventFeedMsg | { type: string };
        this.handleMessage(msg);
      } catch {
        // ignore malformed frames
      }
    };

    socket.onclose = () => {
      this.clearTimers();
      this.socket = null;
      const wasConnected = this.connected;
      this.connected = false;
      if (wasConnected) this.notifyConnection();
      if (!this.closed) this.scheduleReconnect();
    };

    socket.onerror = () => socket.close();
  }

  private handleMessage(msg: ListFeedMsg | EventFeedMsg | { type: string }) {
    if (msg.type === SyncMsg.PONG) {
      this.clearPongTimer();
      return;
    }

    if (msg.type === SyncMsg.SNAP_LINE && "payload" in msg && msg.payload) {
      this.lineEvents = this.lineEvents.length === 0
        ? msg.payload
        : mergeWcListSnapshot(this.lineEvents, stripDisplayLabels(msg.payload));
      this.notify(this.lineListeners);
      return;
    }

    if (msg.type === SyncMsg.UPD_LINE && "payload" in msg) {
      this.lineEvents = mergeWcFeedDelta(
        this.lineEvents,
        stripDisplayLabels(msg.payload ?? []),
        msg.rm,
        true,
      );
      this.notify(this.lineListeners);
      return;
    }

    if (msg.type === SyncMsg.HB_LINE) return;

    if (msg.type === SyncMsg.SNAP_LIVE && "payload" in msg && msg.payload) {
      this.liveEvents = this.liveEvents.length === 0
        ? msg.payload
        : mergeWcListSnapshot(this.liveEvents, stripDisplayLabels(msg.payload));
      this.notify(this.liveListeners);
      return;
    }

    if (msg.type === SyncMsg.UPD_LIVE && "payload" in msg) {
      this.liveEvents = mergeWcLiveEvents(
        this.liveEvents,
        stripDisplayLabels(msg.payload ?? []),
        msg.rm,
      );
      this.notify(this.liveListeners);
      return;
    }

    if (msg.type === SyncMsg.HB_LIVE) return;

    if (
      (msg.type === SyncMsg.SNAP_EVENT || msg.type === SyncMsg.UPD_EVENT)
      && "ref" in msg
      && msg.payload
    ) {
      const ref = msg.ref;
      const prev = this.eventDetails.get(ref) ?? null;
      if (!prev) {
        this.eventDetails.set(ref, msg.payload);
      } else {
        this.eventDetails.set(ref, mergeWcEventDetail(prev, stripDetailLabels(msg.payload)));
      }
      // Unlock as soon as we have a usable snapshot (SNAP or UPD).
      // Waiting only for UPD made match pages feel stuck while oddsOnly refresh runs.
      if (
        msg.type === SyncMsg.UPD_EVENT
        || (msg.type === SyncMsg.SNAP_EVENT
          && msg.payload
          && Object.keys(msg.payload.groupedMarkets ?? {}).length > 0)
      ) {
        this.markEventMarketsReady(ref);
      }
      const listeners = this.eventListeners.get(ref);
      if (listeners) this.notify(listeners);
    }
  }
}

export const wcOddsFeedStore = new WcOddsFeedStore();
export { FEED_API };
