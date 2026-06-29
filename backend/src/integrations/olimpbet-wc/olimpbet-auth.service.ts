import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const AUTH_API = 'https://auth.olimpbet.kz/api';
const PROFILE_PING_URL = 'https://olimpbet.kz/api/profiles/current?locale=ru';
const SESSION_TTL_MS = 50 * 60 * 1000;
const KEEPALIVE_INTERVAL_MS = 10 * 60 * 1000;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

/**
 * Maintains an authenticated Olimpbet session for fetching broadcast (HLS) URLs.
 *
 * Server-side login is blocked by reCAPTCHA, so the primary mode is:
 *  1. A human logs in once in a browser and copies the session cookie into
 *     WC_OLIMPBET_BROADCAST_COOKIE.
 *  2. This service keeps that session alive: it periodically pings an authed
 *     endpoint and merges any refreshed `Set-Cookie` back into its cookie jar
 *     (Olimpbet uses a sliding session), so manual re-login is rarely needed.
 */
@Injectable()
export class OlimpbetAuthService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OlimpbetAuthService.name);

  /** name -> value cookie jar, seeded from env and refreshed from Set-Cookie. */
  private readonly jar = new Map<string, string>();
  private seeded = false;
  private expiresAt = 0;
  private loginInFlight: Promise<string | null> | null = null;
  private keepAliveTimer: NodeJS.Timeout | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.seedFromEnv();
    if (this.jar.size > 0) {
      this.keepAliveTimer = setInterval(() => {
        void this.keepAlive();
      }, KEEPALIVE_INTERVAL_MS);
      // Unref so the timer never blocks process shutdown.
      this.keepAliveTimer.unref?.();
      this.logger.log(
        `Olimpbet broadcast keep-alive enabled (every ${KEEPALIVE_INTERVAL_MS / 60000} min)`,
      );
      // Validate the seed cookie shortly after boot.
      setTimeout(() => void this.keepAlive(), 5000).unref?.();
    }
  }

  onModuleDestroy(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  async getBroadcastCookieHeader(): Promise<string | null> {
    this.seedFromEnv();

    if (this.jar.size > 0 && Date.now() < this.expiresAt) {
      return this.serializeJar();
    }

    if (this.jar.size > 0) {
      // We still have cookies but TTL elapsed — let keep-alive validate them,
      // but keep serving them in the meantime (sliding session).
      return this.serializeJar();
    }

    if (!this.loginInFlight) {
      this.loginInFlight = this.login().finally(() => {
        this.loginInFlight = null;
      });
    }

    return this.loginInFlight;
  }

  /** Merge `Set-Cookie` from any Olimpbet response into the jar (sliding session). */
  ingestResponse(res: Response): void {
    const updated = this.mergeSetCookies(res);
    if (updated) {
      this.expiresAt = Date.now() + SESSION_TTL_MS;
    }
  }

  private seedFromEnv(): void {
    if (this.seeded) return;
    const manual = this.config.get<string>('WC_OLIMPBET_BROADCAST_COOKIE', '').trim();
    if (manual) {
      for (const part of manual.split(';')) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const eq = trimmed.indexOf('=');
        if (eq <= 0) continue;
        const name = trimmed.slice(0, eq).trim();
        const value = trimmed.slice(eq + 1).trim();
        if (name) this.jar.set(name, value);
      }
      if (this.jar.size > 0) {
        this.expiresAt = Date.now() + SESSION_TTL_MS;
        this.logger.log(
          `Seeded Olimpbet broadcast cookie from env (${this.jar.size} cookies)`,
        );
      }
    }
    this.seeded = true;
  }

  private serializeJar(): string {
    return [...this.jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  /** Keep the session warm and capture refreshed cookies. */
  private async keepAlive(): Promise<void> {
    if (this.jar.size === 0) return;
    try {
      const res = await fetch(PROFILE_PING_URL, {
        headers: {
          Accept: 'application/json',
          'User-Agent': UA,
          Referer: 'https://olimpbet.kz/',
          Cookie: this.serializeJar(),
        },
        redirect: 'manual',
      });

      this.mergeSetCookies(res);

      if (res.status === 200) {
        this.expiresAt = Date.now() + SESSION_TTL_MS;
      } else if (res.status === 401 || res.status === 403) {
        this.logger.warn(
          `Olimpbet session expired (profile ping HTTP ${res.status}). `
          + 'Refresh WC_OLIMPBET_BROADCAST_COOKIE from a logged-in browser.',
        );
      }
    } catch (err) {
      this.logger.debug(`Olimpbet keep-alive error: ${(err as Error).message}`);
    }
  }

  private normalizePhone(raw: string): string {
    const digits = raw.replace(/\D/g, '');
    if (digits.startsWith('8') && digits.length === 11) {
      return digits.slice(1);
    }
    if (digits.startsWith('7') && digits.length === 11) {
      return digits.slice(1);
    }
    return digits;
  }

  private async login(): Promise<string | null> {
    const loginRaw = this.config.get<string>('WC_OLIMPBET_LOGIN', '').trim();
    const password = this.config.get<string>('WC_OLIMPBET_PASSWORD', '').trim();
    if (!loginRaw || !password) {
      this.logger.debug('WC_OLIMPBET_LOGIN / WC_OLIMPBET_PASSWORD not configured');
      return null;
    }

    const phone = this.normalizePhone(loginRaw);
    const isPhone = /^\d{10,11}$/.test(phone);
    const username = isPhone ? phone : loginRaw.replace(/\s+/g, '');

    const body = new URLSearchParams({
      platform: 'web-desktop',
      username,
      password,
      ...(isPhone ? { phone } : { login: username }),
    });

    try {
      // Step 1: POST to auth.olimpbet.kz — redirects (302) to olimpbet.kz/auth on success.
      const step1 = await fetch(`${AUTH_API}/sign-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'text/html,application/json',
          Origin: 'https://auth.olimpbet.kz',
          Referer: 'https://auth.olimpbet.kz/ui-light/login?locale=ru&front-state=desktop-light',
          'User-Agent': UA,
        },
        body: body.toString(),
        redirect: 'manual',
      });

      this.mergeSetCookies(step1);
      const location = step1.headers.get('location') ?? '';

      // Success redirect goes to olimpbet.kz/auth (not to /error).
      if (location && !location.includes('/error') && !location.includes('error-code')) {
        const step2 = await fetch(location, {
          method: 'GET',
          headers: {
            'User-Agent': UA,
            Accept: 'text/html',
            Referer: 'https://auth.olimpbet.kz/',
            ...(this.jar.size > 0 ? { Cookie: this.serializeJar() } : {}),
          },
          redirect: 'manual',
        });
        this.mergeSetCookies(step2);
      }

      if (this.jar.size > 0) {
        this.expiresAt = Date.now() + SESSION_TTL_MS;
        this.logger.log('Olimpbet session established for broadcasts');
        return this.serializeJar();
      }

      this.logger.warn(
        `Olimpbet login failed (HTTP ${step1.status}${location ? ` → ${location}` : ''}). `
        + 'Server login may be blocked by captcha — set WC_OLIMPBET_BROADCAST_COOKIE manually.',
      );
      return null;
    } catch (err) {
      this.logger.warn(`Olimpbet login error: ${(err as Error).message}`);
      return null;
    }
  }

  /** Parse `Set-Cookie` header(s) and update the jar. Returns true if anything changed. */
  private mergeSetCookies(res: Response): boolean {
    const headers = res.headers as Headers & { getSetCookie?: () => string[] };
    const raw = typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : ([res.headers.get('set-cookie')].filter(Boolean) as string[]);

    let changed = false;
    for (const line of raw) {
      const first = line.split(';')[0]?.trim();
      if (!first) continue;
      const eq = first.indexOf('=');
      if (eq <= 0) continue;
      const name = first.slice(0, eq).trim();
      const value = first.slice(eq + 1).trim();
      if (!name) continue;
      // Skip cookie deletions (expired/empty value markers).
      if (value === '' || value === 'deleted') continue;
      if (this.jar.get(name) !== value) {
        this.jar.set(name, value);
        changed = true;
      }
    }
    return changed;
  }
}
