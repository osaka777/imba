/** Obfuscated WebSocket message types (public /api/sync channel). */
export const SyncMsg = {
  CONNECTED: 'c0',
  SUBSCRIBED: 'c1',
  UNSUBSCRIBED: 'c2',
  SUB_LINE: 's1',
  UNSUB_LINE: 'u1',
  SUB_LIVE: 's2',
  UNSUB_LIVE: 'u2',
  SUB_EVENT: 's3',
  UNSUB_EVENT: 'u3',
  SNAP_LINE: 'd1',
  UPD_LINE: 'd2',
  HB_LINE: 'h1',
  SNAP_LIVE: 'd3',
  UPD_LIVE: 'd4',
  HB_LIVE: 'h2',
  SNAP_EVENT: 'd5',
  UPD_EVENT: 'd6',
  HB_EVENT: 'h3',
  PING: 'p',
  PONG: 'o',
} as const;

export type SyncScope = 'line' | 'live' | 'event';
