"use client";

import Link from "next/link";
import { memo, useMemo } from "react";
import { useRouter } from "next/navigation";

import type { WcEvent } from "~/entities/wc-odds/api/client";
import { formatWcCompactOdd, formatWcCompactTime } from "~/entities/wc-odds/lib/wcCompactFormat";
import {
  formatWcListLiveScore,
  formatWcRowLiveTime,
  formatWcRowScore,
  sportHasDoubleChance,
  sportHasTotals,
  sportIsTwoWay,
} from "~/entities/wc-odds/lib/wcLiveScore";
import { buildWcGameHref } from "~/entities/wc-odds/lib/wcSlug";
import { isWcPriorityEvent } from "~/entities/wc-odds/lib/wcPriority";
import { useWcBroadcast } from "~/entities/wc-odds/lib/WcBroadcastContext";
import { WcMatchDcCell } from "~/entities/wc-odds/ui/WcMatchDcCell";
import { WcMatchFieldsCell } from "~/entities/wc-odds/ui/WcMatchFieldsCell";
import { WcMatchTotalCell } from "~/entities/wc-odds/ui/WcMatchTotalCell";
import { WcMatchTotalPivot } from "~/entities/wc-odds/ui/WcMatchTotalPivot";
import { WcCompactTeamsBlock } from "~/entities/wc-odds/ui/WcCompactTeamsBlock";
import { getWcSoccerCardCounts, teamHasCards } from "~/entities/wc-odds/lib/wcSoccerCards";
import { buildWcListStatCols } from "~/entities/wc-odds/lib/wcListStatCols";
import { wcEventHasStats } from "~/entities/wc-odds/lib/wcEventStats";
import { WcTeamCardBadges } from "~/entities/wc-odds/ui/WcTeamCardBadges";
import { WcHomeInlineStats } from "~/entities/wc-odds/ui/WcHomeInlineStats";
import compactStyles from "~/entities/wc-odds/ui/WcCompactTeamsRow.module.css";
import { BroadcastIcon } from "~/shared/assets";

import styles from "~/entities/game/ui/TournamentTable/MatchRow.module.css";
import wcStyles from "~/entities/wc-odds/ui/WcLine.module.css";
import rowStyles from "~/entities/wc-odds/ui/WcMatchRow.module.css";

type WcMatchRowProps = {
  event: WcEvent;
  rowIndex?: number;
  showInlineStats?: boolean;
};

export const WcMatchRow = memo(function WcMatchRow({
  event,
  rowIndex = 0,
  showInlineStats = true,
}: WcMatchRowProps) {
  const router = useRouter();
  const broadcast = useWcBroadcast();
  const gameHref = buildWcGameHref(event);
  const isLive = event.phase === "live";
  const isTwoWay = sportIsTwoWay(event.sport);
  const showDc = sportHasDoubleChance(event.sport);
  const showTotals = sportHasTotals(event.sport);

  const { main: scoreMain, periods: scorePeriods } = useMemo(
    () => (isLive ? formatWcListLiveScore(event) : formatWcRowScore(event)),
    [event, isLive],
  );

  const liveTimeLabel = useMemo(
    () => (isLive ? formatWcRowLiveTime(event.parsedScore, event.sport) : null),
    [isLive, event.parsedScore, event.sport],
  );

  const { date, time } = useMemo(
    () => formatWcCompactTime(event.commenceTime),
    [event.commenceTime],
  );

  const cardCounts = useMemo(
    () => getWcSoccerCardCounts(event, isLive),
    [event, isLive],
  );

  const listStatCols = useMemo(
    () => (isLive ? buildWcListStatCols(event) : []),
    [event, isLive],
  );

  const openGame = () => router.push(gameHref);

  const openBroadcast = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!broadcast || !event.hasBroadcast) return;
    broadcast.openBroadcast(event.slug, true, {
      awayTeam: event.awayTeam,
      homeTeam: event.homeTeam,
      leagueName: event.leagueName,
    });
  };

  return (
    <div
      className={`${styles.MatchRow} ${wcStyles.wcMatchRow} ${rowStyles.wcRow} ${
        rowIndex % 2 === 0 ? rowStyles.wcRow_even : rowStyles.wcRow_odd
      } ${isLive ? rowStyles.wcRow_live : ""}`}
    >
      <div
        className={`${styles.matchInfo} ${rowStyles.matchInfo}`}
        onClick={openGame}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openGame();
          }
        }}
        role="link"
        tabIndex={0}
      >
        <Link
          className={`${styles.matchInfoLink} ${rowStyles.matchInfoLink}`}
          href={gameHref}
          prefetch={false}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={rowStyles.timeCell}>
            <span className={rowStyles.date}>{date}</span>
            <span className={rowStyles.clock}>{time}</span>
          </div>

          <div className={rowStyles.matchBody}>
            <WcCompactTeamsBlock
              awayExtras={
                cardCounts && teamHasCards(cardCounts.away) ? (
                  <WcTeamCardBadges
                    countMode="hover"
                    red={cardCounts.away.red}
                    yellow={cardCounts.away.yellow}
                  />
                ) : undefined
              }
              awayTeam={event.awayTeam}
              gameHref={gameHref}
              hasStats={wcEventHasStats(event)}
              homeExtras={
                <>
                  {event.hasBroadcast && (
                    <button
                      aria-label="Открыть видеотрансляцию"
                      className={compactStyles.teamBroadcastBtn}
                      onClick={openBroadcast}
                      type="button"
                    >
                      <BroadcastIcon className={compactStyles.teamBroadcastIcon} />
                    </button>
                  )}
                  {cardCounts && teamHasCards(cardCounts.home) && (
                    <WcTeamCardBadges
                      countMode="hover"
                      red={cardCounts.home.red}
                      yellow={cardCounts.home.yellow}
                    />
                  )}
                </>
              }
              homeTeam={event.homeTeam}
              isLive={isLive}
              isPriority={isWcPriorityEvent(event)}
              liveTimeLabel={liveTimeLabel}
              marketsCount={event.marketsCount ?? 0}
              onMarketsClick={(e) => e.stopPropagation()}
              scoreMain={scoreMain}
              scorePeriods={scorePeriods}
            />
            {showInlineStats && listStatCols.length > 0 && (
              <WcHomeInlineStats cols={listStatCols} />
            )}
          </div>
        </Link>
      </div>

      <div className={`${rowStyles.cellsBlock} ${wcStyles.cellsBlock}`} onClick={(e) => e.stopPropagation()}>
        <div
          className={`${wcStyles.wcOddsRow} ${wcStyles.wcOddsMain} ${
            isTwoWay ? wcStyles.wcOddsMain_twoWay : wcStyles.wcOddsMain_threeWay
          }`}
        >
          <WcMatchFieldsCell event={event} pick="HOME" value={formatWcCompactOdd(event.oddsHome, "--")} />
          {!isTwoWay && (
            <WcMatchFieldsCell event={event} pick="DRAW" value={formatWcCompactOdd(event.oddsDraw, "--")} />
          )}
          <WcMatchFieldsCell event={event} pick="AWAY" value={formatWcCompactOdd(event.oddsAway, "--")} />
        </div>

        {showDc && (
          <div className={`${wcStyles.wcOddsRow} ${wcStyles.wcOddsDc}`}>
            <WcMatchDcCell event={event} label="1X" value={formatWcCompactOdd(event.odds1X, "--")} />
            <WcMatchDcCell event={event} label="12" value={formatWcCompactOdd(event.odds12, "--")} />
            <WcMatchDcCell event={event} label="X2" value={formatWcCompactOdd(event.oddsX2, "--")} />
          </div>
        )}

        {showTotals && (
          <div className={`${wcStyles.wcOddsRow} ${wcStyles.wcOddsTotals}`}>
            <WcMatchTotalPivot line={event.totalLine} />
            <WcMatchTotalCell event={event} side="UNDER" value={formatWcCompactOdd(event.oddsUnder, "--")} />
            <WcMatchTotalCell event={event} side="OVER" value={formatWcCompactOdd(event.oddsOver, "--")} />
          </div>
        )}
      </div>
    </div>
  );
});
