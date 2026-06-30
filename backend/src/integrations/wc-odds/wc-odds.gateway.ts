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

type WcClient = {
  socket: WebSocket;
  line: boolean;
  live: boolean;
  events: Set<string>;
};

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
    for (const { socket } of this.clients.values()) {
      if (socket.readyState === WebSocket.OPEN) socket.close(1000, 'shutdown');
    }
    this.clients.clear();
  }

  private send(socket: WebSocket, payload: object) {
    if (socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(payload));
  }

  sendLineSnapshot(events: WcOddsEventDto[]) {
    const payload = sanitizePublicEventList(events);
    for (const { socket, line } of this.clients.values()) {
      if (!line) continue;
      this.send(socket, { type: SyncMsg.SNAP_LINE, payload, ts: Date.now() });
    }
  }

  sendLineUpdate(events: WcOddsEventDto[]) {
    this.sendLineDelta(events, []);
  }

  sendLineDelta(events: WcOddsEventDto[], removedPublicIds: string[]) {
    const payload = sanitizePublicEventList(events);
    const rm = removedPublicIds.length > 0 ? removedPublicIds : undefined;
    for (const { socket, line } of this.clients.values()) {
      if (!line) continue;
      this.send(socket, { type: SyncMsg.UPD_LINE, payload, rm, ts: Date.now() });
    }
  }

  sendLineHeartbeat() {
    for (const { socket, line } of this.clients.values()) {
      if (!line) continue;
      this.send(socket, { type: SyncMsg.HB_LINE, ts: Date.now() });
    }
  }

  sendLiveSnapshot(events: WcOddsEventDto[]) {
    const payload = sanitizePublicEventList(events);
    for (const { socket, live } of this.clients.values()) {
      if (!live) continue;
      this.send(socket, { type: SyncMsg.SNAP_LIVE, payload, ts: Date.now() });
    }
  }

  sendLiveUpdate(events: WcOddsEventDto[]) {
    this.sendLiveDelta(events, []);
  }

  sendLiveDelta(events: WcOddsEventDto[], removedPublicIds: string[]) {
    const payload = sanitizePublicEventList(events);
    const rm = removedPublicIds.length > 0 ? removedPublicIds : undefined;
    for (const { socket, live } of this.clients.values()) {
      if (!live) continue;
      this.send(socket, { type: SyncMsg.UPD_LIVE, payload, rm, ts: Date.now() });
    }
  }

  sendLiveHeartbeat() {
    for (const { socket, live } of this.clients.values()) {
      if (!live) continue;
      this.send(socket, { type: SyncMsg.HB_LIVE, ts: Date.now() });
    }
  }

  sendEventSnapshot(ref: string, detail: WcOddsEventDetailDto) {
    const publicRef = toPublicRef(detail);
    const payload = sanitizePublicEventDetail(detail);
    for (const { socket, events } of this.clients.values()) {
      if (!events.has(ref)) continue;
      this.send(socket, { type: SyncMsg.SNAP_EVENT, ref: publicRef, payload, ts: Date.now() });
    }
  }

  sendEventUpdate(ref: string, detail: WcOddsEventDetailDto) {
    const publicRef = toPublicRef(detail);
    const payload = sanitizePublicEventDetail(detail);
    for (const { socket, events } of this.clients.values()) {
      if (!events.has(ref)) continue;
      this.send(socket, { type: SyncMsg.UPD_EVENT, ref: publicRef, payload, ts: Date.now() });
    }
  }

  sendEventHeartbeat(ref: string) {
    for (const { socket, events } of this.clients.values()) {
      if (!events.has(ref)) continue;
      this.send(socket, { type: SyncMsg.HB_EVENT, ref, ts: Date.now() });
    }
  }

  private onMessage(clientId: string, data: Data) {
    const client = this.clients.get(clientId);
    if (!client) return;

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
        this.realtimeService?.subscribeLine();
      }
      this.send(client.socket, { type: SyncMsg.SUBSCRIBED, scope: 'line' });
      return;
    }

    if (message.type === SyncMsg.UNSUB_LINE) {
      if (client.line) {
        client.line = false;
        this.realtimeService?.unsubscribeLine();
      }
      this.send(client.socket, { type: SyncMsg.UNSUBSCRIBED, scope: 'line' });
      return;
    }

    if (message.type === SyncMsg.SUB_LIVE) {
      if (!client.live) {
        client.live = true;
        this.realtimeService?.subscribeLive();
      }
      this.send(client.socket, { type: SyncMsg.SUBSCRIBED, scope: 'live' });
      return;
    }

    if (message.type === SyncMsg.UNSUB_LIVE) {
      if (client.live) {
        client.live = false;
        this.realtimeService?.unsubscribeLive();
      }
      this.send(client.socket, { type: SyncMsg.UNSUBSCRIBED, scope: 'live' });
      return;
    }

    if (message.type === SyncMsg.SUB_EVENT && message.ref) {
      const ref = resolveEventRef(message.ref);
      if (!client.events.has(ref)) {
        client.events.add(ref);
        this.realtimeService?.subscribeEvent(ref);
      }
      this.send(client.socket, { type: SyncMsg.SUBSCRIBED, scope: 'event', ref: message.ref });
      return;
    }

    if (message.type === SyncMsg.UNSUB_EVENT && message.ref) {
      const ref = resolveEventRef(message.ref);
      if (client.events.delete(ref)) {
        this.realtimeService?.unsubscribeEvent(ref);
      }
      this.send(client.socket, { type: SyncMsg.UNSUBSCRIBED, scope: 'event', ref: message.ref });
    }
  }

  handleConnection(socket: WebSocket, _request: IncomingMessage) {
    const clientId = uuid4();
    this.clients.set(clientId, { socket, line: false, live: false, events: new Set() });
    this.send(socket, { type: SyncMsg.CONNECTED, ts: Date.now() });

    socket.on('message', (data) => this.onMessage(clientId, data));
    socket.on('close', () => this.handleDisconnect(socket));
  }

  handleDisconnect(socket: WebSocket) {
    for (const [clientId, client] of this.clients.entries()) {
      if (client.socket !== socket) continue;
      if (client.line) this.realtimeService?.unsubscribeLine();
      if (client.live) this.realtimeService?.unsubscribeLive();
      for (const ref of client.events) this.realtimeService?.unsubscribeEvent(ref);
      this.clients.delete(clientId);
      break;
    }
  }
}
