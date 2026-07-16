"use client";

import Link from "next/link";
import { memo, useMemo } from "react";
import { useLocale } from "~/shared/model/useLocale";

import { gamesList } from "~/entities/game/lib/gamesList";
import type { SocialPulseItem } from "~/entities/social-pulse/api/client";
import type { WcEvent } from "~/entities/wc-odds/api/client";
import { formatWcCompactOdd, formatWcCompactTime } from "~/entities/wc-odds/lib/wcCompactFormat";
import {
  formatWcListLiveScore,
  formatWcRowLiveTime,
} from "~/entities/wc-odds/lib/wcLiveScore";
import { buildWcGameHref } from "~/entities/wc-odds/lib/wcSlug";
import { wcEventHasStats } from "~/entities/wc-odds/lib/wcEventStats";
import { WcHomeOddCell } from "~/entities/wc-odds/ui/WcHomeOddCell";
import { WcTeamImage } from "~/entities/wc-odds/ui/WcTeamImage";
import {
  cyberTopEventBadge,
  extractCyberWinOdds,
  topEventIsTwoWay,
  wcTopEventBadge,
  type TopEventItem,
} from "~/entities/wc-odds/ui/topEventsUtils";
import { BroadcastIcon, CSIcon, StatsIcon } from "~/shared/assets";
import { cn } from "~/shared/lib";

import styles from "~/entities/wc-odds/ui/WcTopEventCard.module.css";

const AVATAR_SIZE = 48;

type WcTopEventCardProps = {
  item: TopEventItem;
  pulse?: SocialPulseItem;
};

function resolveCardMeta(item: TopEventItem, locale: "ru" | "en" = "ru") {
  if (item.kind === "wc") {
    const event = item.event;
    const isLive = event.phase === "live";
    const sportKey = event.sport as keyof typeof gamesList;
    const sportDef = gamesList[sportKey] ?? gamesList.soccer;

    return {
      href: buildWcGameHref(event),
      leagueName: event.leagueName || "",
      homeTeam: event.homeTeam || "—",
      awayTeam: event.awayTeam || "—",
      homeIcon: event.homeTeamIcon,
      awayIcon: event.awayTeamIcon,
      isLive,
      hasStats: wcEventHasStats(event),
      hasBroadcast: Boolean(event.hasBroadcast),
      oddsHome: event.oddsHome,
      oddsDraw: event.oddsDraw,
      oddsAway: event.oddsAway,
      wcEvent: event,
      SportIcon: sportDef.Icon,
      badge: wcTopEventBadge(event.priorityLevel) ?? "TOP",
    };
  }

  const event = item.event;
  const odds = extractCyberWinOdds(event);
  const sportKey = (event.sport ?? "esports.cs") as keyof typeof gamesList;
  const sportDef = gamesList[sportKey] ?? gamesList["esports.cs"];

  return {
    href: `/cybersport/game/${encodeURIComponent(event.eventId || "")}`,
    leagueName: event.leagueName || "",
    homeTeam: event.team1 || "—",
    awayTeam: event.team2 || "—",
    homeIcon: event.team1Icon ?? null,
    awayIcon: event.team2Icon ?? null,
    isLive: item.isLive,
    hasStats: false,
    hasBroadcast: Boolean(
      (event.meta as { hasBroadcast?: boolean; wcHasBroadcast?: boolean } | undefined)?.hasBroadcast
      || (event.meta as { wcHasBroadcast?: boolean } | undefined)?.wcHasBroadcast,
    ),
    oddsHome: odds.home,
    oddsDraw: odds.draw,
    oddsAway: odds.away,
    wcEvent: null as WcEvent | null,
    SportIcon: sportDef?.Icon ?? CSIcon,
    badge: cyberTopEventBadge((event as { priority?: number }).priority) ?? "TOP",
  };
}

function resolveScoreBlock(item: TopEventItem, isLive: boolean) {
  if (item.kind === "wc") {
    const event = item.event;
    if (isLive) {
      const { main } = formatWcListLiveScore(event);
      const liveTime = formatWcRowLiveTime(event.parsedScore, event.sport);
      return {
        score: main || "0:0",
        liveTime,
        subLabel: null as string | null,
        isPrematch: false,
      };
    }

    const { date, time } = formatWcCompactTime(event.commenceTime, locale);
    return {
      score: time,
      liveTime: null,
      subLabel: date,
      isPrematch: true,
    };
  }

  const score = item.event.parsedScore?.text?.currentScore;
  const liveTime = item.event.parsedScore?.text?.time ?? null;

  if (item.isLive) {
    return {
      score: score || "0:0",
      liveTime,
      subLabel: null,
      isPrematch: false,
    };
  }

  const rawStart = item.event.meta?.raw_start_at ?? "";
  const parts = rawStart.split(" ");

  return {
    score: parts[parts.length - 1] || "—",
    liveTime: null,
    subLabel: parts.length > 1 ? parts.slice(0, -1).join(" ") : null,
    isPrematch: true,
  };
}

export const WcTopEventCard = memo(function WcTopEventCard({
  item,
  pulse,
}: WcTopEventCardProps) {
  const { locale } = useLocale();
  const meta = useMemo(() => resolveCardMeta(item, locale), [item, locale]);
  const isTwoWay = topEventIsTwoWay(item);
  const scoreBlock = useMemo(
    () => resolveScoreBlock(item, meta.isLive),
    [item, meta.isLive],
  );
  const { SportIcon } = meta;
  const pulseProbability = useMemo(() => {
    const prices = [meta.oddsHome, meta.oddsDraw, meta.oddsAway]
      .filter((price): price is number => typeof price === "number" && price > 1);
    if (prices.length === 0) return null;
    return Math.min(99, Math.round(100 / Math.min(...prices)));
  }, [meta.oddsAway, meta.oddsDraw, meta.oddsHome]);
  const pulseLabel = useMemo(() => {
    if (!pulse || pulseProbability === null) return null;
    if (locale === "en") {
      return `⚡ ${pulse.betCount} ${pulse.betCount === 1 ? "bet" : "bets"} · ${pulseProbability}%`;
    }
    const mod10 = pulse.betCount % 10;
    const mod100 = pulse.betCount % 100;
    const word =
      mod10 === 1 && mod100 !== 11
        ? "ставка"
        : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
          ? "ставки"
          : "ставок";
    return `⚡ ${pulse.betCount} ${word} · ${pulseProbability}%`;
  }, [locale, pulse, pulseProbability]);
  const capLabel = pulseLabel ?? (meta.badge ? "Имба" : null);

  return (
    <article className={styles.card}>
      {capLabel ? (
        <div aria-hidden className={styles.topCap}>
          <span
            className={cn(
              styles.topCapLine,
              styles.topCapLine_left,
              pulseLabel && styles.topCapLine_pulse,
            )}
          />
          <span className={cn(styles.topBadge, pulseLabel && styles.topBadge_pulse)}>
            {capLabel}
          </span>
          <span
            className={cn(
              styles.topCapLine,
              styles.topCapLine_right,
              pulseLabel && styles.topCapLine_pulse,
            )}
          />
        </div>
      ) : null}

      <div className={styles.cardHead}>
        <div className={styles.leagueRow}>
          <SportIcon className={styles.sportIcon} />
          <p className={styles.league} title={meta.leagueName}>
            {meta.leagueName}
          </p>
        </div>
        {(meta.hasStats || meta.hasBroadcast) && (
          <div className={styles.headIcons}>
            {meta.hasStats && (
              <span className={styles.headIcon} title="Статистика">
                <StatsIcon className={styles.headIconSvg} />
              </span>
            )}
            {meta.hasBroadcast && (
              <span className={styles.headIcon} title="Трансляция">
                <BroadcastIcon className={styles.headIconSvg} />
              </span>
            )}
          </div>
        )}
      </div>

      <Link className={styles.matchLink} href={meta.href} prefetch={false}>
        <div className={styles.teamsGrid}>
          <div className={styles.side}>
            <div className={styles.avatarWrap}>
              <WcTeamImage
                iconUrl={meta.homeIcon}
                rounded
                size={AVATAR_SIZE}
                teamName={meta.homeTeam}
              />
            </div>
            <span className={styles.teamName}>{meta.homeTeam}</span>
          </div>

          <div className={styles.center}>
            {scoreBlock.isPrematch && scoreBlock.subLabel ? (
              <span className={styles.prematchDate}>{scoreBlock.subLabel}</span>
            ) : null}
            <span className={cn(styles.score, scoreBlock.isPrematch && styles.score_prematch)}>
              {scoreBlock.score}
            </span>
            {meta.isLive && scoreBlock.liveTime ? (
              <span className={styles.liveTime}>
                <span aria-hidden className={styles.liveDot} />
                {scoreBlock.liveTime}
              </span>
            ) : null}
          </div>

          <div className={styles.side}>
            <div className={styles.avatarWrap}>
              <WcTeamImage
                iconUrl={meta.awayIcon}
                rounded
                size={AVATAR_SIZE}
                teamName={meta.awayTeam}
              />
            </div>
            <span className={styles.teamName}>{meta.awayTeam}</span>
          </div>
        </div>
      </Link>

      <div
        className={cn(styles.oddsRow, isTwoWay ? styles.oddsRow_twoWay : styles.oddsRow_threeWay)}
        onClick={(event) => event.stopPropagation()}
      >
        {meta.wcEvent ? (
          <>
            <WcHomeOddCell
              event={meta.wcEvent}
              pick="HOME"
              value={formatWcCompactOdd(meta.oddsHome, "--")}
            />
            {!isTwoWay && (
              <WcHomeOddCell
                event={meta.wcEvent}
                pick="DRAW"
                value={formatWcCompactOdd(meta.oddsDraw, "--")}
              />
            )}
            <WcHomeOddCell
              event={meta.wcEvent}
              pick="AWAY"
              value={formatWcCompactOdd(meta.oddsAway, "--")}
            />
          </>
        ) : (
          <>
            <OddPill label="П1" value={formatWcCompactOdd(meta.oddsHome, "--")} />
            {!isTwoWay && <OddPill label="X" value={formatWcCompactOdd(meta.oddsDraw, "--")} />}
            <OddPill label="П2" value={formatWcCompactOdd(meta.oddsAway, "--")} />
          </>
        )}
      </div>
    </article>
  );
});

function OddPill({ label, value }: { label: string; value: string }) {
  const available = value !== "—" && value !== "--";

  if (!available) {
    return <div className={styles.oddEmpty}>—</div>;
  }

  return (
    <div className={styles.oddPill}>
      <span className={styles.oddLabel}>{label}</span>
      <span className={styles.oddValue}>{value}</span>
    </div>
  );
}
