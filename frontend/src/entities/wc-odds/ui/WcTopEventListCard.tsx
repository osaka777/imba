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
type BadgeState = "hot" | "social" | "fallback";

/** From this many standalone tickets, the pulse badge switches to its "hot" state. */
const HOT_BET_THRESHOLD = 8;

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

function pickOdd(meta: ReturnType<typeof resolveMeta>, pick: FavoritePick): number {
  if (pick === "HOME") return meta.oddsHome ?? 0;
  if (pick === "AWAY") return meta.oddsAway ?? 0;
  return meta.oddsDraw ?? 0;
}

function pickLabel(meta: ReturnType<typeof resolveMeta>, pick: FavoritePick, locale: "ru" | "en"): string {
  if (pick === "HOME") return meta.homeTeam;
  if (pick === "AWAY") return meta.awayTeam;
  return locale === "en" ? "Draw" : "Ничья";
}

/** Bookmaker's shortest-odd favorite — used when no crowd data exists yet. */
function bookmakerFavorite(
  meta: ReturnType<typeof resolveMeta>,
): { pick: FavoritePick; odd: number } | null {
  const candidates = (["HOME", "DRAW", "AWAY"] as FavoritePick[])
    .map((pick) => ({ pick, odd: pickOdd(meta, pick) }))
    .filter((candidate) => candidate.odd > 1);

  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => a.odd - b.odd)[0];
}

/** The outcome the crowd is actually backing right now — real social proof, not implied odds. */
function crowdFavorite(
  meta: ReturnType<typeof resolveMeta>,
  pulse: SocialPulseItem | undefined,
): { pick: FavoritePick; odd: number; percent: number } | null {
  if (!pulse) return null;
  const ranked = [...pulse.outcomes]
    .filter((outcome) => pickOdd(meta, outcome.pick) > 1)
    .sort((a, b) => b.percent - a.percent);

  const top = ranked[0];
  if (!top) return null;
  return { pick: top.pick, odd: pickOdd(meta, top.pick), percent: top.percent };
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
  const crowd = useMemo(() => crowdFavorite(meta, pulse), [meta, pulse]);
  const bookFavorite = useMemo(() => bookmakerFavorite(meta), [meta]);
  const favorite = crowd ?? bookFavorite;
  const { SportIcon } = meta;

  const favoriteLabel = favorite ? pickLabel(meta, favorite.pick, locale) : null;
  const impliedProbability = !crowd && bookFavorite
    ? Math.min(99, Math.round(100 / bookFavorite.odd))
    : null;

  const badgeState: BadgeState = !pulse
    ? "fallback"
    : pulse.betCount >= HOT_BET_THRESHOLD
      ? "hot"
      : "social";

  return (
    <article className={`${styles.card} ${badgeState === "hot" ? styles.card_hot : ""}`}>
      <div className={styles.leagueBar}>
        <span className={styles.sportIconWrap}>
          <SportIcon className={styles.sportIcon} />
        </span>
        <span className={styles.leagueName}>{meta.leagueName}</span>
        {meta.isLive ? <span className={styles.liveLabel}>LIVE</span> : null}
      </div>

      <div className={styles.body}>
        <Link className={styles.matchSide} href={meta.href} prefetch={false}>
          <div className={styles.timeRow}>
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
            <span
              className={`${styles.betsMetric} ${badgeState === "hot" ? styles.betsMetric_hot : ""}`}
            >
              {pulse ? <FiZap aria-hidden /> : <FiTrendingUp aria-hidden />}
              {pulse
                ? betCountLabel(pulse.betCount, locale)
                : locale === "en"
                  ? "Popular match"
                  : "Популярный матч"}
            </span>
            {(crowd || impliedProbability !== null) && (
              <span className={styles.probabilityMetric}>
                {locale === "en" ? "Probability" : "Вероятность"}{" "}
                <strong>{crowd?.percent ?? impliedProbability}%</strong>
              </span>
            )}
          </div>

          <div className={styles.selection}>
            <div className={styles.selectionText}>
              <small>
                {crowd
                  ? locale === "en"
                    ? "Crowd's pick"
                    : "Выбор большинства"
                  : locale === "en"
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
                  tone="topcard"
                  value={formatWcCompactOdd(favorite.odd, "--")}
                />
              ) : (
                <span className={styles.oddFallback}>
                  {favorite ? formatWcCompactOdd(favorite.odd, "--") : "—"}
                </span>
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
