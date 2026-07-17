"use client";

import Link from "next/link";
import { memo, useMemo } from "react";
import { FiPlus, FiTrendingUp, FiZap } from "react-icons/fi";

import { gamesList } from "~/entities/game/lib/gamesList";
import type { SocialPulseItem } from "~/entities/social-pulse/api/client";
import type { WcEvent } from "~/entities/wc-odds/api/client";
import { formatWcCompactOdd, formatWcCompactTime } from "~/entities/wc-odds/lib/wcCompactFormat";
import {
  formatWcListLiveScore,
  formatWcRowLiveTime,
} from "~/entities/wc-odds/lib/wcLiveScore";
import { buildWcGameHref } from "~/entities/wc-odds/lib/wcSlug";
import { WcHomeOddCell } from "~/entities/wc-odds/ui/WcHomeOddCell";
import { WcTeamImage } from "~/entities/wc-odds/ui/WcTeamImage";
import {
  extractCyberWinOdds,
  type TopEventItem,
} from "~/entities/wc-odds/ui/topEventsUtils";
import { CSIcon } from "~/shared/assets";
import { useLocale } from "~/shared/model/useLocale";

import styles from "./WcTopEventListCard.module.css";

type FavoritePick = "HOME" | "DRAW" | "AWAY";

type Props = {
  item: TopEventItem;
  pulse?: SocialPulseItem;
};

function resolveMeta(item: TopEventItem, locale: "ru" | "en") {
  if (item.kind === "wc") {
    const event = item.event;
    const sportDef = gamesList[event.sport as keyof typeof gamesList] ?? gamesList.soccer;
    const isLive = event.phase === "live";
    const { date, time } = formatWcCompactTime(event.commenceTime, locale);
    const liveScore = isLive ? formatWcListLiveScore(event).main : null;
    const liveTime = isLive ? formatWcRowLiveTime(event.parsedScore, event.sport) : null;

    return {
      href: buildWcGameHref(event),
      leagueName: event.leagueName || "—",
      homeTeam: event.homeTeam || "—",
      awayTeam: event.awayTeam || "—",
      homeIcon: event.homeTeamIcon,
      awayIcon: event.awayTeamIcon,
      oddsHome: event.oddsHome,
      oddsDraw: event.oddsDraw,
      oddsAway: event.oddsAway,
      isLive,
      date,
      time,
      liveScore,
      liveTime,
      SportIcon: sportDef.Icon,
      wcEvent: event,
    };
  }

  const event = item.event;
  const odds = extractCyberWinOdds(event);
  const sportDef =
    gamesList[(event.sport ?? "esports.cs") as keyof typeof gamesList] ??
    gamesList["esports.cs"];
  const rawStart = event.meta?.raw_start_at ?? "";
  const parts = rawStart.split(" ");
  const score = event.parsedScore?.text?.currentScore ?? null;

  return {
    href: `/cybersport/game/${encodeURIComponent(event.eventId || "")}`,
    leagueName: event.leagueName || "—",
    homeTeam: event.team1 || "—",
    awayTeam: event.team2 || "—",
    homeIcon: event.team1Icon ?? null,
    awayIcon: event.team2Icon ?? null,
    oddsHome: odds.home,
    oddsDraw: odds.draw,
    oddsAway: odds.away,
    isLive: item.isLive,
    date: parts.length > 1 ? parts.slice(0, -1).join(" ") : "",
    time: parts[parts.length - 1] || "—",
    liveScore: score,
    liveTime: event.parsedScore?.text?.time ?? null,
    SportIcon: sportDef?.Icon ?? CSIcon,
    wcEvent: null as WcEvent | null,
  };
}

function favoriteOutcome(meta: ReturnType<typeof resolveMeta>) {
  const candidates: Array<{ pick: FavoritePick; odd: number; label: string }> = [
    { pick: "HOME", odd: meta.oddsHome ?? 0, label: meta.homeTeam },
    { pick: "DRAW", odd: meta.oddsDraw ?? 0, label: "Ничья" },
    { pick: "AWAY", odd: meta.oddsAway ?? 0, label: meta.awayTeam },
  ].filter((candidate) => candidate.odd > 1);

  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => a.odd - b.odd)[0];
}

function betCountLabel(count: number, locale: "ru" | "en") {
  if (locale === "en") return `${count} ${count === 1 ? "bet" : "bets"}`;
  const mod10 = count % 10;
  const mod100 = count % 100;
  const noun =
    mod10 === 1 && mod100 !== 11
      ? "ставка"
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? "ставки"
        : "ставок";
  return `${count} ${noun}`;
}

export const WcTopEventListCard = memo(function WcTopEventListCard({
  item,
  pulse,
}: Props) {
  const { locale } = useLocale();
  const meta = useMemo(() => resolveMeta(item, locale), [item, locale]);
  const favorite = useMemo(() => favoriteOutcome(meta), [meta]);
  const probability = favorite ? Math.min(99, Math.round(100 / favorite.odd)) : null;
  const { SportIcon } = meta;
  const favoriteLabel =
    favorite?.pick === "DRAW" && locale === "en" ? "Draw" : favorite?.label;

  return (
    <article className={styles.card}>
      <div className={styles.leagueBar}>
        <SportIcon className={styles.sportIcon} />
        <span>{meta.leagueName}</span>
        {meta.isLive ? <span className={styles.liveLabel}>LIVE</span> : null}
      </div>

      <div className={styles.body}>
        <Link className={styles.matchSide} href={meta.href} prefetch={false}>
          <div className={styles.timeRow}>
            {meta.isLive ? <span className={styles.liveFlame}>●</span> : null}
            <span className={styles.timePill}>
              {meta.isLive && meta.liveTime
                ? meta.liveTime
                : [meta.time, meta.date].filter(Boolean).join(" • ")}
            </span>
            {meta.liveScore ? <strong className={styles.score}>{meta.liveScore}</strong> : null}
          </div>

          <div className={styles.teams}>
            <span>
              <WcTeamImage
                iconUrl={meta.homeIcon}
                rounded
                size={24}
                teamName={meta.homeTeam}
              />
              <strong>{meta.homeTeam}</strong>
            </span>
            <span>
              <WcTeamImage
                iconUrl={meta.awayIcon}
                rounded
                size={24}
                teamName={meta.awayTeam}
              />
              <strong>{meta.awayTeam}</strong>
            </span>
          </div>
        </Link>

        <div className={styles.pickSide}>
          <div className={styles.metrics}>
            {pulse ? (
              <span className={styles.betsMetric}>
                <FiZap aria-hidden />
                {betCountLabel(pulse.betCount, locale)}
              </span>
            ) : (
              <span className={styles.topMetric}>
                <FiTrendingUp aria-hidden />
                {locale === "en" ? "Top match" : "Топ матч"}
              </span>
            )}
            {probability !== null ? (
              <span className={styles.probabilityMetric}>
                {locale === "en" ? "Probability" : "Вероятность"}{" "}
                <strong>{probability}%</strong>
              </span>
            ) : null}
          </div>

          <div className={styles.selection}>
            <div className={styles.selectionText}>
              <small>
                {locale === "en"
                  ? "Match result (regular time)"
                  : "Результат матча (основное время)"}
              </small>
              <strong>{favoriteLabel ?? "—"}</strong>
            </div>
            <div className={styles.odd}>
              {favorite && meta.wcEvent ? (
                <WcHomeOddCell
                  event={meta.wcEvent}
                  pick={favorite.pick}
                  value={formatWcCompactOdd(favorite.odd, "--")}
                />
              ) : (
                <span>{favorite ? formatWcCompactOdd(favorite.odd, "--") : "—"}</span>
              )}
            </div>
          </div>
        </div>

        <Link
          aria-label={locale === "en" ? "Open all markets" : "Открыть все рынки"}
          className={styles.openButton}
          href={meta.href}
          prefetch={false}
        >
          <FiPlus aria-hidden />
        </Link>
      </div>
    </article>
  );
});
