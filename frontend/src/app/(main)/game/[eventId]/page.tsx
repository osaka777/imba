import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { Match } from "~/entities/game/ui/Match";
import { getSubGameData } from "~/entities/game/api/getSubGames";
import { WcMatchPage } from "~/entities/wc-odds/ui/WcMatchPage";
import {
  fetchWcEventByRef,
  isLegacyWcEventId,
  isOlimpbetGameRef,
  makeWcGameMetadata,
  resolveReadableWcSlug,
  stripLegacyHashFromSlug,
} from "~/entities/wc-odds/lib/wcSlug";
import { api } from "~/shared/api";
import { makeMetadata } from "~/shared/lib";
import { makeSeoMetadata, resolveRequestLocale } from "~/shared/i18n/seo-metadata";
import { translate } from "~/shared/i18n/messages";

type PageProps = {
  params: Promise<{ eventId: string }>;
};

export const dynamic = "force-dynamic";

async function loadBetApiGame(eventId: string) {
  try {
    const { data, response } = await api.GET("/api/game/{eventId}", {
      cache: "no-cache",
      params: { path: { eventId } },
    });

    if (response.ok && data) {
      return { data, isSubGame: false as const };
    }
  } catch (error) {
    console.log(`[loadGameData] Failed to load as main game: ${eventId}`, error);
  }

  const gameId = Number.parseInt(eventId, 10);
  if (Number.isNaN(gameId)) {
    throw new Error(`Invalid gameId: ${eventId}`);
  }

  const subGameData = await getSubGameData(gameId);
  return { data: subGameData, isSubGame: true as const };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { eventId } = await params;

  if (/^cyber-\d+$/i.test(decodeURIComponent(eventId))) {
    return makeSeoMetadata("common.seoMatch");
  }

  if (isOlimpbetGameRef(eventId)) {
    try {
      const event = await fetchWcEventByRef(eventId);
      if (event) {
        return makeWcGameMetadata({ ...event, slug: resolveReadableWcSlug(event) });
      }
    } catch {
      /* ignore */
    }
    return makeSeoMetadata("common.seoMatch");
  }

  try {
    const { data } = await loadBetApiGame(eventId);
    return makeMetadata(data?.eventName);
  } catch {
    return makeSeoMetadata("common.seoGame");
  }
}

export default async function MatchPage({ params }: PageProps) {
  const { eventId } = await params;

  // Legacy / coupon links may still point at /game/cyber-* — send them to the
  // dedicated 1win cybersport match page (not the Olimpbet WC feed).
  if (/^cyber-\d+$/i.test(decodeURIComponent(eventId))) {
    redirect(`/cybersport/game/${encodeURIComponent(eventId)}`);
  }

  if (isOlimpbetGameRef(eventId)) {
    // Fast SSR from cache — markets unlock via WS focused oddsOnly refresh.
    const event = await fetchWcEventByRef(eventId);
    if (!event) {
      notFound();
    }

    const canonicalSlug = resolveReadableWcSlug(event);
    const cleanSlug = stripLegacyHashFromSlug(eventId);
    const normalizedEventId = decodeURIComponent(eventId).trim();
    if (
      normalizedEventId !== canonicalSlug
      || isLegacyWcEventId(normalizedEventId)
      || cleanSlug !== canonicalSlug
    ) {
      redirect(`/game/${encodeURIComponent(canonicalSlug)}`);
    }

    return <WcMatchPage slug={canonicalSlug} initialData={event} />;
  }

  try {
    const { data, isSubGame } = await loadBetApiGame(eventId);
    return <Match matchData={data} isSubGame={isSubGame} />;
  } catch (error) {
    console.error("[MatchPage] Error loading game data:", error);
    const locale = await resolveRequestLocale();
    return <div>{translate(locale, "common.gameNotFound")}</div>;
  }
}
