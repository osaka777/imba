"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { gamesList } from "~/entities/game";
import { WcTeamImage } from "~/entities/wc-odds/ui/WcTeamImage";
import { cn } from "~/shared/lib";
import { LoadingSpinner } from "~/shared/ui";

import {
  fetchMatchResults,
  formatAlmatyDateInput,
  periodLabel,
} from "../api/getMatchResults";
import {
  RESULTS_SPORTS,
  type MatchResultItem,
  type MatchResultsMode,
  type ResultsSportSlug,
} from "../api/types";
import styles from "./MatchResultsPage.module.css";

function formatKickoff(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Almaty",
  }).format(date);
}

function formatDisplayDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00+05:00`);
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    timeZone: "Asia/Almaty",
  }).format(parsed);
}

function sportLabel(slug: ResultsSportSlug): string {
  return RESULTS_SPORTS.find((s) => s.slug === slug)?.label ?? slug;
}

function defaultPeriodsForSport(sport: ResultsSportSlug): number {
  if (sport === "soccer") return 1;
  if (sport === "basketball") return 4;
  if (sport === "hockey") return 3;
  if (sport === "tennis") return 2;
  if (sport === "table-tennis" || sport === "volleyball") return 3;
  return 1;
}

function maxPeriodsForSport(sport: ResultsSportSlug): number {
  if (sport === "tennis") return 5;
  if (sport === "table-tennis" || sport === "volleyball") return 7;
  if (sport === "basketball") return 4;
  if (sport === "hockey") return 5;
  return 4;
}

function formatPeriodsText(
  periods: Array<{ home: number; away: number } | null>,
): string {
  const parts = periods
    .filter((p): p is { home: number; away: number } => p != null)
    .map((p) => `${p.home}:${p.away}`);
  return parts.length ? `(${parts.join(", ")})` : "";
}

function formatSettledAt(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Almaty",
  }).format(new Date(iso));
}

function ScorePair({
  home,
  away,
  muted = false,
  live = false,
}: {
  home: number | null;
  away: number | null;
  muted?: boolean;
  live?: boolean;
}) {
  if (home == null || away == null) {
    return <span className={cn(styles.scoreDash, muted && styles.scoreMuted)}>—</span>;
  }

  return (
    <span
      className={cn(
        styles.scorePair,
        muted && styles.scoreMuted,
        live && styles.scoreLive,
      )}
    >
      <span>{home}</span>
      <span className={styles.scoreColon}>:</span>
      <span>{away}</span>
    </span>
  );
}

function resolvePeriods(match: MatchResultItem, sport: ResultsSportSlug) {
  if (match.periodScores.length > 0) {
    return match.periodScores;
  }
  if (match.halfTimeHome != null && match.halfTimeAway != null) {
    return [{ home: match.halfTimeHome, away: match.halfTimeAway }];
  }
  if (sport === "soccer" && !match.isLive) {
    return [];
  }
  return [];
}

function ResultRow({
  match,
  sport,
  maxPeriods,
}: {
  match: MatchResultItem;
  sport: ResultsSportSlug;
  maxPeriods: number;
}) {
  const periods = resolvePeriods(match, sport);
  const periodSlots = Array.from({ length: maxPeriods }, (_, index) => periods[index] ?? null);
  const scoreGridStyle = {
    gridTemplateColumns: `repeat(${maxPeriods}, var(--score-col-w)) var(--score-col-w)`,
  };

  return (
    <div className={styles.matchRow}>
      <Link className={styles.matchMain} href={match.href}>
        <div className={styles.matchStart}>
          <span className={styles.matchTime}>{formatKickoff(match.commenceTime)}</span>
          {match.settledAt && !match.isLive ? (
            <span className={styles.settledTime}>{formatSettledAt(match.settledAt)}</span>
          ) : null}
        </div>
        <div className={styles.matchSeparator} />
        <div className={styles.matchTeams}>
          <span className={styles.team}>
            <WcTeamImage
              competitorId={match.homeCompetitorId}
              iconUrl={match.homeTeamIcon}
              size={16}
              teamName={match.homeTeam}
            />
            <span className={styles.teamName}>{match.homeTeam}</span>
          </span>
          <span className={styles.team}>
            <WcTeamImage
              competitorId={match.awayCompetitorId}
              iconUrl={match.awayTeamIcon}
              size={16}
              teamName={match.awayTeam}
            />
            <span className={styles.teamName}>{match.awayTeam}</span>
          </span>
          {(match.isPriority || match.hasBroadcast || match.penaltyScore) && (
            <span className={styles.metaBadges}>
              {match.isPriority && <span className={styles.metaBadge}>Top</span>}
              {match.hasBroadcast && <span className={styles.metaBadge}>TV</span>}
              {match.penaltyScore && (
                <span className={styles.metaBadge}>
                  Пен. {match.penaltyScore.home}:{match.penaltyScore.away}
                </span>
              )}
            </span>
          )}
        </div>
        <div className={styles.matchStatsMobile}>
          {match.isLive && <span className={styles.liveDot} />}
          <span
            className={cn(
              styles.scoreTotalMobile,
              match.isLive && styles.scoreTotalMobile_live,
            )}
          >
            {match.homeScore}:{match.awayScore}
          </span>
          {maxPeriods > 0 && (
            <span className={styles.periodsMobile}>
              {formatPeriodsText(periodSlots)}
            </span>
          )}
          <span className={styles.rowChevron} aria-hidden>›</span>
        </div>
      </Link>
      <div className={styles.scoreRow} style={scoreGridStyle}>
        {periodSlots.map((period, index) => (
          <div className={styles.scoreCell} key={`${match.id}-p-${index}`}>
            <ScorePair away={period?.away ?? null} home={period?.home ?? null} muted />
          </div>
        ))}
        <div className={cn(styles.scoreCell, styles.scoreCell_total)}>
          {match.isLive && <span className={styles.liveDot} />}
          <ScorePair
            away={match.awayScore}
            home={match.homeScore}
            live={match.isLive}
          />
        </div>
      </div>
    </div>
  );
}

export function MatchResultsPage({ className }: { className?: string }) {
  const today = useMemo(() => formatAlmatyDateInput(), []);
  const [date, setDate] = useState(today);
  const [sport, setSport] = useState<ResultsSportSlug>("soccer");
  const [mode, setMode] = useState<MatchResultsMode>("finished");

  const SportIcon = gamesList[sport]?.Icon;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["match-results", sport, date, mode],
    queryFn: () => fetchMatchResults({ sport, date, mode }),
    staleTime: mode === "live" ? 15_000 : 60_000,
    refetchInterval: mode === "live" ? 30_000 : false,
  });

  const shiftDate = (deltaDays: number) => {
    const base = new Date(`${date}T12:00:00+05:00`);
    base.setDate(base.getDate() + deltaDays);
    setDate(formatAlmatyDateInput(base));
  };

  const maxPeriods = useMemo(() => {
    if (!data?.groups.length) return defaultPeriodsForSport(sport);
    let max = defaultPeriodsForSport(sport);
    for (const group of data.groups) {
      for (const match of group.matches) {
        const count = resolvePeriods(match, sport).length;
        if (count > max) max = count;
      }
    }
    return Math.min(max, maxPeriodsForSport(sport));
  }, [data, sport]);

  const headScoreStyle = {
    gridTemplateColumns: `repeat(${maxPeriods}, var(--score-col-w)) var(--score-col-w)`,
  };

  const emptyText =
    mode === "live"
      ? `Сейчас нет live-матчей (${sportLabel(sport).toLowerCase()}).`
      : `За ${formatDisplayDate(date)} завершённых матчей нет.`;

  const subtitle =
    mode === "live"
      ? `Live-счёт · ${sportLabel(sport).toLowerCase()}`
      : `${formatDisplayDate(date)} · ${sportLabel(sport).toLowerCase()}`;

  return (
    <div className={cn(styles.page, className)}>
      <div className={styles.pageTop}>
        <div className={styles.tabGroup}>
          <h1 className={styles.tabPrimary}>Результаты</h1>
        </div>

        <div className={styles.toolbarCard}>
          <div className={styles.toolbarRow}>
            <div className={styles.modeSegment}>
              <button
                className={cn(styles.modeTab, mode === "finished" && styles.modeTab_active)}
                onClick={() => setMode("finished")}
                type="button"
              >
                Завершённые
              </button>
              <button
                className={cn(styles.modeTab, mode === "live" && styles.modeTab_active)}
                onClick={() => setMode("live")}
                type="button"
              >
                {mode === "live" && <span className={styles.liveDot} />}
                Live
              </button>
            </div>

            {mode === "finished" ? (
              <div className={styles.dateNav}>
                <button className={styles.dateBtn} onClick={() => shiftDate(-1)} type="button">
                  ←
                </button>
                <label className={styles.datePicker}>
                  <span className={styles.dateLabel}>{formatDisplayDate(date)}</span>
                  <input
                    className={styles.dateInput}
                    max={today}
                    onChange={(e) => setDate(e.target.value)}
                    type="date"
                    value={date}
                  />
                </label>
                <button
                  className={styles.dateBtn}
                  disabled={date >= today}
                  onClick={() => shiftDate(1)}
                  type="button"
                >
                  →
                </button>
              </div>
            ) : (
              <p className={styles.subtitle}>{subtitle}</p>
            )}
          </div>

          <div className={styles.sportRow}>
            {RESULTS_SPORTS.map((item) => {
              const Icon = gamesList[item.slug]?.Icon;
              return (
                <button
                  className={cn(
                    styles.sportChip,
                    sport === item.slug && styles.sportChip_active,
                  )}
                  key={item.slug}
                  onClick={() => setSport(item.slug)}
                  type="button"
                >
                  {Icon ? <Icon className={styles.sportIcon} /> : null}
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner className={styles.loader} />
      ) : isError ? (
        <div className={styles.emptyCard}>
          <p className={styles.emptyTitle}>Не удалось загрузить результаты</p>
          <p className={styles.emptyHint}>Проверьте соединение и попробуйте снова.</p>
          <button className={styles.retryBtn} onClick={() => void refetch()} type="button">
            Повторить
          </button>
        </div>
      ) : !data?.groups.length ? (
        <div className={styles.emptyCard}>
          <p className={styles.emptyTitle}>{emptyText}</p>
          <p className={styles.emptyHint}>Попробуйте другую дату или вид спорта.</p>
        </div>
      ) : (
        <div className={styles.groups}>
          {data.groups.map((group) => (
            <section className={styles.tournament} key={group.leagueName}>
              <div className={styles.tournamentHead}>
                <div className={styles.leagueCell}>
                  {SportIcon ? <SportIcon className={styles.leagueIcon} /> : null}
                  <p className={styles.leagueName}>{group.leagueName}</p>
                </div>
                {maxPeriods > 0 && (
                  <div className={styles.headScores} style={headScoreStyle}>
                    {Array.from({ length: maxPeriods }, (_, index) => (
                      <div className={styles.headCell} key={`head-${index}`}>
                        {periodLabel(sport, index)}
                      </div>
                    ))}
                    <div className={styles.headCell}>
                      {mode === "live" ? "Live" : "Итог"}
                    </div>
                  </div>
                )}
              </div>
              {group.matches.map((match) => (
                <ResultRow
                  key={match.id}
                  match={match}
                  maxPeriods={maxPeriods}
                  sport={sport}
                />
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
