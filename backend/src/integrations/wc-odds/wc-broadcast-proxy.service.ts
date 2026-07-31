import { Injectable, Logger } from '@nestjs/common';
import { Response } from 'express';

import { OlimpbetAuthService } from '../olimpbet-wc/olimpbet-auth.service';

const CACHE_TTL_MS = 5 * 60_000;
// Olimpbet API host needs the auth cookie; the live-video CDN hosts are public
// but geo-restricted (only reachable from the server, not the user's browser),
// so we proxy them. They rotate frequently (beterstream.xyz, smytdryt.live, …).
const ALLOWED_HOST_SUFFIXES = [
  'olimpbet.kz',
  'beterstream.xyz',
  'smytdryt.live',
  'dmdvw.live',
  'statsalmastream.net',
  'sportboom.tv',
  'sportradar.com',
  'akamaized.net',
  'cloudfront.net',
  'llnwd.net',
  'almastream.net',
  'kick.com',
  // 1win/top-parser fallback broadcast sources (resolved via onewin-wc).
  'soft4game.com',
  'video-translations.top-parser.com',
  'sportplayer.io',
] as const;

function isAllowedBroadcastHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ALLOWED_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
}

import {
  buildKickPlayerUrl,
  extractKickChannelFromPlayerUrl,
  isKickPlayerUrl,
  kickParentDomains,
} from './kick-broadcast.util';

function rewriteTwitchParentsInHtml(
  html: string,
  requestHost?: string,
  muted = true,
): string {
  const parents = kickParentDomains(requestHost);
  return html.replace(
    /(<iframe[^>]+src=["'])(https:\/\/player\.twitch\.tv\/\?[^"']+)(["'])/gi,
    (_match, prefix: string, src: string, suffix: string) => {
      try {
        const url = new URL(src);
        url.searchParams.delete('parent');
        for (const parent of parents) {
          url.searchParams.append('parent', parent);
        }
        url.searchParams.set('muted', String(muted));
        return `${prefix}${url.toString()}${suffix}`;
      } catch {
        return `${prefix}${src}${suffix}`;
      }
    },
  );
}

/** Relative /js /css in upstream player HTML resolve to imba.bet otherwise → SPA HTML, black screen. */
function rewriteEmbedRelativeAssets(html: string, upstreamUrl: string): string {
  let origin: string;
  try {
    origin = new URL(upstreamUrl).origin;
  } catch {
    return html;
  }
  return html.replace(
    /((?:href|src)=["'])\/(?!\/)([^"']*)/gi,
    (_match, prefix: string, path: string) => `${prefix}${origin}/${path}`,
  );
}

function extractEmbedHlsUrl(html: string): string | null {
  const fromDataSource =
    /data-source=["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i.exec(html)?.[1]
    ?? /data-src=["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i.exec(html)?.[1]
    ?? null;
  if (fromDataSource) return fromDataSource;
  return /https?:\/\/[^"'\\\s>]+\.m3u8[^"'\\\s>]*/i.exec(html)?.[0] ?? null;
}

function rewriteEmbedHlsToProxy(html: string, ref: string): string {
  const proxied = `/api/feed/events/${encodeURIComponent(ref)}/v?t=${Date.now()}`;
  return html
    .replace(
      /(data-source=["'])(https?:\/\/[^"']+\.m3u8[^"']*)(["'])/gi,
      `$1${proxied}$3`,
    )
    .replace(
      /(data-src=["'])(https?:\/\/[^"']+\.m3u8[^"']*)(["'])/gi,
      `$1${proxied}$3`,
    );
}

function buildKickEmbedPage(playerUrl: string, muted = true): string {
  const src = playerUrl.includes('player.kick.com')
    ? playerUrl
    : buildKickPlayerUrl(
      playerUrl.replace(/^https?:\/\/(?:www\.)?kick\.com\//i, '').split(/[/?#]/)[0] ?? '',
      undefined,
      muted,
    );
  const srcUrl = new URL(src);
  srcUrl.searchParams.set('muted', String(muted));
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>html,body{margin:0;padding:0;height:100%;background:#000;}</style>
</head>
<body>
  <iframe
    allow="autoplay; fullscreen; picture-in-picture"
    allowfullscreen
    referrerpolicy="no-referrer-when-downgrade"
    src="${srcUrl.toString().replace(/"/g, '&quot;')}"
    style="width:100%;height:100%;border:0"
    title="Kick stream"
  ></iframe>
</body>
</html>`;
}

function isOlimpbetHost(raw: string): boolean {
  try {
    return /(^|\.)olimpbet\.kz$/i.test(new URL(raw).hostname);
  } catch {
    return false;
  }
}

type BroadcastCacheEntry = {
  upstreamUrl: string;
  expiresAt: number;
};

@Injectable()
export class WcBroadcastProxyService {
  private readonly logger = new Logger(WcBroadcastProxyService.name);
  private readonly cache = new Map<string, BroadcastCacheEntry>();
  private readonly embedCache = new Map<string, BroadcastCacheEntry>();

  constructor(private readonly auth: OlimpbetAuthService) {}

  /** Remember the master playlist URL for a ref so /v can fetch it. */
  rememberUpstream(ref: string, upstreamUrl: string): void {
    this.cache.set(ref, {
      upstreamUrl,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }

  /** Remember iframe player URL (video embed CDN). */
  rememberEmbed(ref: string, upstreamUrl: string): void {
    this.embedCache.set(ref, {
      upstreamUrl,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }

  private upstreamHeaders(upstreamUrl?: string): Record<string, string> {
    const isOneWinCdn =
      !!upstreamUrl &&
      /smytdryt\.live|soft4game\.com|sportplayer\.io|top-parser\.com/i.test(
        upstreamUrl,
      );
    return {
      Accept: '*/*',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
      Referer: isOneWinCdn ? 'https://1win.pro/' : 'https://olimpbet.kz/',
      Origin: isOneWinCdn ? 'https://1win.pro/' : 'https://olimpbet.kz',
    };
  }

  private async cookieHeader(): Promise<string | null> {
    return this.auth.getBroadcastCookieHeader();
  }

  private isAllowedUrl(raw: string): boolean {
    try {
      const url = new URL(raw);
      if (/twitch\.tv/i.test(url.hostname)) return false;
      return url.protocol === 'https:' && isAllowedBroadcastHost(url.hostname);
    } catch {
      return false;
    }
  }

  private async buildHeaders(upstreamUrl: string): Promise<Record<string, string> | null> {
    const headers: Record<string, string> = {
      ...this.upstreamHeaders(upstreamUrl),
    };
    if (isOlimpbetHost(upstreamUrl)) {
      const cookie = await this.cookieHeader();
      if (!cookie) return null;
      headers['Cookie'] = cookie;
    }
    return headers;
  }

  /**
   * Rewrite an HLS playlist so every nested URI (variant playlists AND media
   * segments) is routed back through our proxy. Relative URIs are resolved
   * against the playlist's own URL.
   */
  private rewritePlaylist(text: string, baseUrl: string, ref: string): string {
    const base = new URL(baseUrl);
    const proxyBase = `/api/feed/events/${encodeURIComponent(ref)}/s`;

    return text
      .split('\n')
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return line;
        // Rewrite URIs embedded in tags (e.g. #EXT-X-KEY:URI="...", #EXT-X-MEDIA:URI="...").
        if (trimmed.startsWith('#')) {
          return line.replace(/URI="([^"]+)"/g, (_m, uri: string) => {
            const absolute = new URL(uri, base).toString();
            return `URI="${proxyBase}?src=${encodeURIComponent(absolute)}"`;
          });
        }
        const absolute = new URL(trimmed, base).toString();
        return `${proxyBase}?src=${encodeURIComponent(absolute)}`;
      })
      .join('\n');
  }

  private looksLikePlaylist(contentType: string | null, body: Buffer): boolean {
    if (contentType && /mpegurl|x-mpegURL|vnd\.apple/i.test(contentType)) return true;
    return body.subarray(0, 16).toString('utf8').includes('#EXTM3U');
  }

  /** Serve the master playlist for a ref (rewritten to go through the proxy). */
  async proxyManifest(ref: string, res: Response): Promise<void> {
    const entry = this.cache.get(ref);
    if (!entry || entry.expiresAt < Date.now()) {
      res.status(404).send('Broadcast stream not ready');
      return;
    }
    await this.serveUrl(entry.upstreamUrl, ref, res);
  }

  /** Serve a nested playlist or media segment requested via ?src=. */
  async proxyHls(ref: string, src: string, res: Response): Promise<void> {
    if (!this.isAllowedUrl(src)) {
      res.status(400).send('Invalid stream URL');
      return;
    }
    await this.serveUrl(src, ref, res);
  }

  /** Serve proxied iframe player HTML (Kick embed only for esports). */
  async proxyEmbed(
    ref: string,
    res: Response,
    requestHost?: string,
    muted = true,
  ): Promise<void> {
    const entry = this.embedCache.get(ref);
    if (!entry || entry.expiresAt < Date.now()) {
      res.status(404).send('Stream not ready');
      return;
    }
    if (!this.isAllowedUrl(entry.upstreamUrl)) {
      res.status(400).send('Invalid stream URL');
      return;
    }

    if (isKickPlayerUrl(entry.upstreamUrl)) {
      const channel = extractKickChannelFromPlayerUrl(entry.upstreamUrl);
      const playerUrl = channel
        ? buildKickPlayerUrl(channel, requestHost, muted)
        : entry.upstreamUrl;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      res.send(buildKickEmbedPage(playerUrl, muted));
      return;
    }

    const headers = await this.buildHeaders(entry.upstreamUrl);
    if (!headers) {
      res.status(503).send('Stream auth not configured');
      return;
    }

    try {
      const upstream = await fetch(entry.upstreamUrl, { headers });
      if (!upstream.ok) {
        res.status(upstream.status).send('Failed to load stream');
        return;
      }
      const contentType = upstream.headers.get('content-type') ?? 'text/html; charset=utf-8';
      let body = await upstream.text();
      if (/dmdvw\.live|sportboom|almastream/i.test(entry.upstreamUrl)) {
        body = rewriteTwitchParentsInHtml(body, requestHost, muted);
      }
      // Sportboom/dmdvw player HTML uses root-relative /js /css — point them at CDN.
      body = rewriteEmbedRelativeAssets(body, entry.upstreamUrl);
      const hlsFromEmbed = extractEmbedHlsUrl(body);
      if (hlsFromEmbed && this.isAllowedUrl(hlsFromEmbed)) {
        this.rememberUpstream(ref, hlsFromEmbed);
        body = rewriteEmbedHlsToProxy(body, ref);
      }
      if (muted && /<video\b/i.test(body) && !/\bmuted\b/i.test(body)) {
        body = body.replace(/<video\b/i, '<video muted');
      }
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      res.send(body);
    } catch (err) {
      this.logger.warn(`Embed proxy failed: ${(err as Error).message}`);
      res.status(502).send('Stream proxy error');
    }
  }

  private async serveUrl(url: string, ref: string, res: Response): Promise<void> {
    const headers = await this.buildHeaders(url);
    if (!headers) {
      res.status(503).send('Broadcast auth not configured');
      return;
    }

    try {
      const upstream = await fetch(url, { headers });
      if (!upstream.ok) {
        this.logger.warn(`Broadcast upstream ${upstream.status} for ${ref}`);
        res.status(upstream.status).send('Failed to load stream');
        return;
      }

      const contentType = upstream.headers.get('content-type');
      const body = Buffer.from(await upstream.arrayBuffer());

      if (this.looksLikePlaylist(contentType, body)) {
        const rewritten = this.rewritePlaylist(body.toString('utf8'), url, ref);
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-store');
        res.send(rewritten);
        return;
      }

      if (contentType) res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'no-store');
      res.send(body);
    } catch (err) {
      this.logger.warn(`Broadcast proxy failed: ${(err as Error).message}`);
      res.status(502).send('Broadcast proxy error');
    }
  }
}
