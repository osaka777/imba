import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { WcMatchPage } from "~/entities/wc-odds/ui/WcMatchPage";
import {
  isLegacyWcEventId,
  makeWcGameMetadata,
  stripLegacyHashFromSlug,
} from "~/entities/wc-odds/lib/wcSlug";
import { makeMetadata } from "~/shared/lib";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

async function fetchWcEvent(ref: string) {
  const host = process.env.NEXT_PUBLIC_HOST || "http://localhost:3000";
  const res = await fetch(`${host}/api/feed/events/${encodeURIComponent(ref)}`, {
    cache: "no-store",
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
