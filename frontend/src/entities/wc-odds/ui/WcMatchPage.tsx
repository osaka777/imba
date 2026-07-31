"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import matchStyles from "~/entities/game/ui/Match/Match.module.css";
import { type WcEventDetail, fetchWcEventDetail } from "~/entities/wc-odds/api/client";
import { useWcBroadcast } from "~/entities/wc-odds/lib/WcBroadcastContext";
import { useWcLiveTrackerContext } from "~/entities/wc-odds/lib/WcLiveTrackerContext";
import { useWcLiveTracker } from "~/entities/wc-odds/lib/useWcLiveTracker";
import { useWcOddsEventStream } from "~/entities/wc-odds/lib/useWcOddsStream";
import { mergeWcEventDetail } from "~/entities/wc-odds/lib/wcEventDetail";
import { wcOddsFeedStore } from "~/entities/wc-odds/lib/wcOddsFeedStore";
import pageStyles from "~/entities/wc-odds/ui/WcMatchPage.module.css";
import { WcMatchTelegramSubscribe } from "~/entities/wc-odds/ui/WcMatchTelegramSubscribe";
import { WcOddsSection } from "~/entities/wc-odds/ui/WcOddsSection";
import { WcScoreBoard } from "~/entities/wc-odds/ui/WcScoreBoard";
import { useLocale } from "~/shared/model/useLocale";
import { LoadingScreen } from "~/shared/ui";

function broadcastMeta(event: WcEventDetail) {
  return {
    awayTeam: event.awayTeam,
    homeTeam: event.homeTeam,
    leagueName: event.leagueName,
  };
}

type WcMatchPageProps = {
  initialData?: WcEventDetail | null;
  /** @deprecated kept for call-site compat */
  initialSynced?: boolean;
  slug: string;
};

export function WcMatchPage({
  initialData,
  slug,
}: WcMatchPageProps) {
  const broadcast = useWcBroadcast();
  const register = broadcast?.register;
  const unregister = broadcast?.unregister;
  const openBroadcast = broadcast?.openBroadcast;
  const { locale, ready: localeReady, t } = useLocale();
  const { connected, event, marketsReady, setEvent } = useWcOddsEventStream(
    slug,
    initialData ?? null,
  );
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<null | string>(null);

  // Locale-aware labels only — does not gate betting.
  // Skip redundant HTTP when SSR already provided the event.
  useEffect(() => {
    if (!slug || !localeReady) return undefined;

    let cancelled = false;

    const bootstrap = async () => {
      setError(null);
      if (!initialData) setLoading(true);
      try {
        const data = await fetchWcEventDetail(slug);
        if (cancelled) return;
        if (!data) {
          if (!initialData) {
            setError(t("common.matchNotFound"));
            setEvent(null);
          }
          return;
        }
        const prev = wcOddsFeedStore.getEventDetail(slug);
        setEvent(prev ? mergeWcEventDetail(prev, data) : data);
        if (Object.keys(data.groupedMarkets ?? {}).length > 0) {
          wcOddsFeedStore.forceEventMarketsReady(slug);
        }
      } catch {
        if (!cancelled && !initialData) setError(t("common.matchLoadError"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (!initialData) {
      void bootstrap();
    } else {
      setLoading(false);
    }

    const onLocale = () => {
      void bootstrap();
    };
    window.addEventListener("localeChanged", onLocale);

    return () => {
      cancelled = true;
      window.removeEventListener("localeChanged", onLocale);
    };
  }, [slug, initialData, setEvent, locale, localeReady, t]);

  useEffect(() => {
    if (connected || !slug) return undefined;

    let cancelled = false;
    const pollMs = event?.phase === "live" ? 1000 : 3000;

    const poll = async () => {
      try {
        const data = await fetchWcEventDetail(slug);
        if (!cancelled && data) {
          const prev = wcOddsFeedStore.getEventDetail(slug);
          setEvent(prev ? mergeWcEventDetail(prev, data) : data);
          if (Object.keys(data.groupedMarkets ?? {}).length > 0) {
            wcOddsFeedStore.forceEventMarketsReady(slug);
          }
        }
      } catch {
        // ignore
      }
    };

    void poll();
    const id = window.setInterval(poll, pollMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [connected, slug, setEvent, event?.phase]);

  useEffect(() => {
    if (!register || !unregister) return undefined;

    if (!event?.hasBroadcast) {
      unregister();
      return () => unregister();
    }

    register(slug, true, broadcastMeta(event));

    return () => unregister();
  }, [slug, event?.hasBroadcast, register, unregister]);

  useEffect(() => {
    if (!register || !event?.hasBroadcast) return;
    register(slug, true, broadcastMeta(event));
  }, [slug, event?.awayTeam, event?.homeTeam, event?.leagueName, event?.hasBroadcast, register]);

  const trackerCtx = useWcLiveTrackerContext();
  // Pull the stable register/unregister fns out rather than depending on the
  // whole context value — that value's identity changes on every register()
  // call, which previously caused this effect to loop forever (register →
  // new context value → effect re-fires → unregister → register → ...).
  const trackerRegister = trackerCtx?.register;
  const trackerUnregister = trackerCtx?.unregister;
  const trackerUrl = useWcLiveTracker(event?.slug || slug, event?.phase === "live");

  useEffect(() => {
    if (!trackerRegister || !trackerUnregister) return undefined;
    if (!trackerUrl) {
      trackerUnregister(slug);
      return () => trackerUnregister(slug);
    }
    trackerRegister(slug, trackerUrl, event ? broadcastMeta(event) : undefined);
    return () => trackerUnregister(slug);
  }, [
    slug,
    trackerUrl,
    trackerRegister,
    trackerUnregister,
    event?.homeTeam,
    event?.awayTeam,
    event?.leagueName,
  ]);

  if (loading && !event && !initialData) {
    return <LoadingScreen />;
  }

  if (error || !event) {
    return (
      <div className={matchStyles.err}>
        <p>{error || t("common.matchNotFound")}</p>
        <Link className="text-blue-400 underline mt-4 inline-block" href="/line/soccer">
          {t("common.backToLine")}
        </Link>
      </div>
    );
  }

  const showBroadcastBtn =
    event.hasBroadcast && broadcast && !broadcast.visible;

  const broadcastOpen = () => {
    if (!openBroadcast || !event.hasBroadcast) return;
    openBroadcast(slug, true, broadcastMeta(event));
  };

  const hasMarkets = Object.keys(event.groupedMarkets ?? {}).length > 0;
  const oddsUnlocked = hasMarkets && (marketsReady || event.bettingOpen !== false);

  return (
    <div className={`${matchStyles.Match} ${pageStyles.wcMatchPage}`}>
      <WcScoreBoard
        event={event}
        onBroadcastOpen={broadcastOpen}
        showBroadcastLink={showBroadcastBtn}
        telegramAction={
          <WcMatchTelegramSubscribe eventRef={event.slug || slug} variant="meta" />
        }
        trackerUrl={trackerUrl}
      />
      <section className={matchStyles.TournamentOdds}>
        {event.completed || event.phase === "finished" ? (
          <div className={pageStyles.finishedState}>
            <strong>{t("wc.matchFinished")}</strong>
            <span>{t("wc.finishedHint")}</span>
            <Link href="/results">{t("wc.backToResults")}</Link>
          </div>
        ) : oddsUnlocked ? (
          <WcOddsSection event={event} />
        ) : (
          <div aria-busy="true" className={pageStyles.marketsSyncing}>
            <div className={pageStyles.marketsSyncingBar} />
            <div className={pageStyles.marketsSyncingBar} />
            <div className={pageStyles.marketsSyncingBar} />
          </div>
        )}
      </section>
    </div>
  );
}
