"use client";

import type { WcEvent, WcEventDetail } from "~/entities/wc-odds/api/client";
import { mergeWcEventDetail } from "~/entities/wc-odds/lib/wcEventDetail";
import { FEED_API, SYNC_WS_PATH, SyncMsg } from "~/entities/wc-odds/lib/feedSync.protocol";
import { mergeWcFeedDelta, mergeWcListSnapshot, mergeWcLiveEvents } from "~/entities/wc-odds/lib/wcLineEvents";

type Listener = () => void;

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

function wsUrl(): string | null {
  if (typeof window === "undefined") return null;
  if (process.env.NEXT_PUBLIC_SYNC_WS_URL) {
    return process.env.NEXT_PUBLIC_SYNC_WS_URL;
  }
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${SYNC_WS_PATH}`;
}

class WcOddsFeedStore {
  private socket: WebSocket | null = null;
  private closed = true;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  private lineSubs = 0;
  private liveSubs = 0;
  private readonly eventSubs = new Map<string, number>();
  private readonly eventDetails = new Map<string, WcEventDetail>();

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
    this.eventSubs.set(ref, (this.eventSubs.get(ref) ?? 0) + 1);
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
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.retryTimer = null;
    this.pingTimer = null;
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

  private connect() {
    const url = wsUrl();
    if (!url || this.closed) return;

    const socket = new WebSocket(url);
    this.socket = socket;

    socket.onopen = () => {
      this.connected = true;
      this.notifyConnection();
      if (this.lineSubs > 0) this.sendSub(SyncMsg.SUB_LINE);
      if (this.liveSubs > 0) this.sendSub(SyncMsg.SUB_LIVE);
      for (const ref of this.eventSubs.keys()) this.sendSub(SyncMsg.SUB_EVENT, ref);
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
      this.connected = false;
      this.notifyConnection();
      if (!this.closed) {
        this.retryTimer = setTimeout(() => this.connect(), 1500);
      }
    };

    socket.onerror = () => socket.close();

    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: SyncMsg.PING }));
      }
    }, 25_000);
  }

  private handleMessage(msg: ListFeedMsg | EventFeedMsg | { type: string }) {
    if (msg.type === SyncMsg.SNAP_LINE && "payload" in msg && msg.payload) {
      this.lineEvents = mergeWcListSnapshot(this.lineEvents, msg.payload);
      this.notify(this.lineListeners);
      return;
    }

    if (msg.type === SyncMsg.UPD_LINE && "payload" in msg) {
      this.lineEvents = mergeWcFeedDelta(this.lineEvents, msg.payload ?? [], msg.rm, true);
      this.notify(this.lineListeners);
      return;
    }

    if (msg.type === SyncMsg.HB_LINE) return;

    if (msg.type === SyncMsg.SNAP_LIVE && "payload" in msg && msg.payload) {
      this.liveEvents = mergeWcListSnapshot(this.liveEvents, msg.payload);
      this.notify(this.liveListeners);
      return;
    }

    if (msg.type === SyncMsg.UPD_LIVE && "payload" in msg) {
      this.liveEvents = mergeWcLiveEvents(this.liveEvents, msg.payload ?? [], msg.rm);
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
      this.eventDetails.set(ref, prev ? mergeWcEventDetail(prev, msg.payload) : msg.payload);
      const listeners = this.eventListeners.get(ref);
      if (listeners) this.notify(listeners);
    }
  }
}

export const wcOddsFeedStore = new WcOddsFeedStore();
export { FEED_API };
