import { Logger, OnModuleDestroy } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
} from '@nestjs/websockets';
import { IncomingMessage } from 'http';
import { v4 as uuid4 } from 'uuid';
import { Data, WebSocket } from 'ws';

import {
  resolveEventRef,
  sanitizePublicEventDetail,
  sanitizePublicEventList,
  toPublicRef,
} from './wc-public.util';
import { SyncMsg } from './wc-sync.protocol';
import type { WcOddsEventDetailDto, WcOddsEventDto } from './wc-odds.types';
import { isAiBotUserAgent } from '../../common/security/ai-bot-detection.util';
import {
  FEED_COOKIE_NAME,
  isNativeAppUserAgent,
  isPrivateOrLoopbackIp,
  parseCookieHeader,
  verifyFeedToken,
} from '../../common/security/feed-access.util';
import { feedWsConnectRateLimiter } from '../../common/security/feed-rate-limit';

type WcClient = {
  socket: WebSocket;
  line: boolean;
  live: boolean;
  events: Set<string>;
  lastActivity: number;
};

/** Drop clients whose kernel send buffer exceeds this (slow consumer). */
const MAX_BUFFERED_BYTES = 256 * 1024;
const CLIENT_TIMEOUT_MS = 60_000;
const CLEANUP_INTERVAL_MS = 30_000;

@WebSocketGateway({
  path: '/api/sync',
  transports: ['websocket'],
  cors: {
    origin: [
      'http://localhost:9000',
      'http://localhost:8000',
      'http://localhost:3000',
      'https://imba.bet',
      'https://partners.imba.bet',
      'https://imba.partners',
    ],
    credentials: true,
  },
})
export class WcOddsGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, OnModuleDestroy
{
  private readonly logger = new Logger(WcOddsGateway.name);
  private readonly clients = new Map<string, WcClient>();
  private readonly lineClientIds = new Set<string>();
  private readonly liveClientIds = new Set<string>();
  private readonly eventClientIds = new Map<string, Set<string>>();
  private cleanupTimer?: NodeJS.Timeout;
  private realtimeService: {
    subscribeLine: () => void;
    unsubscribeLine: () => void;
    subscribeLive: () => void;
    unsubscribeLive: () => void;
    subscribeEvent: (ref: string) => void;
    unsubscribeEvent: (ref: string) => void;
  } | null = null;

  afterInit() {
    this.logger.log('Feed sync gateway ready at /api/sync');
    this.cleanupTimer = setInterval(() => this.cleanupInactiveClients(), CLEANUP_INTERVAL_MS);
  }

  bindRealtimeService(service: {
    subscribeLine: () => void;
    unsubscribeLine: () => void;
    subscribeLive: () => void;
    unsubscribeLive: () => void;
    subscribeEvent: (ref: string) => void;
    unsubscribeEvent: (ref: string) => void;
  }) {
    this.realtimeService = service;
  }

  onModuleDestroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    for (const { socket } of this.clients.values()) {
      if (socket.readyState === WebSocket.OPEN) socket.close(1000, 'shutdown');
    }
    this.clients.clear();
    this.lineClientIds.clear();
    this.liveClientIds.clear();
    this.eventClientIds.clear();
  }

  private send(socket: WebSocket, payload: object) {
    if (socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(payload));
  }

  /** Fan-out a pre-serialized frame to target clients (one JSON.stringify per broadcast). */
  private broadcastRaw(targetIds: Iterable<string>, raw: string): void {
    for (const clientId of targetIds) {
      const client = this.clients.get(clientId);
      if (!client || client.socket.readyState !== WebSocket.OPEN) continue;

      if (client.socket.bufferedAmount > MAX_BUFFERED_BYTES) {
        client.socket.close(1008, 'slow consumer');
        this.removeClient(clientId);
        continue;
      }

      client.socket.send(raw);
    }
  }

  private addLineClient(clientId: string): void {
    this.lineClientIds.add(clientId);
  }

  private removeLineClient(clientId: string): void {
    this.lineClientIds.delete(clientId);
  }

  private addLiveClient(clientId: string): void {
    this.liveClientIds.add(clientId);
  }

  private removeLiveClient(clientId: string): void {
    this.liveClientIds.delete(clientId);
  }

  private addEventClient(clientId: string, ref: string): void {
    let set = this.eventClientIds.get(ref);
    if (!set) {
      set = new Set();
      this.eventClientIds.set(ref, set);
    }
    set.add(clientId);
  }

  private removeEventClient(clientId: string, ref: string): void {
    const set = this.eventClientIds.get(ref);
    if (!set) return;
    set.delete(clientId);
    if (set.size === 0) this.eventClientIds.delete(ref);
  }

  private removeClientFromIndexes(clientId: string, client: WcClient): void {
    this.removeLineClient(clientId);
    this.removeLiveClient(clientId);
    for (const ref of client.events) {
      this.removeEventClient(clientId, ref);
    }
  }

  private removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    if (client.line) this.realtimeService?.unsubscribeLine();
    if (client.live) this.realtimeService?.unsubscribeLive();
    for (const ref of client.events) {
      this.realtimeService?.unsubscribeEvent(ref);
    }

    this.removeClientFromIndexes(clientId, client);
    this.clients.delete(clientId);
  }

  private cleanupInactiveClients(): void {
    const now = Date.now();
    const stale: string[] = [];

    for (const [clientId, client] of this.clients.entries()) {
      if (now - client.lastActivity > CLIENT_TIMEOUT_MS) {
        stale.push(clientId);
      }
    }

    for (const clientId of stale) {
      const client = this.clients.get(clientId);
      if (client?.socket.readyState === WebSocket.OPEN) {
        client.socket.close(1000, 'inactive');
      }
      this.removeClient(clientId);
    }

    if (stale.length > 0) {
      this.logger.log(`Cleaned ${stale.length} inactive sync clients (${this.clients.size} remaining)`);
    }
  }

  sendLineSnapshot(events: WcOddsEventDto[]) {
    if (this.lineClientIds.size === 0) return;
    const payload = sanitizePublicEventList(events);
    const raw = JSON.stringify({ type: SyncMsg.SNAP_LINE, payload, ts: Date.now() });
    this.broadcastRaw(this.lineClientIds, raw);
  }

  sendLineUpdate(events: WcOddsEventDto[]) {
    this.sendLineDelta(events, []);
  }

  sendLineDelta(events: WcOddsEventDto[], removedPublicIds: string[]) {
    if (this.lineClientIds.size === 0) return;
    const payload = sanitizePublicEventList(events);
    const rm = removedPublicIds.length > 0 ? removedPublicIds : undefined;
    const raw = JSON.stringify({ type: SyncMsg.UPD_LINE, payload, rm, ts: Date.now() });
    this.broadcastRaw(this.lineClientIds, raw);
  }

  sendLineHeartbeat() {
    if (this.lineClientIds.size === 0) return;
    const raw = JSON.stringify({ type: SyncMsg.HB_LINE, ts: Date.now() });
    this.broadcastRaw(this.lineClientIds, raw);
  }

  sendLiveSnapshot(events: WcOddsEventDto[]) {
    if (this.liveClientIds.size === 0) return;
    const payload = sanitizePublicEventList(events);
    const raw = JSON.stringify({ type: SyncMsg.SNAP_LIVE, payload, ts: Date.now() });
    this.broadcastRaw(this.liveClientIds, raw);
  }

  sendLiveUpdate(events: WcOddsEventDto[]) {
    this.sendLiveDelta(events, []);
  }

  sendLiveDelta(events: WcOddsEventDto[], removedPublicIds: string[]) {
    if (this.liveClientIds.size === 0) return;
    const payload = sanitizePublicEventList(events);
    const rm = removedPublicIds.length > 0 ? removedPublicIds : undefined;
    const raw = JSON.stringify({ type: SyncMsg.UPD_LIVE, payload, rm, ts: Date.now() });
    this.broadcastRaw(this.liveClientIds, raw);
  }

  sendLiveHeartbeat() {
    if (this.liveClientIds.size === 0) return;
    const raw = JSON.stringify({ type: SyncMsg.HB_LIVE, ts: Date.now() });
    this.broadcastRaw(this.liveClientIds, raw);
  }

  sendEventSnapshot(ref: string, detail: WcOddsEventDetailDto) {
    const subs = this.eventClientIds.get(ref);
    if (!subs?.size) return;
    const publicRef = toPublicRef(detail);
    const payload = sanitizePublicEventDetail(detail);
    const raw = JSON.stringify({ type: SyncMsg.SNAP_EVENT, ref: publicRef, payload, ts: Date.now() });
    this.broadcastRaw(subs, raw);
  }

  sendEventUpdate(ref: string, detail: WcOddsEventDetailDto) {
    const subs = this.eventClientIds.get(ref);
    if (!subs?.size) return;
    const publicRef = toPublicRef(detail);
    const payload = sanitizePublicEventDetail(detail);
    const raw = JSON.stringify({ type: SyncMsg.UPD_EVENT, ref: publicRef, payload, ts: Date.now() });
    this.broadcastRaw(subs, raw);
  }

  sendEventHeartbeat(ref: string) {
    const subs = this.eventClientIds.get(ref);
    if (!subs?.size) return;
    const raw = JSON.stringify({ type: SyncMsg.HB_EVENT, ref, ts: Date.now() });
    this.broadcastRaw(subs, raw);
  }

  private touchClient(client: WcClient): void {
    client.lastActivity = Date.now();
  }

  private onMessage(clientId: string, data: Data) {
    const client = this.clients.get(clientId);
    if (!client) return;

    this.touchClient(client);

    let message: { type?: string; ref?: string; scope?: string };
    try {
      message = JSON.parse(data.toString());
    } catch {
      return;
    }

    if (message.type === SyncMsg.PING) {
      this.send(client.socket, { type: SyncMsg.PONG, ts: Date.now() });
      return;
    }

    if (message.type === SyncMsg.SUB_LINE) {
      if (!client.line) {
        client.line = true;
        this.addLineClient(clientId);
        this.realtimeService?.subscribeLine();
      }
      this.send(client.socket, { type: SyncMsg.SUBSCRIBED, scope: 'line' });
      return;
    }

    if (message.type === SyncMsg.UNSUB_LINE) {
      if (client.line) {
        client.line = false;
        this.removeLineClient(clientId);
        this.realtimeService?.unsubscribeLine();
      }
      this.send(client.socket, { type: SyncMsg.UNSUBSCRIBED, scope: 'line' });
      return;
    }

    if (message.type === SyncMsg.SUB_LIVE) {
      if (!client.live) {
        client.live = true;
        this.addLiveClient(clientId);
        this.realtimeService?.subscribeLive();
      }
      this.send(client.socket, { type: SyncMsg.SUBSCRIBED, scope: 'live' });
      return;
    }

    if (message.type === SyncMsg.UNSUB_LIVE) {
      if (client.live) {
        client.live = false;
        this.removeLiveClient(clientId);
        this.realtimeService?.unsubscribeLive();
      }
      this.send(client.socket, { type: SyncMsg.UNSUBSCRIBED, scope: 'live' });
      return;
    }

    if (message.type === SyncMsg.SUB_EVENT && message.ref) {
      const ref = resolveEventRef(message.ref);
      if (!client.events.has(ref)) {
        client.events.add(ref);
        this.addEventClient(clientId, ref);
        this.realtimeService?.subscribeEvent(ref);
      }
      this.send(client.socket, { type: SyncMsg.SUBSCRIBED, scope: 'event', ref: message.ref });
      return;
    }

    if (message.type === SyncMsg.UNSUB_EVENT && message.ref) {
      const ref = resolveEventRef(message.ref);
      if (client.events.delete(ref)) {
        this.removeEventClient(clientId, ref);
        this.realtimeService?.unsubscribeEvent(ref);
      }
      this.send(client.socket, { type: SyncMsg.UNSUBSCRIBED, scope: 'event', ref: message.ref });
    }
  }

  private resolveClientIp(request: IncomingMessage): string {
    const cf = request.headers['cf-connecting-ip'];
    if (typeof cf === 'string' && cf.trim()) return cf.trim();
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
      return forwarded.split(',')[0]?.trim() || 'unknown';
    }
    return request.socket.remoteAddress || 'unknown';
  }

  private hasFeedAccess(request: IncomingMessage): boolean {
    const ua = request.headers['user-agent'];
    if (isNativeAppUserAgent(ua)) return true;

    const ip = this.resolveClientIp(request);
    if (isPrivateOrLoopbackIp(ip)) return true;

    const headerToken = request.headers['x-imba-feed-token'];
    if (typeof headerToken === 'string' && verifyFeedToken(headerToken.trim())) {
      return true;
    }

    const cookieToken = parseCookieHeader(request.headers.cookie, FEED_COOKIE_NAME);
    if (verifyFeedToken(cookieToken)) return true;

    // Logged-in players may open WS before feed session refresh.
    if (parseCookieHeader(request.headers.cookie, 'accessToken')) return true;

    try {
      const host = request.headers.host || 'localhost';
      const url = new URL(request.url || '/', `http://${host}`);
      const q = url.searchParams.get('ft');
      if (verifyFeedToken(q)) return true;
    } catch {
      // ignore
    }

    return false;
  }

  handleConnection(socket: WebSocket, request: IncomingMessage) {
    // Refuse AI agents/crawlers from inspecting the live-odds sync protocol.
    if (isAiBotUserAgent(request.headers['user-agent'])) {
      socket.close(4403, 'AI_ACCESS_DENIED');
      return;
    }

    const ip = this.resolveClientIp(request);
    if (!feedWsConnectRateLimiter.try(`ws:${ip}`)) {
      socket.close(4429, 'FEED_WS_RATE_LIMIT');
      return;
    }

    if (!this.hasFeedAccess(request)) {
      socket.close(4401, 'FEED_SESSION_REQUIRED');
      return;
    }

    const clientId = uuid4();
    this.clients.set(clientId, {
      socket,
      line: false,
      live: false,
      events: new Set(),
      lastActivity: Date.now(),
    });
    this.send(socket, { type: SyncMsg.CONNECTED, ts: Date.now() });

    socket.on('message', (data) => this.onMessage(clientId, data));
    socket.on('error', (err) => {
      this.logger.warn(`Sync client ${clientId} socket error: ${(err as Error).message}`);
    });
    socket.on('close', () => this.handleDisconnect(socket));
  }

  handleDisconnect(socket: WebSocket) {
    for (const [clientId, client] of this.clients.entries()) {
      if (client.socket !== socket) continue;
      this.removeClient(clientId);
      break;
    }
  }
}
