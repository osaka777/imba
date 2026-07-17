import { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { WcMatchPage } from "~/entities/wc-odds/ui/WcMatchPage";
import {
  isLegacyWcEventId,
  makeWcGameMetadata,
  stripLegacyHashFromSlug,
} from "~/entities/wc-odds/lib/wcSlug";
import { makeMetadata } from "~/shared/lib";
import { LOCALE_STORAGE_KEY, isAppLocale } from "~/shared/i18n/locale";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

async function resolveLocaleHeader(): Promise<string> {
  try {
    const jar = await cookies();
    const raw = jar.get(LOCALE_STORAGE_KEY)?.value;
    if (isAppLocale(raw)) return raw;
  } catch {
    // ignore
  }
  return "ru";
}

async function fetchWcEvent(ref: string, options?: { sync?: boolean }) {
  const host =
    process.env.BACKEND_URL
    || process.env.BACKEND_INTERNAL_URL
    || process.env.NEXT_PUBLIC_HOST
    || "http://localhost:3000";
  const locale = await resolveLocaleHeader();
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
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const event = await fetchWcEvent(slug);
    if (event?.slug) return makeWcGameMetadata(event);
  } catch {
    /* ignore */
  }
  return makeMetadata("Матч ЧМ");
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  // Fast SSR: cache only — client sync unlocks bettable odds.
  const event = await fetchWcEvent(slug);

  if (!event) {
    notFound();
  }

  const cleanSlug = stripLegacyHashFromSlug(slug);
  if (slug !== event.slug || isLegacyWcEventId(slug) || cleanSlug !== event.slug) {
    redirect(`/wc/game/${event.slug}`);
  }

  return <WcMatchPage slug={event.slug} initialData={event} />;
}
