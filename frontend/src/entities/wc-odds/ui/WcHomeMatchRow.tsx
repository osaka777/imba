"use client";

import Link from "next/link";
import { memo, useMemo } from "react";
import { useLocale } from "~/shared/model/useLocale";
import { useRouter } from "next/navigation";
import { FiZap } from "react-icons/fi";

import type { SocialPulseItem } from "~/entities/social-pulse/api/client";
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
import { WcCompactTeamsBlock } from "~/entities/wc-odds/ui/WcCompactTeamsBlock";
import { WcMatchFieldsCell } from "~/entities/wc-odds/ui/WcMatchFieldsCell";

import styles from "~/entities/wc-odds/ui/WcHomeMatchRow.module.css";
import wcStyles from "~/entities/wc-odds/ui/WcLine.module.css";

type WcHomeMatchRowProps = {
  event: WcEvent;
  rowIndex: number;
  variant: "live" | "prematch";
  gridColumns: string;
  pulse?: SocialPulseItem;
};

export const WcHomeMatchRow = memo(function WcHomeMatchRow({
  event,
  rowIndex,
  variant,
  gridColumns,
  pulse,
}: WcHomeMatchRowProps) {
  const router = useRouter();
  const gameHref = buildWcGameHref(event);
  const isLive = variant === "live" && event.phase === "live";
  const { locale } = useLocale();
  const isTwoWay = sportIsTwoWay(event.sport);
  const marketsCount = event.marketsCount ?? 0;
  const favoriteProbability = useMemo(() => {
    const prices = [event.oddsHome, event.oddsDraw, event.oddsAway]
      .filter((price): price is number => typeof price === "number" && price > 1);
    if (prices.length === 0) return null;
    return Math.min(99, Math.round(100 / Math.min(...prices)));
  }, [event.oddsAway, event.oddsDraw, event.oddsHome]);

  const betsLabel = useMemo(() => {
    if (!pulse) return "";
    if (locale === "en") return `${pulse.betCount} ${pulse.betCount === 1 ? "bet" : "bets"}`;
    const mod10 = pulse.betCount % 10;
    const mod100 = pulse.betCount % 100;
    const word =
      mod10 === 1 && mod100 !== 11
        ? "ставка"
        : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
          ? "ставки"
          : "ставок";
    return `${pulse.betCount} ${word}`;
  }, [locale, pulse]);

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
            {pulse && favoriteProbability !== null ? (
              <div className={styles.pulseBadges}>
                <span className={styles.betsBadge}>
                  <FiZap aria-hidden />
                  {betsLabel}
                </span>
                <span className={styles.probabilityBadge}>
                  {locale === "en" ? "Probability" : "Вероятность"}{" "}
                  <strong>{favoriteProbability}%</strong>
                </span>
              </div>
            ) : null}
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
