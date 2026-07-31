import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import * as WsNamespace from 'ws';

import {
  BTC_UPDOWN_TICK_BUFFER,
  CRYPTO_PRICE_FEED_SYMBOLS,
  CRYPTO_RACE_ONLY_SYMBOLS,
  binanceKlinesUrl,
  binancePriceUrl,
  binanceTradeStreamUrl,
} from './btc-updown.constants';

export type BtcTick = { t: number; p: number };

type Feed = {
  lastPrice: number | null;
  lastAt: number;
  /** Last real trade print (not book mid). Chart prefers these. */
  lastTradeAt: number;
  ticks: BtcTick[];
};

type WsClient = InstanceType<typeof WsNamespace.WebSocket>;

const WebSocketCtor =
  (WsNamespace as unknown as { default?: typeof WsNamespace.WebSocket }).default ??
  WsNamespace.WebSocket;

@Injectable()
export class BtcUpdownPriceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BtcUpdownPriceService.name);
  private readonly feeds = new Map<string, Feed>();
  private polling = false;
  private ws: WsClient | null = null;
  private wsAlive = false;
  private wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private wsBackoffMs = 1_000;

  constructor() {
    for (const symbol of CRYPTO_PRICE_FEED_SYMBOLS) {
      this.feeds.set(symbol, {
        lastPrice: null,
        lastAt: 0,
        lastTradeAt: 0,
        ticks: [],
      });
    }
  }

  async onModuleInit() {
    await Promise.all(
      CRYPTO_PRICE_FEED_SYMBOLS.map(async (symbol) => {
        await this.seedFromKlines(symbol);
        await this.pollOnce(symbol);
      }),
    );
    try {
      this.connectWs();
    } catch (err) {
      this.logger.warn(
        `Binance WS init failed, REST fallback: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  onModuleDestroy() {
    if (this.wsReconnectTimer) {
      clearTimeout(this.wsReconnectTimer);
      this.wsReconnectTimer = null;
    }
    try {
      this.ws?.removeAllListeners();
      this.ws?.close();
    } catch {
      /* ignore */
    }
    this.ws = null;
    this.wsAlive = false;
  }

  getLastPrice(symbol: string = 'BTCUSDT'): number | null {
    return this.feed(symbol).lastPrice;
  }

  getLastAt(symbol: string = 'BTCUSDT'): number {
    return this.feed(symbol).lastAt;
  }

  getTicks(symbol: string, fromMs?: number, toMs?: number): BtcTick[] {
    const from = fromMs ?? 0;
    const to = toMs ?? Number.POSITIVE_INFINITY;
    return this.feed(symbol).ticks.filter((x) => x.t >= from && x.t <= to);
  }

  /**
   * Dense recent series for the live chart: prefer last `windowMs`,
   * keep every micro-move (cap to avoid huge payloads).
   */
  getChartTicks(
    symbol: string,
    windowMs = 90_000,
    maxPoints = 1_200,
  ): BtcTick[] {
    const feed = this.feed(symbol);
    if (!feed.ticks.length) return [];
    const now = Date.now();
    const from = now - windowMs;
    const recent = feed.ticks.filter((x) => x.t >= from);
    if (recent.length <= maxPoints) return recent;
    // Keep the newest third at full density; downsample the older tail.
    const keepTail = Math.floor(maxPoints * 0.55);
    const headBudget = maxPoints - keepTail;
    const head = recent.slice(0, Math.max(0, recent.length - keepTail));
    const tail = recent.slice(-keepTail);
    if (head.length <= headBudget) return [...head, ...tail];
    const step = (head.length - 1) / Math.max(1, headBudget - 1);
    const sparse: BtcTick[] = [];
    for (let i = 0; i < headBudget; i++) {
      sparse.push(head[Math.round(i * step)]!);
    }
    return [...sparse, ...tail];
  }

  /** REST fallback when WS is down; keep light when WS is healthy. */
  @Interval(1_200)
  async pollTick() {
    if (this.polling) return;
    if (this.wsAlive) return;
    this.polling = true;
    try {
      await Promise.all(
        CRYPTO_PRICE_FEED_SYMBOLS.map((symbol) => this.pollOnce(symbol)),
      );
    } finally {
      this.polling = false;
    }
  }

  private connectWs() {
    if (this.ws) {
      try {
        this.ws.removeAllListeners();
        this.ws.close();
      } catch {
        /* ignore */
      }
      this.ws = null;
    }

    const url = binanceTradeStreamUrl(CRYPTO_PRICE_FEED_SYMBOLS);
    const socket = new WebSocketCtor(url);
    this.ws = socket;

    socket.on('open', () => {
      this.wsAlive = true;
      this.wsBackoffMs = 1_000;
      this.logger.log('Binance trade WS connected');
    });

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw)) as {
          stream?: string;
          data?: {
            s?: string;
            p?: string;
            b?: string;
            a?: string;
            T?: number;
            E?: number;
          };
        };
        const data = msg.data;
        if (!data?.s) return;
        const symbol = data.s.toUpperCase();
        const stream = msg.stream || '';
        const t = Number(data.T || data.E || Date.now());
        const isBook =
          stream.includes('bookTicker') || (data.b != null && data.a != null);
        if (isBook) {
          const bid = Number(data.b);
          const ask = Number(data.a);
          if (
            !Number.isFinite(bid) ||
            !Number.isFinite(ask) ||
            bid <= 0 ||
            ask <= 0
          ) {
            return;
          }
          // Mark price always; chart path only if trades went quiet.
          this.pushBookMid(symbol, t, (bid + ask) / 2);
          return;
        }
        if (data.p == null) return;
        const price = Number(data.p);
        if (!Number.isFinite(price) || price <= 0) return;
        this.pushTrade(symbol, t, price);
      } catch {
        /* ignore bad frames */
      }
    });

    socket.on('close', () => {
      this.wsAlive = false;
      this.logger.warn('Binance trade WS closed — scheduling reconnect');
      this.scheduleReconnect();
    });

    socket.on('error', (err) => {
      this.wsAlive = false;
      this.logger.warn(
        `Binance trade WS error: ${err instanceof Error ? err.message : err}`,
      );
      try {
        socket.close();
      } catch {
        /* ignore */
      }
    });
  }

  private scheduleReconnect() {
    if (this.wsReconnectTimer) return;
    const wait = this.wsBackoffMs;
    this.wsBackoffMs = Math.min(30_000, this.wsBackoffMs * 1.6);
    this.wsReconnectTimer = setTimeout(() => {
      this.wsReconnectTimer = null;
      this.connectWs();
    }, wait);
  }

  private feed(symbol: string): Feed {
    const key = (symbol || 'BTCUSDT').toUpperCase();
    let feed = this.feeds.get(key);
    if (!feed) {
      feed = { lastPrice: null, lastAt: 0, lastTradeAt: 0, ticks: [] };
      this.feeds.set(key, feed);
    }
    return feed;
  }

  private async pollOnce(symbol: string) {
    try {
      const res = await fetch(binancePriceUrl(symbol), {
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) {
        this.logger.warn(`${symbol} price HTTP ${res.status}`);
        return;
      }
      const body = (await res.json()) as { price?: string };
      const price = Number(body?.price);
      if (!Number.isFinite(price) || price <= 0) return;
      this.pushTick(symbol, Date.now(), price);
    } catch (err) {
      this.logger.warn(
        `${symbol} price poll failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  private async seedFromKlines(symbol: string) {
    try {
      const res = await fetch(binanceKlinesUrl(symbol, 900), {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return;
      const rows = (await res.json()) as unknown[];
      if (!Array.isArray(rows)) return;
      for (const row of rows) {
        if (!Array.isArray(row) || row.length < 5) continue;
        const openTime = Number(row[0]);
        const high = Number(row[2]);
        const low = Number(row[3]);
        const close = Number(row[4]);
        if (!Number.isFinite(openTime) || !Number.isFinite(close) || close <= 0) {
          continue;
        }
        // Seed open→high/low→close so the chart has real wicks, not a flat close line.
        this.pushTick(symbol, openTime, Number(row[1]) || close);
        if (Number.isFinite(high) && high > 0) {
          this.pushTick(symbol, openTime + 250, high);
        }
        if (Number.isFinite(low) && low > 0) {
          this.pushTick(symbol, openTime + 500, low);
        }
        this.pushTick(symbol, openTime + 750, close);
      }
      this.logger.log(
        `Seeded ${this.feed(symbol).ticks.length} ${symbol} ticks from Binance`,
      );
    } catch (err) {
      this.logger.warn(
        `${symbol} klines seed failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /** Real trade print — always drives the chart path when price moves. */
  private pushTrade(symbol: string, t: number, p: number) {
    const feed = this.feed(symbol);
    feed.lastTradeAt = Math.max(feed.lastTradeAt, t);
    this.appendTick(feed, t, p, /*minMoveRel*/ 0.00000015, /*coalesceMs*/ 8);
  }

  /**
   * Book mid: updates mark always; only appends a chart tick when trades are
   * quiet (>40ms) and mid actually moved — kills duplicate flat mids.
   */
  private pushBookMid(symbol: string, t: number, p: number) {
    const feed = this.feed(symbol);
    feed.lastPrice = p;
    feed.lastAt = Math.max(feed.lastAt, t);
    const raceOnly = (CRYPTO_RACE_ONLY_SYMBOLS as readonly string[]).includes(
      symbol,
    );
    // Race alts trade thinly — book mid is the real chart ink. Keep it denser
    // than majors or the Race plot becomes long flats + stairs.
    if (t - feed.lastTradeAt < (raceOnly ? 18 : 40)) return;
    this.appendTick(
      feed,
      t,
      p,
      raceOnly ? 0.0000002 : 0.0000008,
      raceOnly ? 16 : 45,
    );
  }

  private pushTick(symbol: string, t: number, p: number) {
    // REST / kline seed — treat as trade-quality points.
    this.pushTrade(symbol, t, p);
  }

  private appendTick(
    feed: Feed,
    t: number,
    p: number,
    minMoveRel: number,
    coalesceMs: number,
  ) {
    const last = feed.ticks[feed.ticks.length - 1];
    if (last && last.t === t) {
      if (last.p === p) {
        feed.lastPrice = p;
        feed.lastAt = t;
        return;
      }
      last.p = p;
      feed.lastPrice = p;
      feed.lastAt = t;
      return;
    }
    if (last) {
      const dt = t - last.t;
      const rel = Math.abs(p - last.p) / Math.max(last.p, 1e-9);
      if (dt < coalesceMs && rel < minMoveRel) {
        feed.lastPrice = p;
        feed.lastAt = Math.max(feed.lastAt, t);
        return;
      }
      // Same price within coalesce window → update timestamp only (no new flat point).
      if (rel < minMoveRel && dt < Math.max(coalesceMs, 50)) {
        last.t = Math.max(last.t, t);
        feed.lastPrice = p;
        feed.lastAt = Math.max(feed.lastAt, t);
        return;
      }
    }
    feed.ticks.push({ t, p });
    if (feed.ticks.length > BTC_UPDOWN_TICK_BUFFER) {
      feed.ticks.splice(0, feed.ticks.length - BTC_UPDOWN_TICK_BUFFER);
    }
    feed.lastPrice = p;
    feed.lastAt = t;
  }
}
