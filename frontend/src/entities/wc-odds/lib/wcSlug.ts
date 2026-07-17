import type { Metadata } from "next";

const EVENT_ID_RE = /^[a-f0-9]{32}$/i;

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  ә: "a", ғ: "g", қ: "q", ң: "n", ө: "o", ұ: "u", ü: "u", ү: "u", һ: "h", і: "i",
};

export function transliterateSlugText(value: string): string {
  let result = "";
  for (const char of value.normalize("NFC")) {
    const lower = char.toLowerCase();
    if (CYRILLIC_TO_LATIN[lower] != null) {
      result += CYRILLIC_TO_LATIN[lower];
      continue;
    }
    result += char;
  }
  return result;
}

export function slugifyTeam(name: string): string {
  return transliterateSlugText(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function baseWcGameSlug(homeTeam: string, awayTeam: string): string {
  const home = slugifyTeam(homeTeam);
  const away = slugifyTeam(awayTeam);
  if (!home && !away) return "match";
  if (!home) return `${away}-vs-team`;
  if (!away) return `${home}-vs-team`;
  return `${home}-vs-${away}`;
}

/** @deprecated use resolveReadableWcSlug */
export function buildWcGameSlug(homeTeam: string, awayTeam: string, _eventId?: string): string {
  return baseWcGameSlug(homeTeam, awayTeam);
}

export function isBrokenWcSlug(slug: string | null | undefined): boolean {
  if (!slug?.trim()) return true;

  const normalized = slug.trim().toLowerCase();
  const match = /^(.+)-vs-(.+)$/.exec(normalized);
  if (!match) return normalized.includes("-vs-");

  const home = match[1].replace(/^-+|-+$/g, "");
  const away = match[2]
    .replace(/-\d{2}-\d{2}$/, "")
    .replace(/-\d+$/, "")
    .replace(/^-+|-+$/g, "");

  if (home.length === 0 || away.length === 0) return true;
  if (/^\d+$/.test(home) && /^\d+$/.test(away)) return true;

  return false;
}

export function resolveReadableWcSlug(event: {
  slug?: string | null;
  id: string;
  homeTeam: string;
  awayTeam: string;
}): string {
  if (event.slug && !isBrokenWcSlug(event.slug)) return event.slug;

  const base = baseWcGameSlug(event.homeTeam, event.awayTeam);
  const suffix = event.id.replace(/^ol-/, "");
  return `${base}-${suffix}`;
}

export function isLegacyWcEventId(ref: string): boolean {
  return EVENT_ID_RE.test(decodeURIComponent(ref));
}

export function stripLegacyHashFromSlug(slug: string): string {
  return slug.replace(/-[a-f0-9]{32}$/i, "");
}

/** Feed events (slug / masked id) vs numeric BetAPI event ids. */
export function isOlimpbetGameRef(ref: string): boolean {
  const decoded = decodeURIComponent(ref);
  if (isLegacyWcEventId(decoded)) return true;
  if (/^\d+$/.test(decoded)) return false;
  if (/^m[a-z0-9]+$/i.test(decoded)) return true;
  if (/^ol-\d+$/i.test(decoded)) return true;
  return /[a-z-]/i.test(decoded);
}

export function buildWcGameHref(event: {
  slug?: string | null;
  id: string;
  homeTeam: string;
  awayTeam: string;
}): string {
  return `/game/${resolveReadableWcSlug(event)}`;
}

export function makeWcGameMetadata(event: {
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  slug: string;
  leagueName?: string;
}): Metadata {
  const host = process.env.NEXT_PUBLIC_HOST || "https://imba.bet";
  const canonical = `${host}/game/${event.slug}`;
  const leaguePart = event.leagueName ? ` | ${event.leagueName}` : "";
  const title = `${event.homeTeam} — ${event.awayTeam}${leaguePart} | Imba.bet`;
  const description = `Ставки на матч ${event.homeTeam} — ${event.awayTeam}. Коэффициенты, тоталы и исходы на Imba.bet.`;

  return {
    title: { absolute: title },
    description,
    keywords: [
      event.homeTeam,
      event.awayTeam,
      event.leagueName ?? "ставки",
      "линия",
      "лайв",
      "imba.bet",
    ]
      .filter(Boolean)
      .join(", "),
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
      siteName: "Imba.bet",
    },
  };
}

import { cache } from "react";

/** Server-side: hit backend directly. Browser: same-origin public host. */
function feedApiHost(): string {
  if (typeof window === "undefined") {
    return (
      process.env.BACKEND_URL
      || process.env.BACKEND_INTERNAL_URL
      || process.env.NEXT_PUBLIC_HOST
      || "http://localhost:3000"
    );
  }
  return process.env.NEXT_PUBLIC_HOST || window.location.origin;
}

export const fetchWcEventByRef = cache(async function fetchWcEventByRef(
  ref: string,
  options?: { sync?: boolean },
) {
  const host = feedApiHost();
  let locale = "ru";
  try {
    const { cookies } = await import("next/headers");
    const jar = await cookies();
    const raw = jar.get("imba_locale")?.value;
    if (raw === "en" || raw === "ru") locale = raw;
  } catch {
    // SSR cookie unavailable in some contexts
  }
  const q = options?.sync ? "?sync=1" : "";
  const res = await fetch(`${host}/api/feed/events/${encodeURIComponent(ref)}${q}`, {
    cache: "no-store",
    headers: {
      "X-Locale": locale,
      "Accept-Language": locale,
    },
  });
  if (!res.ok) return null;
  return res.json();
});
