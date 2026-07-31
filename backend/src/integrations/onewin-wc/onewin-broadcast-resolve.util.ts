import type { OneWinHttpClient } from './onewin-http.client';
import type { OneWinBroadcastPayload } from './onewin-wc.types';

function extractEmbedHlsUrl(html: string): null | string {
  const fromDataSource =
    /data-source=["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i.exec(html)?.[1] ??
    /data-src=["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i.exec(html)?.[1] ??
    null;
  if (fromDataSource) return fromDataSource;
  return /https?:\/\/[^"'\\\s>]+\.m3u8[^"'\\\s>]*/i.exec(html)?.[0] ?? null;
}

/** 1win sportplayer often wraps Kick/Twitch instead of HLS (common for CS). */
function extractNestedPlayerUrl(html: string): null | string {
  const kick =
    /(?:src|data-src)=["'](https?:\/\/(?:www\.)?player\.kick\.com\/[^"']+)["']/i.exec(
      html,
    )?.[1] ??
    /https?:\/\/(?:www\.)?player\.kick\.com\/[a-z0-9_]+[^"'\\\s>]*/i.exec(
      html,
    )?.[0] ??
    null;
  if (kick) return kick;

  const twitch =
    /(?:src|data-src)=["'](https?:\/\/(?:www\.)?player\.twitch\.tv\/\?[^"']+)["']/i.exec(
      html,
    )?.[1] ??
    /https?:\/\/(?:www\.)?player\.twitch\.tv\/\?[^"'\\\s>]*/i.exec(html)?.[0] ??
    null;
  return twitch;
}

function decodeSportplayerEmbedUrl(topParserUrl: string): null | string {
  try {
    const url = new URL(topParserUrl);
    const ref = url.searchParams.get('ref');
    if (!ref) return null;
    // top-parser base64url-encodes the nested sportplayer.io embed URL.
    const b64 = ref.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(b64, 'base64').toString('utf8');
    return /^https?:\/\//.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

function decodeDirectM3u8Ref(topParserUrl: string): null | string {
  try {
    const url = new URL(topParserUrl);
    const ref = url.searchParams.get('ref');
    if (!ref) return null;
    const decoded = decodeURIComponent(ref);
    return decoded.includes('.m3u8') ? decoded : null;
  } catch {
    return null;
  }
}

/**
 * Resolve a `broadcast.url` value from the 1win push-server snapshot into a
 * stream our own proxy can actually play. Providers observed in the wild:
 *  - `.../sm/iframe?ref=<base64 sportplayer.io embed>` — fetch the embed HTML
 *    and pull HLS, or a nested Kick/Twitch player (common for cybersport).
 *    If HLS scrape fails, fall back to the decoded sportplayer embed as iframe.
 *  - `.../maxline/iframe?ref=<urlencoded m3u8|soft4game>` — soft4game CDN needs
 *    a `wmsAuthSign` token from `/maxline/sign`. Unsigned `.m3u8` returns 403,
 *    so we serve the maxline iframe itself (player fetches the sign).
 * Anything else (`gt/iframe`, unknown ids) is reported unavailable rather
 * than guessed at.
 */
export async function resolveOneWinBroadcastUrl(
  http: OneWinHttpClient,
  broadcastUrl: string,
): Promise<OneWinBroadcastPayload> {
  const sportplayerEmbed = decodeSportplayerEmbedUrl(broadcastUrl);
  if (sportplayerEmbed) {
    const html = await http.fetchText(sportplayerEmbed, {
      Referer: 'https://1win.pro/',
    });
    const hls = html ? extractEmbedHlsUrl(html) : null;
    if (hls) {
      return { available: true, streamType: 'hls', streamUrl: hls };
    }

    // Cybersport feeds often nest Kick/Twitch inside sportplayer (no m3u8).
    // Serving the outer embed as iframe → Kick without parent → black screen.
    const nested = html ? extractNestedPlayerUrl(html) : null;
    if (nested) {
      return { available: true, streamType: 'iframe', streamUrl: nested };
    }

    // Embed page sometimes omits data-source (geo / cold start) — still
    // playable as a nested iframe through our /view proxy.
    return {
      available: true,
      streamType: 'iframe',
      streamUrl: sportplayerEmbed,
    };
  }

  // Maxline player page signs soft4game HLS itself — do not unwrap to bare m3u8.
  if (/\/maxline\/iframe/i.test(broadcastUrl)) {
    const signed = await trySignMaxlineM3u8(http, broadcastUrl);
    if (signed) {
      return { available: true, streamType: 'hls', streamUrl: signed };
    }
    return {
      available: true,
      streamType: 'iframe',
      streamUrl: broadcastUrl,
    };
  }

  const directM3u8 = decodeDirectM3u8Ref(broadcastUrl);
  if (directM3u8) {
    return { available: true, streamType: 'hls', streamUrl: directM3u8 };
  }

  return { available: false, streamType: null, streamUrl: null };
}

/** Append `wmsAuthSign` from top-parser maxline sign endpoint when available. */
async function trySignMaxlineM3u8(
  http: OneWinHttpClient,
  maxlineIframeUrl: string,
): Promise<null | string> {
  const bare = decodeDirectM3u8Ref(maxlineIframeUrl);
  if (!bare || !/soft4game\.com/i.test(bare)) return null;

  try {
    const signUrl = new URL(
      'https://video-translations.top-parser.com/maxline/sign',
    );
    // Some deployments expect the stream path as a query hint.
    try {
      const ref = new URL(maxlineIframeUrl).searchParams.get('ref');
      if (ref) signUrl.searchParams.set('ref', ref);
    } catch {
      /* ignore */
    }

    const raw = await http.fetchText(signUrl.toString(), {
      Referer: 'https://1win.pro/',
      Accept: 'application/json, text/plain, */*',
    });
    if (!raw) return null;

    let token: string | null = null;
    try {
      const parsed = JSON.parse(raw) as {
        sign?: string;
        token?: string;
        wmsAuthSign?: string;
      };
      token =
        parsed.wmsAuthSign || parsed.sign || parsed.token || null;
    } catch {
      const trimmed = raw.trim().replace(/^"|"$/g, '');
      if (trimmed && !trimmed.startsWith('<') && trimmed.length < 500) {
        token = trimmed;
      }
    }
    if (!token) return null;

    const out = new URL(bare);
    if (!out.searchParams.has('wmsAuthSign')) {
      out.searchParams.set('wmsAuthSign', token);
    }
    return out.toString();
  } catch {
    return null;
  }
}
