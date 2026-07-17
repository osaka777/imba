"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { fetchCybersportGame, type CyberGame } from "~/entities/cybersport/api/client";
import {
  CYBER_API_SPORT_TO_PATH_SLUG,
  CYBER_SPORT_LABELS,
} from "~/entities/cybersport/lib/cyberDisciplineCatalog";
import {
  cyberGameSupportsWcBetting,
  cyberGameToWcEventDetail,
  readCyberWcMeta,
} from "~/entities/cybersport/lib/cyberGameToWcEvent";
import { maskCybersportLabel } from "~/entities/cybersport/lib/maskCybersportLabel";
import { fetchWcEventDetail, type WcEventDetail } from "~/entities/wc-odds/api/client";
import { useWcBroadcast } from "~/entities/wc-odds/lib/WcBroadcastContext";
import { mergeWcEventDetail } from "~/entities/wc-odds/lib/wcEventDetail";
import { useWcOddsEventStream } from "~/entities/wc-odds/lib/useWcOddsStream";
import { wcOddsFeedStore } from "~/entities/wc-odds/lib/wcOddsFeedStore";
import { WcOddsSection } from "~/entities/wc-odds/ui/WcOddsSection";
import { CyberStreamScoreBoard } from "~/entities/cybersport/ui/CyberStreamScoreBoard";
import { WcBroadcastPlayer } from "~/entities/wc-odds/ui/WcBroadcastPlayer";
import { OddsTable, type MarketDto } from "~/entities/game/ui/Match/OddsTable";
import { CyberStreamPlaceholder } from "~/entities/cybersport/ui/CyberStreamPlaceholder";
import kickStyles from "~/entities/cybersport/ui/CyberMatchPage.module.css";

import matchStyles from "~/entities/game/ui/Match/Match.module.css";
import pageStyles from "~/entities/wc-odds/ui/WcMatchPage.module.css";

function CyberOddsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Загрузка коэффициентов" className={kickStyles.oddsSkeleton}>
      <div className={kickStyles.oddsSkeletonPinned}>
        <div className={kickStyles.oddsSkeletonChip} />
        <div className={kickStyles.oddsSkeletonChip} />
      </div>
      {[0, 1, 2].map((i) => (
        <div className={kickStyles.oddsSkeletonBlock} key={i}>
          <div className={kickStyles.oddsSkeletonHead} />
          <div className={kickStyles.oddsSkeletonRow} />
          <div className={kickStyles.oddsSkeletonRow} />
        </div>
      ))}
    </div>
  );
}

type CyberMatchPageProps = {
  eventId: string;
  initialData: CyberGame;
  initialWcEvent?: WcEventDetail | null;
};

function maskGame(game: CyberGame): CyberGame {
  return {
    ...game,
    leagueName: maskCybersportLabel(game.leagueName),
    team1: maskCybersportLabel(game.team1),
    team2: maskCybersportLabel(game.team2),
    eventName: maskCybersportLabel(game.eventName),
  };
}

function isCyberLive(game: CyberGame): boolean {
  return (
    game.status === "IN_PROGRESS"
    || game.status === "LIVE"
    || game.status === "IN_PLAY"
    || game.status === "STARTING"
  );
}

function broadcastMeta(game: CyberGame) {
  return {
    homeTeam: game.team1 ?? "",
    awayTeam: game.team2 ?? "",
    leagueName: game.leagueName ?? "",
    homeTeamIcon: game.team1Icon ?? null,
    awayTeamIcon: game.team2Icon ?? null,
  };
}

export function CyberMatchPage({ eventId, initialData, initialWcEvent = null }: CyberMatchPageProps) {
  const [game, setGame] = useState<CyberGame>(() => maskGame(initialData));
  const isLive = isCyberLive(game);
  const isFinished = game.status === "FINISHED" || game.status === "CANCELED";
  const wcMeta = readCyberWcMeta(game);
  const wcRef = wcMeta.wcEventRef ?? "";
  const useWcOdds = cyberGameSupportsWcBetting(game);
  const broadcast = useWcBroadcast();
  const register = broadcast?.register;
  const release = broadcast?.release;
  const openBroadcast = broadcast?.openBroadcast;

  const { event: wcEvent, connected, setEvent } = useWcOddsEventStream(
    useWcOdds ? wcRef : "",
    initialWcEvent,
  );
  const [wcLoading, setWcLoading] = useState(useWcOdds && !initialWcEvent);

  const hasBroadcast = useMemo(() => {
    if (wcEvent?.hasBroadcast) return true;
    const meta = readCyberWcMeta(game);
    return Boolean(
      meta.wcHasBroadcast
      || meta.hasBroadcast
      || (game.meta as { hasBroadcast?: boolean } | undefined)?.hasBroadcast,
    );
  }, [game, wcEvent?.hasBroadcast]);

  const scoreboardEvent = useMemo(() => {
    const base = cyberGameToWcEventDetail(game);
    return { ...base, hasBroadcast: hasBroadcast || base.hasBroadcast };
  }, [game, hasBroadcast]);

  useEffect(() => {
    let cancelled = false;
    const pollMs = isLive ? 5_000 : 15_000;

    const poll = async () => {
      try {
        const fresh = await fetchCybersportGame(eventId);
        if (!cancelled && fresh) {
          setGame(maskGame(fresh));
        }
      } catch {
        /* ignore transient poll errors */
      }
    };

    void poll();
    const id = window.setInterval(poll, pollMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [eventId, isLive]);

  useEffect(() => {
    if (!useWcOdds || !wcRef) {
      setWcLoading(false);
      return undefined;
    }

    let cancelled = false;

    const bootstrap = async () => {
      setWcLoading(true);
      try {
        const data = await fetchWcEventDetail(wcRef);
        if (!cancelled && data) setEvent(data);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setWcLoading(false);
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [useWcOdds, wcRef, setEvent]);

  useEffect(() => {
    if (!useWcOdds || connected || !wcRef) return undefined;

    let cancelled = false;
    const pollMs = isLive ? 5_000 : 15_000;

    const poll = async () => {
      try {
        const data = await fetchWcEventDetail(wcRef);
        if (!cancelled && data) {
          const prev = wcOddsFeedStore.getEventDetail(wcRef);
          setEvent(prev ? mergeWcEventDetail(prev, data) : data);
        }
      } catch {
        /* ignore */
      }
    };

    void poll();
    const id = window.setInterval(poll, pollMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [connected, isLive, setEvent, useWcOdds, wcRef]);

  useEffect(() => {
    if (!register || !hasBroadcast || !wcRef) return;
    register(wcRef, true, broadcastMeta(game));
  }, [
    game.leagueName,
    game.team1,
    game.team2,
    hasBroadcast,
    register,
    wcRef,
  ]);

  useEffect(() => () => release?.(), [release]);

  const marketEntries = useMemo(() => {
    const grouped = game.groupedMarkets ?? {};
    return Object.entries(grouped) as [string, MarketDto[]][];
  }, [game.groupedMarkets]);

  const prematchMarketEntries = useMemo(
    () =>
      marketEntries.filter(([, markets]) =>
        markets.some((market) => (market.cf ?? 0) > 1),
      ),
    [marketEntries],
  );

  const eventName = game.eventName || `${game.team1} — ${game.team2}`;

  const shouldShowLegacyNoMarkets =
    !useWcOdds
    && (marketEntries.length === 0
      || game.status === "FINISHED"
      || game.status === "CANCELED");

  const displayWcEvent = useMemo(() => {
    if (!wcEvent) return null;
    return {
      ...wcEvent,
      parsedScore: game.parsedScore ?? wcEvent.parsedScore,
      homeTeamIcon: game.team1Icon ?? wcEvent.homeTeamIcon,
      awayTeamIcon: game.team2Icon ?? wcEvent.awayTeamIcon,
      homeTeam: game.team1 ?? wcEvent.homeTeam,
      awayTeam: game.team2 ?? wcEvent.awayTeam,
      hasBroadcast: hasBroadcast || wcEvent.hasBroadcast,
    };
  }, [game, hasBroadcast, wcEvent]);

  const wcHasTradableOdds = Boolean(
    displayWcEvent
    && (
      (displayWcEvent.oddsHome ?? 0) > 1
      || (displayWcEvent.oddsAway ?? 0) > 1
      || (displayWcEvent.oddsDraw ?? 0) > 1
    ),
  );

  // Keep markets on screen (locked) while Olimpbet suspends trading between rounds.
  const wcHasAnyMarkets = Boolean(
    displayWcEvent
    && Object.keys(displayWcEvent.groupedMarkets ?? {}).length > 0,
  );
  const showWcMarkets = wcHasTradableOdds || wcHasAnyMarkets;

  const showPrematchFallback = useWcOdds && prematchMarketEntries.length > 0 && !showWcMarkets;

  const showInlineStream = hasBroadcast && Boolean(wcRef);

  const gameSport = (game as { sport?: string }).sport ?? "";
  const disciplineSlug = CYBER_API_SPORT_TO_PATH_SLUG[gameSport];
  const disciplineLabel = CYBER_SPORT_LABELS[gameSport];
  const breadcrumbMatch =
    game.team1 && game.team2 ? `${game.team1} — ${game.team2}` : eventName;
  const mobileBackHref = disciplineSlug
    ? `/cybersport/${disciplineSlug}`
    : "/cybersport";
  const mobileBackLabel = disciplineLabel ?? "Киберспорт";

  const showBroadcastBtn =
    !showInlineStream && hasBroadcast && Boolean(broadcast) && !broadcast?.visible;

  const broadcastOpen = () => {
    if (!openBroadcast || !hasBroadcast || !wcRef) return;
    openBroadcast(wcRef, true, broadcastMeta(game));
  };

  const oddsContent = (
    <>
        {useWcOdds ? (
          wcLoading && !displayWcEvent && !showPrematchFallback ? (
            <CyberOddsSkeleton />
          ) : displayWcEvent && showWcMarkets ? (
            <WcOddsSection event={displayWcEvent} layout="stack" />
          ) : showPrematchFallback ? (
            <div className={matchStyles.oddsTables}>
              {isLive ? (
                <p className={kickStyles.prematchNote}>
                  Prematch · live-рынки откроются у поставщика чуть позже
                </p>
              ) : null}
              <div className={matchStyles.oddsTable}>
                {prematchMarketEntries.map(([name, data]) => (
                  <OddsTable
                    eventId={game.eventId}
                    eventName={eventName}
                    isLive={false}
                    isParentExpanded
                    key={name}
                    markets={data}
                    name={name === "WIN" ? "Победитель" : name}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className={kickStyles.emptyState}>
              <h3 className={kickStyles.emptyTitle}>
                {isLive ? "Live-коэффициенты обновляются" : "Коэффициенты временно недоступны"}
              </h3>
              <p className={kickStyles.emptyHint}>
                {isLive
                  ? "Рынки на live-матч ещё не открыты у поставщика линии. Проверьте prematch или обновите страницу через минуту."
                  : "Попробуйте обновить страницу чуть позже — линия синхронизируется автоматически."}
              </p>
            </div>
          )
        ) : shouldShowLegacyNoMarkets ? (
          <h3 className={kickStyles.closedTitle}>
            {game.status === "FINISHED" || game.status === "CANCELED"
              ? "Ставки закрыты"
              : "Ставок больше нет"}
          </h3>
        ) : (
          <div className={matchStyles.oddsTables}>
            <div className={matchStyles.oddsTable}>
              {marketEntries.map(([name, data]) => (
                <OddsTable
                  eventId={game.eventId}
                  eventName={eventName}
                  isLive={isLive}
                  isParentExpanded
                  key={name}
                  markets={data}
                  name={name === "WIN" ? "Победитель" : name}
                />
              ))}
            </div>
          </div>
        )}
    </>
  );

  return (
    <div className={kickStyles.page}>
      <Link className={kickStyles.mobileBack} href={mobileBackHref}>
        <span aria-hidden className={kickStyles.mobileBackArrow}>←</span>
        <span className={kickStyles.mobileBackText}>
          {mobileBackLabel}
          <span className={kickStyles.mobileBackDot}> · </span>
          {breadcrumbMatch}
        </span>
      </Link>
      <nav aria-label="Хлебные крошки" className={kickStyles.breadcrumbs}>
        <Link className={kickStyles.breadcrumbLink} href="/cybersport">
          Киберспорт
        </Link>
        {disciplineSlug && disciplineLabel ? (
          <>
            <span aria-hidden className={kickStyles.breadcrumbSep}>/</span>
            <Link className={kickStyles.breadcrumbLink} href={`/cybersport/${disciplineSlug}`}>
              {disciplineLabel}
            </Link>
          </>
        ) : null}
        <span aria-hidden className={kickStyles.breadcrumbSep}>/</span>
        <span className={kickStyles.breadcrumbCurrent}>{breadcrumbMatch}</span>
      </nav>
      <div className={`${matchStyles.Match} ${pageStyles.wcMatchPage} ${kickStyles.matchRoot}`}>
        <div className={kickStyles.matchShell}>
          <div className={kickStyles.streamCol}>
            <div className={kickStyles.streamFrame} data-cyber-stream-frame="true">
              {showInlineStream && !isFinished ? (
                <WcBroadcastPlayer
                  eventRef={wcRef}
                  hasBroadcast
                  meta={broadcastMeta(game)}
                  onFullscreen={broadcastOpen}
                  showFullscreen={Boolean(broadcast)}
                  sport={gameSport}
                  variant="default"
                />
              ) : (
                <CyberStreamPlaceholder
                  game={game}
                  isFinished={isFinished}
                  isLive={isLive}
                />
              )}
            </div>
            <div className={kickStyles.scoreStrip}>
              <CyberStreamScoreBoard
                event={scoreboardEvent}
                onBroadcastOpen={broadcastOpen}
                showBroadcastLink={showBroadcastBtn}
              />
            </div>
          </div>

          <div className={kickStyles.oddsCol} data-cyber-odds-col>
            <div className={kickStyles.oddsHead}>
              <span
                className={`${kickStyles.oddsHeadPill} ${!isLive ? kickStyles.oddsHeadPill_muted : ""}`}
              >
                {isLive ? "LIVE" : "ЛИНИЯ"}
              </span>
              <h2 className={kickStyles.oddsHeadTitle}>Ставки</h2>
            </div>
            <section className={`${matchStyles.TournamentOdds} ${kickStyles.oddsSection}`}>
              {oddsContent}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
