"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { components } from "~/shared/api";
import { formatWcCompactOdd } from "~/entities/wc-odds/lib/wcCompactFormat";
import { WcHomeOddCell } from "~/entities/wc-odds/ui/WcHomeOddCell";
import { WcTeamImage } from "~/entities/wc-odds/ui/WcTeamImage";
import {
  cyberGameSupportsWcBetting,
  cyberGameToWcEvent,
} from "~/entities/cybersport/lib/cyberGameToWcEvent";
import { useCyberRowMapOdds } from "~/entities/cybersport/hooks/useCyberRowMapOdds";
import { useCyberRowLiveWcEvent } from "~/entities/cybersport/hooks/useCyberRowLiveWcEvent";
import { isEsportsApiSport } from "~/entities/cybersport/lib/cyberDisciplineCatalog";
import { useWcBroadcast } from "~/entities/wc-odds/lib/WcBroadcastContext";
import { BroadcastIcon, FireIcon } from "~/shared/assets";
import { cn } from "~/shared/lib";
import { Game } from "~/entities/game/types";
import { SubGameDto } from "~/entities/game/ui/SubGames";
import { MatchFieldsRow } from "~/entities/game/ui/TournamentTable/MatchFieldsRow";
import { useMatchRow } from "~/entities/game/ui/TournamentTable/useMatchRow";

import styles from "./CyberMatchRow.module.css";
import {
  CyberRowMarketsLink,
  CyberRowQuickOddsCells,
} from "~/entities/cybersport/ui/CyberRowQuickOddsCells";

const ESPORTS_WINNER_FIELDS = ["WIN__P1", "WIN__P2"] as const;

const matchFields: Record<string, string[]> = {
  basketball: ["WIN_OT__P1", "WIN_RT__PX", "WIN_OT__P2"],
  hockey: ["WIN_RT__P1", "WIN_RT__PX", "WIN_RT__P2"],
  soccer: ["WIN__P1", "WIN__PX", "WIN__P2", "WIN__1X", "WIN__12", "WIN__X2"],
  "table-tennis": ["WIN__P1", "WIN__P2"],
  tennis: ["WIN__P1", "WIN__P2"],
  volleyball: ["WIN__P1", "WIN__P2"],
};

function fieldsForSport(sport: string): string[] | undefined {
  if (isEsportsApiSport(sport)) return [...ESPORTS_WINNER_FIELDS];
  return matchFields[sport];
}

type MatchRowProps = {
  isLive: boolean;
  gameLinkPrefix?: string;
  matchData: (components["schemas"]["GameDtoWithGroupedMarkets"] | Game) & {
    meta?: {
      raw_start_at?: string;
      betApiStatus?: number;
      betApiBody?: unknown[];
    };
    priority?: number;
    sport: string;
    status?: string;
    sub_games?: SubGameDto[];
    parsedScore?: components["schemas"]["GameDtoWithGroupedMarkets"]["parsedScore"];
    score?: string;
  };
};

function resolveSeriesScore(
  matchData: MatchRowProps["matchData"],
  score: ReturnType<typeof useMatchRow>["score"],
  isLive: boolean,
): string {
  const current =
    score?.currentScore
    ?? matchData.parsedScore?.currentScore;

  if (Array.isArray(current) && current.length >= 2) {
    return `${current[0]} : ${current[1]}`;
  }

  const textScore = score?.text?.currentScore ?? matchData.score?.trim();
  if (textScore) {
    return textScore.replace(":", " : ");
  }

  return isLive ? "0 : 0" : "VS";
}

function resolveMapScore(
  matchData: MatchRowProps["matchData"],
  score: ReturnType<typeof useMatchRow>["score"],
): { label: string; isLiveMap: boolean; seriesHint: string | null } | null {
  const parsed = score ?? matchData.parsedScore;

  if (Array.isArray(parsed?.details) && parsed.details.length > 0) {
    const last = parsed.details[parsed.details.length - 1] as [number, number];
    const mapIndex = parsed.details.length;
    const boHint = mapIndex >= 2 ? ` · BO${Math.min(5, mapIndex + 1)}` : "";
    return {
      label: `Map ${mapIndex} · ${last[0]}:${last[1]}${boHint}`,
      isLiveMap: true,
      seriesHint: null,
    };
  }

  const rawDetails = score?.text?.details;
  if (typeof rawDetails === "string" && rawDetails.trim()) {
    const cleaned = rawDetails.replace(/[()]/g, "").trim();
    const parts = cleaned.split(",").map((part) => part.trim()).filter(Boolean);
    if (parts.length > 0) {
      const lastPart = parts[parts.length - 1];
      return {
        label: `Map ${parts.length} · ${lastPart}`,
        isLiveMap: parts.length > 0,
        seriesHint: null,
      };
    }
  }

  if (score?.text?.time) {
    return { label: score.text.time, isLiveMap: false, seriesHint: null };
  }

  return null;
}

export const CyberMatchRow: React.FC<MatchRowProps> = ({
  isLive,
  gameLinkPrefix = "/game/",
  matchData,
}) => {
  const { markets, marketsCount, score } = useMatchRow(matchData);
  const broadcast = useWcBroadcast();
  const router = useRouter();

  const wcEventBase = useMemo(
    () => (cyberGameSupportsWcBetting(matchData) ? cyberGameToWcEvent(matchData) : null),
    [matchData],
  );
  const wcEvent = useCyberRowLiveWcEvent(wcEventBase, isLive);

  const isTwoWayWc = Boolean(wcEvent && wcEvent.oddsDraw == null);
  const wcHasLiveOdds = Boolean(
    wcEvent
    && (
      (wcEvent.oddsHome ?? 0) > 1
      || (wcEvent.oddsAway ?? 0) > 1
      || (wcEvent.oddsDraw ?? 0) > 1
    ),
  );
  const hasPrematchOdds = Boolean(
    fieldsForSport(matchData.sport)?.some((field) => (markets?.[field]?.cf ?? 0) > 1),
  );
  const showPrematchBadge = isLive && Boolean(wcEvent) && !wcHasLiveOdds && hasPrematchOdds;

  const metaMarketsCount = Number(
    (matchData.meta as { marketsCount?: number } | undefined)?.marketsCount ?? 0,
  );
  const totalMarketsCount = Math.max(marketsCount, metaMarketsCount);

  const isCyberRow = String(matchData.eventId ?? "").startsWith("cyber-");
  const cyberMeta = (matchData.meta ?? {}) as {
    wcEventRef?: string;
    hasBroadcast?: boolean;
    wcHasBroadcast?: boolean;
    marketsCount?: number;
  };
  const cyberBroadcastRef = wcEvent?.id ?? cyberMeta.wcEventRef ?? "";
  const needsQuickOddsFetch =
    isCyberRow
    && isLive
    && Boolean(cyberBroadcastRef)
    && !wcHasLiveOdds
    && !hasPrematchOdds
    && totalMarketsCount > 0;
  const { data: quickOddsPayload, isLoading: quickOddsLoading } = useCyberRowMapOdds(
    cyberBroadcastRef,
    needsQuickOddsFetch,
  );
  const cyberHasBroadcast = Boolean(
    wcEvent?.hasBroadcast || cyberMeta.hasBroadcast || cyberMeta.wcHasBroadcast,
  );
  const showCyberBroadcast = isCyberRow && cyberHasBroadcast && Boolean(cyberBroadcastRef);

  const gameHref = `${gameLinkPrefix}${matchData.eventId}`;

  // Вся карточка ведёт на матч; интерактивные элементы (коэффы, Watch, ссылки)
  // не должны триггерить переход
  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("a, button")) return;
    router.push(gameHref);
  };

  const handleCardKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return;
    const target = e.target as HTMLElement;
    if (target.closest("a, button")) return;
    router.push(gameHref);
  };

  const openBroadcast = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!broadcast || !showCyberBroadcast || !cyberBroadcastRef) return;
    broadcast.openBroadcast(cyberBroadcastRef, true, {
      awayTeam: matchData.team2 ?? "",
      homeTeam: matchData.team1 ?? "",
      leagueName: matchData.leagueName ?? "",
      homeTeamIcon: matchData.team1Icon ?? null,
      awayTeamIcon: matchData.team2Icon ?? null,
    });
  };
  const seriesScore = resolveSeriesScore(matchData, score, isLive);
  const mapScore = resolveMapScore(matchData, score);
  const homeActive = score?.liveScore?.active === 1;
  const awayActive = score?.liveScore?.active === 2;
  const phase = score?.period ?? matchData.parsedScore?.period;

  const oddsCells = wcEvent && wcHasLiveOdds ? (
    <>
      <div className={styles.oddSlot}>
        <WcHomeOddCell
          event={wcEvent}
          pick="HOME"
          tone="kick"
          value={formatWcCompactOdd(wcEvent.oddsHome, "--")}
        />
      </div>
      {!isTwoWayWc && (
        <div className={styles.oddSlot}>
          <WcHomeOddCell
            event={wcEvent}
            pick="DRAW"
            tone="kick"
            value={formatWcCompactOdd(wcEvent.oddsDraw, "--")}
          />
        </div>
      )}
      <div className={styles.oddSlot}>
        <WcHomeOddCell
          event={wcEvent}
          pick="AWAY"
          tone="kick"
          value={formatWcCompactOdd(wcEvent.oddsAway, "--")}
        />
      </div>
    </>
  ) : quickOddsPayload?.quick && quickOddsPayload.detail ? (
    <CyberRowQuickOddsCells detail={quickOddsPayload.detail} quick={quickOddsPayload.quick} />
  ) : needsQuickOddsFetch && quickOddsLoading ? (
    <>
      <div className={styles.oddSlot} aria-hidden />
      <div className={styles.oddSlot} aria-hidden />
    </>
  ) : (
    <>
      {(markets && fieldsForSport(matchData.sport)
        ? fieldsForSport(matchData.sport)!.map((field) => ({
            coef: markets[field]?.cf || "--",
            groupedMarket: markets[field]?.groupedMarket || {
              cf: 0,
              isOpen: false,
              market: field,
            },
            isOpen: markets[field]?.isOpen || false,
            market: field,
          }))
        : []
      ).map((field, index) => (
        <div className={styles.oddSlot} key={field.market + index}>
          <MatchFieldsRow
            eventId={matchData.eventId}
            eventName={matchData.eventName}
            fields={[field]}
            isLive={isLive}
            sport={matchData.sport}
          />
        </div>
      ))}
      {isLive && totalMarketsCount > 0 && !hasPrematchOdds ? (
        <CyberRowMarketsLink gameHref={gameHref} marketsCount={totalMarketsCount} />
      ) : null}
    </>
  );

  return (
    <article
      className={cn(styles.card, isLive && styles.card_live)}
      data-sport={matchData.sport}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      role="link"
      tabIndex={0}
    >
      <div className={styles.topMeta}>
        {isLive ? (
          <span className={styles.liveBadge}>
            <span aria-hidden="true" className={styles.liveDot} />
            LIVE
          </span>
        ) : matchData.meta?.raw_start_at ? (
          <span className={styles.startLabel}>{matchData.meta.raw_start_at}</span>
        ) : null}

        {showPrematchBadge && (
          <span className={styles.prematchBadge} title="Коэффициенты из prematch-линии">
            Линия
          </span>
        )}

        {showCyberBroadcast && (
          <button
            className={styles.watchBtn}
            onClick={openBroadcast}
            title="Смотреть трансляцию"
            type="button"
          >
            <BroadcastIcon className={styles.watchIcon} />
            Watch
          </button>
        )}

        {(matchData.priority ?? 0) > 0 && (
          <span className={styles.priorityWrap} title="Топ-матч">
            <FireIcon className={styles.priorityIcon} />
          </span>
        )}

        {marketsCount > 1 && (
          <span className={styles.marketsBadge}>{`+${marketsCount}`}</span>
        )}
      </div>

      <div className={styles.mainGrid}>
        <div
          className={cn(
            styles.teamSide,
            styles.teamSide_home,
            homeActive && styles.teamSide_active,
          )}
        >
          <Link className={styles.teamLink} href={gameHref}>
            {homeActive && <span aria-hidden="true" className={styles.teamActiveDot} />}
            <span className={styles.teamLogo}>
              <WcTeamImage
                iconUrl={matchData.team1Icon}
                size={32}
                teamName={matchData.team1 ?? ""}
              />
            </span>
            <span className={styles.teamName}>{matchData.team1}</span>
          </Link>
        </div>

        <div className={styles.centerBlock}>
          {mapScore && isLive ? (
            <>
              <div
                className={cn(
                  styles.mapScore,
                  styles.mapScore_primary,
                  mapScore.isLiveMap && styles.mapScore_live,
                )}
              >
                {mapScore.label}
              </div>
              <div className={styles.seriesScoreCompact}>{seriesScore}</div>
              <span className={styles.seriesLabel}>Series</span>
            </>
          ) : (
            <>
              <div className={styles.seriesScore}>{seriesScore}</div>
              {mapScore ? (
                <div className={cn(styles.mapScore, mapScore.isLiveMap && styles.mapScore_live)}>
                  {mapScore.label}
                </div>
              ) : phase != null && Number(phase) > 0 ? (
                <div className={styles.phaseLabel}>{`Раунд ${phase}`}</div>
              ) : !isLive && matchData.meta?.raw_start_at ? (
                <div className={styles.startTime}>{matchData.meta.raw_start_at}</div>
              ) : null}
            </>
          )}
        </div>

        <div
          className={cn(
            styles.teamSide,
            styles.teamSide_away,
            awayActive && styles.teamSide_active,
          )}
        >
          <Link className={styles.teamLink} href={gameHref}>
            {awayActive && <span aria-hidden="true" className={styles.teamActiveDot} />}
            <span className={styles.teamLogo}>
              <WcTeamImage
                iconUrl={matchData.team2Icon}
                size={32}
                teamName={matchData.team2 ?? ""}
              />
            </span>
            <span className={styles.teamName}>{matchData.team2}</span>
          </Link>
        </div>
      </div>

      <div className={styles.oddsRow}>{oddsCells}</div>
    </article>
  );
};
