import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';

import {
  BTC_UPDOWN_TICK_BUFFER,
  CRYPTO_UPDOWN_SYMBOLS,
  binanceKlinesUrl,
  binancePriceUrl,
  type CryptoUpdownSymbol,
} from './btc-updown.constants';

export type BtcTick = { t: number; p: number };

type Feed = {
  lastPrice: number | null;
  lastAt: number;
  ticks: BtcTick[];
};

@Injectable()
export class BtcUpdownPriceService implements OnModuleInit {
  private readonly logger = new Logger(BtcUpdownPriceService.name);
  private readonly feeds = new Map<string, Feed>();
  private polling = false;

  constructor() {
    for (const symbol of CRYPTO_UPDOWN_SYMBOLS) {
      this.feeds.set(symbol, { lastPrice: null, lastAt: 0, ticks: [] });
    }
  }

  async onModuleInit() {
    await Promise.all(
      CRYPTO_UPDOWN_SYMBOLS.map(async (symbol) => {
        await this.seedFromKlines(symbol);
        await this.pollOnce(symbol);
      }),
    );
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

  @Interval(400)
  async pollTick() {
    if (this.polling) return;
    this.polling = true;
    try {
      await Promise.all(
        CRYPTO_UPDOWN_SYMBOLS.map((symbol) => this.pollOnce(symbol)),
      );
    } finally {
      this.polling = false;
    }
  }

  private feed(symbol: string): Feed {
    const key = (symbol || 'BTCUSDT').toUpperCase();
    let feed = this.feeds.get(key);
    if (!feed) {
      feed = { lastPrice: null, lastAt: 0, ticks: [] };
      this.feeds.set(key, feed);
    }
    return feed;
  }

  private async pollOnce(symbol: CryptoUpdownSymbol) {
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

  private async seedFromKlines(symbol: CryptoUpdownSymbol) {
    try {
      const res = await fetch(binanceKlinesUrl(symbol, 300), {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return;
      const rows = (await res.json()) as unknown[];
      if (!Array.isArray(rows)) return;
      for (const row of rows) {
        if (!Array.isArray(row) || row.length < 5) continue;
        const openTime = Number(row[0]);
        const close = Number(row[4]);
        if (Number.isFinite(openTime) && Number.isFinite(close) && close > 0) {
          this.pushTick(symbol, openTime, close);
        }
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

  private pushTick(symbol: string, t: number, p: number) {
    const feed = this.feed(symbol);
    const last = feed.ticks[feed.ticks.length - 1];
    if (last && last.t === t) {
      last.p = p;
    } else {
      feed.ticks.push({ t, p });
      if (feed.ticks.length > BTC_UPDOWN_TICK_BUFFER) {
        feed.ticks.splice(0, feed.ticks.length - BTC_UPDOWN_TICK_BUFFER);
      }
    }
    feed.lastPrice = p;
    feed.lastAt = t;
  }
}
