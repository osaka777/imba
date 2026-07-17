"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { LoadingScreen } from "~/shared/ui";
import { fetchWcEventDetail, type WcEventDetail } from "~/entities/wc-odds/api/client";
import { mergeWcEventDetail } from "~/entities/wc-odds/lib/wcEventDetail";
import { useWcBroadcast } from "~/entities/wc-odds/lib/WcBroadcastContext";
import { useWcOddsEventStream } from "~/entities/wc-odds/lib/useWcOddsStream";
import { wcOddsFeedStore } from "~/entities/wc-odds/lib/wcOddsFeedStore";
import { useLocale } from "~/shared/model/useLocale";
import { WcScoreBoard } from "~/entities/wc-odds/ui/WcScoreBoard";
import { WcOddsSection } from "~/entities/wc-odds/ui/WcOddsSection";
import { WcMatchTelegramSubscribe } from "~/entities/wc-odds/ui/WcMatchTelegramSubscribe";

import matchStyles from "~/entities/game/ui/Match/Match.module.css";
import pageStyles from "~/entities/wc-odds/ui/WcMatchPage.module.css";

function broadcastMeta(event: WcEventDetail) {
  return {
    awayTeam: event.awayTeam,
    homeTeam: event.homeTeam,
    leagueName: event.leagueName,
  };
}

type WcMatchPageProps = {
  slug: string;
  initialData?: WcEventDetail | null;
  /** @deprecated kept for call-site compat */
  initialSynced?: boolean;
};

export function WcMatchPage({
  slug,
  initialData,
}: WcMatchPageProps) {
  const broadcast = useWcBroadcast();
  const register = broadcast?.register;
  const unregister = broadcast?.unregister;
  const openBroadcast = broadcast?.openBroadcast;
  const { locale, ready: localeReady, t } = useLocale();
  const { event, connected, setEvent, marketsReady } = useWcOddsEventStream(
    slug,
    initialData ?? null,
  );
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);

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

  if (loading && !event && !initialData) {
    return <LoadingScreen />;
  }

  if (error || !event) {
    return (
      <div className={matchStyles.err}>
        <p>{error || t("common.matchNotFound")}</p>
        <Link href="/line/soccer" className="text-blue-400 underline mt-4 inline-block">
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
      />
      <section className={matchStyles.TournamentOdds}>
        {event.completed || event.phase === "finished" ? (
          <div className={pageStyles.finishedState}>
            <strong>Матч завершён</strong>
            <span>Итоговый счёт, периоды и доступная статистика показаны выше.</span>
            <Link href="/results">Вернуться к результатам</Link>
          </div>
        ) : oddsUnlocked ? (
          <WcOddsSection event={event} />
        ) : (
          <div className={pageStyles.marketsSyncing} aria-busy="true">
            <div className={pageStyles.marketsSyncingBar} />
            <div className={pageStyles.marketsSyncingBar} />
            <div className={pageStyles.marketsSyncingBar} />
          </div>
        )}
      </section>
    </div>
  );
}
