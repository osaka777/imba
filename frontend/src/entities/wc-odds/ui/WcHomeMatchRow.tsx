"use client";

import Link from "next/link";
import { memo, useMemo } from "react";
import { useLocale } from "~/shared/model/useLocale";
import { useRouter } from "next/navigation";

import type { WcEvent } from "~/entities/wc-odds/api/client";
import { formatWcCompactOdd, formatWcCompactTime } from "~/entities/wc-odds/lib/wcCompactFormat";
import {
  formatWcListLiveScore,
  formatWcRowLiveTime,
  formatWcRowScore,
  sportIsTwoWay,
} from "~/entities/wc-odds/lib/wcLiveScore";
import { buildWcGameHref } from "~/entities/wc-odds/lib/wcSlug";
import { isWcFeedPaused, wcFeedPausedLabel } from "~/entities/wc-odds/lib/wcFeedStatus";
import { isWcPriorityEvent } from "~/entities/wc-odds/lib/wcPriority";
import { wcEventHasStats } from "~/entities/wc-odds/lib/wcEventStats";
import { useWcBroadcast } from "~/entities/wc-odds/lib/WcBroadcastContext";
import { WcCompactTeamsBlock } from "~/entities/wc-odds/ui/WcCompactTeamsBlock";
import { WcMatchFieldsCell } from "~/entities/wc-odds/ui/WcMatchFieldsCell";
import { BroadcastIcon } from "~/shared/assets";

import compactStyles from "~/entities/wc-odds/ui/WcCompactTeamsRow.module.css";
import styles from "~/entities/wc-odds/ui/WcHomeMatchRow.module.css";
import wcStyles from "~/entities/wc-odds/ui/WcLine.module.css";

type WcHomeMatchRowProps = {
  event: WcEvent;
  rowIndex: number;
  variant: "live" | "prematch";
  gridColumns: string;
  /** Override default `/game/...` link (e.g. cybersport home → `/cybersport/game/...`). */
  hrefOverride?: string;
};

export const WcHomeMatchRow = memo(function WcHomeMatchRow({
  event,
  rowIndex,
  variant,
  gridColumns,
  hrefOverride,
}: WcHomeMatchRowProps) {
  const router = useRouter();
  const gameHref = hrefOverride ?? buildWcGameHref(event);
  const isLive = variant === "live" && event.phase === "live";
  const { locale, t } = useLocale();
  const isTwoWay = sportIsTwoWay(event.sport);
  const marketsCount = event.marketsCount ?? 0;

  const { main: scoreMain, periods: scorePeriods } = useMemo(() => {
    if (isLive) return formatWcListLiveScore(event);
    return formatWcRowScore(event);
  }, [event, isLive]);

  const liveTimeLabel = useMemo(() => {
    if (!isLive) return null;
    if (isWcFeedPaused(event.feedStatus)) return wcFeedPausedLabel("ru");
    return formatWcRowLiveTime(event.parsedScore, event.sport);
  }, [isLive, event.feedStatus, event.parsedScore, event.sport]);

  const { date, time } = useMemo(
    () => formatWcCompactTime(event.commenceTime, locale),
    [event.commenceTime, locale],
  );

  const openGame = () => router.push(gameHref);
  const broadcast = useWcBroadcast();

  const openBroadcast = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!broadcast || !event.hasBroadcast) return;
    broadcast.openBroadcast(event.slug || event.id, true, {
      awayTeam: event.awayTeam,
      homeTeam: event.homeTeam,
      leagueName: event.leagueName,
      homeTeamIcon: event.homeTeamIcon ?? null,
      awayTeamIcon: event.awayTeamIcon ?? null,
    });
  };

  return (
    <div
      className={`${styles.row} ${rowIndex % 2 === 1 ? styles.row_alt : ""}`}
      style={{ gridTemplateColumns: gridColumns }}
    >
      <div className={styles.rowMain}>
        <Link
          className={styles.timeCell}
          href={gameHref}
          onClick={(e) => e.stopPropagation()}
          prefetch={false}
        >
          <span className={styles.date}>{date}</span>
          <span className={styles.clock}>{time}</span>
        </Link>

        <div
          className={styles.mainCell}
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
          <div className={styles.teamsBlock}>
            <WcCompactTeamsBlock
              awayTeam={event.awayTeam}
              gameHref={gameHref}
              hasStats={wcEventHasStats(event)}
              homeExtras={
                event.hasBroadcast ? (
                  <button
                    aria-label={t("common.openBroadcast")}
                    className={compactStyles.teamBroadcastBtn}
                    onClick={openBroadcast}
                    type="button"
                  >
                    <BroadcastIcon className={compactStyles.teamBroadcastIcon} />
                  </button>
                ) : undefined
              }
              homeTeam={event.homeTeam}
              isLive={isLive}
              isPriority={isWcPriorityEvent(event)}
              layout="home"
              liveTimeLabel={liveTimeLabel}
              marketsCount={marketsCount}
              onMarketsClick={(e) => e.stopPropagation()}
              scoreMain={scoreMain}
              scorePeriods={scorePeriods}
            />
          </div>
        </div>

      </div>

      <div
        className={`${styles.oddsBar} ${wcStyles.wcOddsRow} ${
          isTwoWay ? wcStyles.wcOddsMain_twoWay : wcStyles.wcOddsMain_threeWay
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <WcMatchFieldsCell
          event={event}
          pick="HOME"
          value={formatWcCompactOdd(event.oddsHome, "--")}
        />
        {!isTwoWay && (
          <WcMatchFieldsCell
            event={event}
            pick="DRAW"
            value={formatWcCompactOdd(event.oddsDraw, "--")}
          />
        )}
        <WcMatchFieldsCell
          event={event}
          pick="AWAY"
          value={formatWcCompactOdd(event.oddsAway, "--")}
        />
      </div>
    </div>
  );
});
