import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Public gateway that 1win.pro's sportsbook frontend calls directly — no auth
// required for fixture lists / broadcast+tracker URLs (confirmed via direct probe).
export const ONEWIN_GATEWAY_HOST = 'https://api-gateway.top-parser.com';
export const ONEWIN_WS_HOST = 'wss://api-gateway.top-parser.com';
export const ONEWIN_WS_PATH = '/push-server-v2/';

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const DEFAULT_PARTNER_ID = '44ba10e5-7df2-47ab-a44d-dc93803c7a6e';

@Injectable()
export class OneWinHttpClient {
  private circuitOpenUntil = 0;
  private consecutiveFailures = 0;
  private readonly logger = new Logger(OneWinHttpClient.name);

  constructor(private readonly config: ConfigService) {}

  private headers(): Record<string, string> {
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Referer: 'https://1win.pro/',
      'User-Agent': DEFAULT_UA,
      'x-external-partner-id': this.partnerId,
      'x-lang': 'ru-RU',
      'x-user-location': 'RU',
    };
  }

  private recordFailure(reason: string): void {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= 4) {
      this.circuitOpenUntil = Date.now() + 60_000;
      this.logger.warn(`1win gateway circuit OPEN 60s (${reason})`);
    }
  }

  /** GET helper (embed/HLS resolution hops off other hosts — no gateway headers needed). */
  async fetchText(
    url: string,
    extraHeaders?: Record<string, string>,
  ): Promise<null | string> {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 8_000);
    try {
      const res = await fetch(url, {
        headers: {
          Referer: 'https://1win.pro/',
          'User-Agent': DEFAULT_UA,
          ...extraHeaders,
        },
        signal: ac.signal,
      });
      if (!res.ok) return null;
      return await res.text();
    } catch (err) {
      this.logger.debug(
        `1win fetchText failed ${url}: ${(err as Error).message}`,
      );
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  isCircuitOpen(): boolean {
    return this.circuitOpenUntil > Date.now();
  }

  async postJson<T>(path: string, body: unknown): Promise<T | null> {
    if (this.isCircuitOpen()) return null;

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 8_000);
    try {
      const res = await fetch(`${ONEWIN_GATEWAY_HOST}${path}`, {
        body: JSON.stringify(body),
        headers: this.headers(),
        method: 'POST',
        signal: ac.signal,
      });

      if (!res.ok) {
        this.recordFailure(`HTTP ${res.status} on ${path}`);
        return null;
      }

      const json = (await res.json()) as { result?: T };
      this.consecutiveFailures = 0;
      return json?.result ?? null;
    } catch (err) {
      this.recordFailure((err as Error).message);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  get partnerId(): string {
    return (
      this.config.get<string>('ONEWIN_PARTNER_ID')?.trim() || DEFAULT_PARTNER_ID
    );
  }
}
