"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { LoadingScreen } from "~/shared/ui";
import { fetchWcEventDetail, type WcEventDetail } from "~/entities/wc-odds/api/client";
import { useWcBroadcast } from "~/entities/wc-odds/lib/WcBroadcastContext";
import { useWcOddsEventStream } from "~/entities/wc-odds/lib/useWcOddsStream";
import { WcScoreBoard } from "~/entities/wc-odds/ui/WcScoreBoard";
import { WcOddsSection } from "~/entities/wc-odds/ui/WcOddsSection";

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
};

export function WcMatchPage({ slug, initialData }: WcMatchPageProps) {
  const broadcast = useWcBroadcast();
  const register = broadcast?.register;
  const unregister = broadcast?.unregister;
  const openBroadcast = broadcast?.openBroadcast;
  const { event, connected, setEvent } = useWcOddsEventStream(slug, initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (connected || !slug) return undefined;

    let cancelled = false;
    const poll = async () => {
      try {
        const data = await fetchWcEventDetail(slug);
        if (!cancelled && data) setEvent(data);
      } catch {
        // ignore
      }
    };

    void poll();
    const id = window.setInterval(poll, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [connected, slug, setEvent]);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      if (initialData) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const data = await fetchWcEventDetail(slug);
        if (cancelled) return;
        if (!data) {
          setError("Матч не найден");
          setEvent(null);
          return;
        }
        setEvent(data);
      } catch {
        if (!cancelled) setError("Не удалось загрузить матч");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [slug, initialData, setEvent]);

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

  if (loading && !event) {
    return <LoadingScreen />;
  }

  if (error || !event) {
    return (
      <div className={matchStyles.err}>
        <p>{error || "Матч не найден"}</p>
        <Link href="/line/soccer" className="text-blue-400 underline mt-4 inline-block">
          Вернуться к линии
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

  return (
    <div className={`${matchStyles.Match} ${pageStyles.wcMatchPage}`}>
      <WcScoreBoard
        event={event}
        onBroadcastOpen={broadcastOpen}
        showBroadcastLink={showBroadcastBtn}
      />
      <section className={matchStyles.TournamentOdds}>
        <WcOddsSection event={event} />
      </section>
    </div>
  );
}
