"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  GiGoalKeeper,
  GiCornerFlag,
  GiCrosshair,
} from "react-icons/gi";
import {
  TbBolt,
  TbFlagFilled,
  TbArrowsExchange,
  TbCards,
  TbClockHour4,
} from "react-icons/tb";
import {
  MdSportsTennis,
  MdOutlineSports,
  MdOutlineCompareArrows,
  MdOutlineSportsSoccer,
} from "react-icons/md";

import type { WcEventDetail } from "~/entities/wc-odds/api/client";
import { isSoccerLikeSport, isBasketballLikeSport } from "~/entities/wc-odds/lib/wcSportKinds";
import { isEsportsMapScoreSport } from "~/entities/wc-odds/lib/wcEsportsScore";
import { getSportBackgroundCss } from "~/entities/game/lib/sportBackground";
import { isStaleSoccerBreak } from "~/entities/wc-odds/lib/wcSoccerPhase";
import {
  formatTennisGameScore,
  resolveWcDisplayPeriod,
  sportUsesTennisPointScore,
} from "~/entities/wc-odds/lib/wcLiveScore";
import { isWcMatchEffectivelyFinished } from "~/entities/wc-odds/lib/wcLiveClock";
import { isWcFeedPaused, wcFeedPausedLabel } from "~/entities/wc-odds/lib/wcFeedStatus";
import { WcLiveMatchClockBar } from "~/entities/wc-odds/ui/WcLiveMatchClock";
import { getWcSoccerCardCounts, teamHasCards } from "~/entities/wc-odds/lib/wcSoccerCards";
import { WcPrematchKickoffCountdown } from "~/entities/wc-odds/ui/WcPrematchKickoffCountdown";
import { WcTeamCardBadges } from "~/entities/wc-odds/ui/WcTeamCardBadges";
import { WcTeamImage } from "~/entities/wc-odds/ui/WcTeamImage";
import { BroadcastIcon, StatsIcon } from "~/shared/assets";
import { cn } from "~/shared/lib";

import scoreStyles from "~/entities/game/ui/Match/ScoreBoard.module.css";
import styles from "~/entities/wc-odds/ui/WcScoreBoard.module.css";

type WcScoreBoardProps = {
  event: WcEventDetail;
  showBroadcastLink?: boolean;
  onBroadcastOpen?: () => void;
  telegramAction?: ReactNode;
};

function BroadcastLink({
  show,
  onOpen,
  variant = "inline",
}: {
  show?: boolean;
  onOpen?: () => void;
  variant?: "inline" | "meta";
}) {
  if (!show || !onOpen) return null;

  return (
    <button
      className={cn(
        styles.broadcastLink,
        variant === "meta" && styles.broadcastLink_meta,
      )}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      type="button"
    >
      <span className={styles.broadcastLinkIconWrap}>
        <BroadcastIcon className={styles.broadcastLinkIcon} />
      </span>
      Видеотрансляция
    </button>
  );
}

function MetaBar({
  leagueName,
  status,
  showBroadcastLink,
  onBroadcastOpen,
  telegramAction,
}: {
  leagueName: string;
  status: ReactNode;
  showBroadcastLink?: boolean;
  onBroadcastOpen?: () => void;
  telegramAction?: ReactNode;
}) {
  return (
    <div className={styles.metaBar}>
      <div className={styles.metaBar_league}>{leagueName}</div>
      <div className={styles.metaBar_right}>
        <div className={styles.metaBar_status}>{status}</div>
        {telegramAction}
        <BroadcastLink
          variant="meta"
          show={showBroadcastLink}
          onOpen={onBroadcastOpen}
        />
      </div>
    </div>
  );
}

const SET_SPORTS = new Set(["tennis", "table-tennis", "volleyball"]);

const COL_PREFIX: Record<string, string> = {
  basketball:    "Ч",
  "cyber-basketball": "Ч",
  hockey:        "П",
  soccer:        "Т",
  "cyber-football": "Т",
  "esports.cs":  "К",
  "esports.dota2": "К",
  "esports.valorant": "К",
  "table-tennis":"С",
  tennis:        "С",
  volleyball:    "С",
};

const PERIOD_FULL: Record<string, string> = {
  basketball:    "четверть",
  "cyber-basketball": "четверть",
  hockey:        "период",
  soccer:        "тайм",
  "cyber-football": "тайм",
  "esports.cs":  "карта",
  "esports.dota2": "карта",
  "esports.valorant": "карта",
  "table-tennis":"сет",
  tennis:        "сет",
  volleyball:    "сет",
};

const GAME_PHASE_LABELS: Record<string, string> = {
  extra_time_1: "Доп. время 1",
  extra_time_2: "Доп. время 2",
  penalties:    "Серия пенальти",
  break:        "Перерыв",
};

/** Sport-specific label for the "penalties" game phase */
function getPenaltiesPhaseLabel(sport: string): string {
  switch (sport) {
    case "tennis":
    case "table-tennis":
    case "volleyball":
    case "beach-volleyball":
    case "badminton":
    case "squash":
      return "Тай-брейк";
    case "hockey":
    case "bandy":
    case "floorball":
      return "Буллиты";
    default:
      return "Серия пенальти";
  }
}

// ── Stat metadata: icon component + label ─────────────────────────────────
type StatMeta = { icon: React.ReactNode; label: string };

const STAT_META: Record<string, StatMeta> = {
  possession:        { icon: <MdOutlineSportsSoccer />,   label: "Владение" },
  shots_on:          { icon: <GiGoalKeeper />,            label: "Удары в створ" },
  shots_off:         { icon: <GiCrosshair />,             label: "Удары мимо" },
  dangerous_attacks: { icon: <TbBolt />,                  label: "Опасные атаки" },
  fouls:             { icon: <MdOutlineSports />,          label: "Фолы" },
  offsides:          { icon: <TbFlagFilled />,             label: "Офсайды" },
  substitutions:     { icon: <TbArrowsExchange />,         label: "Замены" },
  corners:           { icon: <GiCornerFlag />,             label: "Угловые" },
  yellow_cards:      { icon: <TbCards />,                  label: "Жёлтые" },
  red_cards:         { icon: <TbCards />,                  label: "Красные" },
  yellow_red_cards:  { icon: <TbCards />,                  label: "Ж/К" },
  penalty_minutes:   { icon: <TbClockHour4 />,             label: "Штрафи" },
  free_kicks:        { icon: <MdOutlineSportsSoccer />,   label: "Штрафные" },
  penalty_score:     { icon: <MdOutlineSportsSoccer />,   label: "Пенальти" },
  extra_time_score:  { icon: <TbClockHour4 />,             label: "Голы в доп. время" },
  shots:             { icon: <GiCrosshair />,             label: "Удары" },
  saves:             { icon: <GiGoalKeeper />,            label: "Сейвы" },
  woodwork:          { icon: <MdOutlineSportsSoccer />,   label: "Штанга" },
  goal_kicks:        { icon: <MdOutlineSportsSoccer />,   label: "От ворот" },
  outs:              { icon: <MdOutlineSports />,          label: "Ауты" },
  expected_goals:    { icon: <GiCrosshair />,             label: "xG" },
  aerial_duels:      { icon: <MdOutlineCompareArrows />,   label: "Верховые" },
  interceptions:     { icon: <TbArrowsExchange />,         label: "Перехваты" },
  dribbles:          { icon: <MdOutlineSportsSoccer />,   label: "Обводки" },
  tackles:           { icon: <MdOutlineSports />,          label: "Отборы" },
  players_on_ice:    { icon: <MdOutlineSports />,          label: "На льду" },
  aces:              { icon: <MdSportsTennis />,           label: "Эйсы" },
  double_faults:     { icon: <MdOutlineCompareArrows />,   label: "Двойные ошибки" },
  server:            { icon: <MdSportsTennis />,           label: "Подача" },
};

// ── Helpers ────────────────────────────────────────────────────────────────

// ── ValueChange animation ─────────────────────────────────────────────────
function ValueChange({ value, className }: { value: string | number; className?: string }) {
  const [prev, setPrev] = useState(value);
  const [type, setType] = useState<"increased" | "decreased" | null>(null);
  useEffect(() => {
    if (value !== prev) {
      setType(Number(value) > Number(prev) ? "increased" : "decreased");
      setPrev(value);
      const t = setTimeout(() => setType(null), 1000);
      return () => clearTimeout(t);
    }
  }, [value, prev]);
  return (
    <span className={cn(className,
      type === "increased" && scoreStyles["value-increased"],
      type === "decreased" && scoreStyles["value-decreased"],
    )}>{value}</span>
  );
}

// ── Inline stat columns (compact table header icons) ──────────────────────
type StatCol = { id: string; icon: React.ReactNode; iconLabel: string; home: string; away: string };

function buildStatCols(event: WcEventDetail): StatCol[] {
  const cols: StatCol[] = [];
  const pick = (id: string) => event.statList?.find((s) => s.id === id);
  const add = (id: string) => {
    const s = pick(id);
    if (!s) return;
    const meta = STAT_META[id];
    cols.push({ id, icon: meta?.icon ?? null, iconLabel: meta?.label ?? id, home: s.opp1, away: s.opp2 });
  };

  if (isSoccerLikeSport(event.sport)) {
    add("yellow_cards");
    const r = pick("red_cards");
    if (r && (Number(r.opp1) > 0 || Number(r.opp2) > 0)) add("red_cards");
    const yr = pick("yellow_red_cards");
    if (yr && (Number(yr.opp1) > 0 || Number(yr.opp2) > 0)) add("yellow_red_cards");
    add("corners");
  }
  if (isBasketballLikeSport(event.sport)) add("fouls");
  if (event.sport === "hockey") {
    add("penalty_minutes");
    add("shots_on");
    add("players_on_ice");
  }
  if (event.sport === "volleyball") add("aces");
  if (event.sport === "tennis" || event.sport === "table-tennis") {
    add("aces");
    add("double_faults");
  }

  return cols;
}

// ── Progress bar stats block (football only) ─────────────────────────────
const STATS_BLOCK_SPORTS = new Set([
  "soccer",
  "cyber-football",
  "hockey",
  "basketball",
  "cyber-basketball",
  "tennis",
  "table-tennis",
  "volleyball",
]);

const STATS_STICKY_MS = 4000;

function StatsBlock({ event }: { event: WcEventDetail }) {
  const [open, setOpen] = useState(false);
  const rows = useMemo(
    () => (event.statList ?? []).filter((s) => s.id !== "server"),
    [event.statList],
  );
  const stickyRef = useRef<{ rows: typeof rows; at: number } | null>(null);
  const [displayRows, setDisplayRows] = useState(rows);

  useEffect(() => {
    if (rows.length > 0) {
      stickyRef.current = { rows, at: Date.now() };
      setDisplayRows(rows);
      return undefined;
    }

    const sticky = stickyRef.current;
    if (sticky && Date.now() - sticky.at < STATS_STICKY_MS) {
      setDisplayRows(sticky.rows);
      const left = STATS_STICKY_MS - (Date.now() - sticky.at);
      const timer = window.setTimeout(() => setDisplayRows([]), left);
      return () => window.clearTimeout(timer);
    }

    setDisplayRows([]);
    return undefined;
  }, [rows]);

  if (!STATS_BLOCK_SPORTS.has(event.sport) || displayRows.length === 0) return null;

  return (
    <div className={styles.statsWrap}>
      <button
        type="button"
        className={cn(styles.statsToggle, open && styles.statsToggle_open)}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <StatsIcon className={styles.statsToggleIcon} aria-hidden />
        <span className={styles.statsToggleLabel}>Статистика</span>
        <span className={cn(styles.statsToggleChevron, open && styles.statsToggleChevron_open)} />
      </button>

      {open && (
        <div className={styles.statsBlock}>
          <div className={styles.statsBlock_header}>
            <span className={styles.statsBlock_homeTeam}>{event.homeTeam}</span>
            <span className={styles.statsBlock_title}>Статистика</span>
            <span className={styles.statsBlock_awayTeam}>{event.awayTeam}</span>
          </div>
          {displayRows.map((row) => {
            const meta = STAT_META[row.id];
            const isPossession = row.id === "possession";
            const parsedHome = Number(row.opp1);
            const parsedAway = Number(row.opp2);
            const h = Number.isFinite(parsedHome) ? parsedHome : 0;
            const a = Number.isFinite(parsedAway) ? parsedAway : 0;
            const homePct = isPossession ? h : (h + a > 0 ? Math.round((h / (h + a)) * 100) : 50);
            const awayPct = 100 - homePct;
            const homeLeads = h > a;
            const awayLeads = a > h;
            const suffix = isPossession ? "%" : "";
            return (
              <div key={row.id} className={styles.statsRow}>
                <div className={styles.statsLabel}>
                  {meta?.icon && <span className={styles.statIcon}>{meta.icon}</span>}
                  <span className={styles.statLabelText}>{meta?.label ?? row.name}</span>
                </div>
                <span className={cn(styles.statsVal, homeLeads && styles.statsVal_lead)}>{h}{suffix}</span>
                <div className={styles.barTrack}>
                  <div className={styles.barHome} style={{ width: `${homePct}%` }} />
                  <div className={styles.barAway} style={{ width: `${awayPct}%` }} />
                </div>
                <span className={cn(styles.statsVal, styles.statsVal_right, awayLeads && styles.statsVal_lead)}>{a}{suffix}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Prematch view ─────────────────────────────────────────────────────────
function PrematchView({ event, showBroadcastLink, onBroadcastOpen, telegramAction }: WcScoreBoardProps) {
  return (
    <div className={styles.wcScoreBoard} style={{
      background: getSportBackgroundCss(event.sport),
    }}>
      <MetaBar
        leagueName={event.leagueName}
        status={<span className={styles.prematchMetaPill}>Линия</span>}
        showBroadcastLink={showBroadcastLink}
        onBroadcastOpen={onBroadcastOpen}
        telegramAction={telegramAction}
      />

      <div className={styles.prematchBody}>
        <div className={styles.prematchSide}>
          <WcTeamImage teamName={event.homeTeam} iconUrl={event.homeTeamIcon} size={56} rounded />
          <span className={styles.prematchTeamName}>{event.homeTeam}</span>
        </div>

        <div className={styles.prematchCenter}>
          <WcPrematchKickoffCountdown commenceTime={event.commenceTime} />
        </div>

        <div className={styles.prematchSide}>
          <WcTeamImage teamName={event.awayTeam} iconUrl={event.awayTeamIcon} size={56} rounded />
          <span className={styles.prematchTeamName}>{event.awayTeam}</span>
        </div>
      </div>
    </div>
  );
}

// ── Main scoreboard ────────────────────────────────────────────────────────
export function WcScoreBoard({
  event,
  showBroadcastLink,
  onBroadcastOpen,
  telegramAction,
}: WcScoreBoardProps) {
  const score = event.parsedScore;

  const isLive     = event.phase === "live" && !isWcMatchEffectivelyFinished(event);
  const isFinished = event.phase === "finished" || isWcMatchEffectivelyFinished(event);
  const isPrematch = event.phase === "prematch";
  const isSetSport = SET_SPORTS.has(event.sport);
  const isEsportsMap = isEsportsMapScoreSport(event.sport);

  const rawGamePhase     = score?.gamePhase ?? null;
  const isStaleBreak     = rawGamePhase === "break" && isStaleSoccerBreak(score ?? undefined);
  const gamePhase        = isStaleBreak ? null : rawGamePhase;
  const gamePhaseLabel   = gamePhase ? (GAME_PHASE_LABELS[gamePhase] ?? null) : null;
  const isBreak          = gamePhase === "break";
  const isClassicSoccer = event.sport === "soccer";

  // ── Period data ─────────────────────────────────────────────────────────
  const details    = score?.details ?? [];

  // Detect penalty shootout: either explicit gamePhase or 5+ periods in details
  const isPenaltiesPhase = gamePhase === "penalties" || (isClassicSoccer && isLive && details.length >= 5);

  const showLiveClockBar = isLive && !isSetSport && !isBreak && !isPenaltiesPhase && !isEsportsMap;
  const colPrefix  = COL_PREFIX[event.sport]
    ?? (event.sport.startsWith("esports.") ? "К" : "П");
  const periodStr  = PERIOD_FULL[event.sport]
    ?? (event.sport.startsWith("esports.") ? "карта" : "период");
  const varState = score?.varState ?? null;
  const penaltyRisk = score?.penaltyRisk === true;
  const feedPaused = isWcFeedPaused(event.feedStatus);
  const pausedLabel = wcFeedPausedLabel("ru");

  const currentPeriodIdx = isEsportsMap && isLive && details.length > 0
    ? details.length - 1
    : isSetSport
      ? details.length - 1
      : Math.max(0, resolveWcDisplayPeriod(event.sport, score?.period, details.length) - 1);

  const esportsCurrentRound = useMemo(() => {
    if (!isEsportsMap || !isLive || details.length === 0) return null;
    const [home, away] = details[currentPeriodIdx] ?? [];
    if (home == null || away == null) return null;
    return `${home}:${away}`;
  }, [currentPeriodIdx, details, isEsportsMap, isLive]);

  // Current game score for tennis ("40:30", "40:A" etc.)
  const currentGameScore = useMemo(() => {
    if (!isSetSport) return null;
    const raw = score?.text?.liveScore ?? null;
    if (!raw) return null;
    if (sportUsesTennisPointScore(event.sport)) {
      return formatTennisGameScore(raw) ?? raw;
    }
    return raw;
  }, [isSetSport, score?.text?.liveScore, event.sport]);

  // Serving player: 1=home, 2=away
  const serving = score?.liveScore?.active ?? null;

  // Status line ("2 сет", "1 тайм", "Доп. время 1")
  const statusLine = useMemo(() => {
    if (!isLive) return null;
    if (isPenaltiesPhase) return getPenaltiesPhaseLabel(event.sport);
    if (gamePhaseLabel) return gamePhaseLabel;
    if (isEsportsMap) return details.length > 0 ? `Карта ${details.length}` : "Live";
    if (isSetSport) return details.length > 0 ? `${details.length} ${periodStr}` : null;
    const p = resolveWcDisplayPeriod(event.sport, score?.period, details.length);
    return p > 0 ? `${p} ${periodStr}` : null;
  }, [isLive, isPenaltiesPhase, gamePhaseLabel, isSetSport, isEsportsMap, details.length, periodStr, score?.period, event.sport]);

  // ── Stat columns (inline in table header) ──────────────────────────────
  const statCols = useMemo(() => buildStatCols(event), [event]);

  const hasStatsProgressBlock = useMemo(() => {
    if (!STATS_BLOCK_SPORTS.has(event.sport)) return false;
    return (event.statList ?? []).some((s) => s.id !== "server");
  }, [event.sport, event.statList]);

  /** Aces / double faults etc. — only in progress block, not duplicate columns. */
  const displayStatCols = hasStatsProgressBlock ? [] : statCols;

  const cardCounts = useMemo(
    () => getWcSoccerCardCounts(event, isLive),
    [event, isLive],
  );

  // ── Total score ─────────────────────────────────────────────────────────
  const homeTotal = isSetSport
    ? (score?.currentScore?.[0] ?? event.homeScore ?? "-")
    : (event.homeScore ?? score?.currentScore?.[0] ?? "-");
  const awayTotal = isSetSport
    ? (score?.currentScore?.[1] ?? event.awayScore ?? "-")
    : (event.awayScore ?? score?.currentScore?.[1] ?? "-");

  // Sets score string for metaBar
  const setsScore = useMemo(() => {
    if (!isSetSport) return null;
    const cs = score?.currentScore;
    if (cs) return `${cs[0]}:${cs[1]}`;
    if (event.homeScore != null) return `${event.homeScore}:${event.awayScore}`;
    return null;
  }, [event.homeScore, event.awayScore, isSetSport, score?.currentScore]);

  // ── Basketball: current quarter from total − completed ──────────────────
  const bballCurrent = useMemo(() => {
    if (event.sport !== "basketball" || !isLive || details.length === 0) return null;
    const sumHome = details.reduce((s, [h]) => s + Number(h), 0);
    const sumAway = details.reduce((s, [, a]) => s + Number(a), 0);
    const ch = Number(homeTotal) - sumHome;
    const ca = Number(awayTotal) - sumAway;
    if (ch < 0 || ca < 0) return null;
    return { home: ch, away: ca };
  }, [event.sport, isLive, details, homeTotal, awayTotal]);

  const extraCols = bballCurrent ? 1 : 0;
  const gridTemplate = [
    "1fr",
    "3.25rem",
    ...details.map(() => "2.875rem"),
    ...Array(extraCols).fill("2.875rem"),
    ...displayStatCols.map(() => "2.5rem"),
  ].join(" ");

  if (isPrematch) {
    return (
      <PrematchView
        event={event}
        onBroadcastOpen={onBroadcastOpen}
        showBroadcastLink={showBroadcastLink}
        telegramAction={telegramAction}
      />
    );
  }

  return (
    <div className={styles.wcScoreBoard} style={{
      background: getSportBackgroundCss(event.sport),
    }}>

      {/* ── Meta bar ──────────────────────────────────── */}
      <MetaBar
        leagueName={event.leagueName}
        status={
          <>
            {isFinished && "Окончена"}
            {isLive && feedPaused && (
              <span className={styles.suspendedPill} title={pausedLabel}>
                {pausedLabel}
              </span>
            )}
            {isLive && !feedPaused && isPenaltiesPhase && getPenaltiesPhaseLabel(event.sport)}
            {isLive && !feedPaused && !isPenaltiesPhase && !isSetSport && isBreak && (gamePhaseLabel ?? "Перерыв")}
            {isLive && !feedPaused && isSetSport && (setsScore ? `Сеты ${setsScore}` : "Live")}
          </>
        }
        showBroadcastLink={showBroadcastLink}
        onBroadcastOpen={onBroadcastOpen}
        telegramAction={telegramAction}
      />

      {showLiveClockBar && !feedPaused ? (
        <WcLiveMatchClockBar
          event={event}
          periodLabel={statusLine}
        />
      ) : null}

      {isLive && feedPaused ? (
        <div className={styles.liveClockBar}>
          <span className={styles.suspendedBanner} title={pausedLabel}>
            {pausedLabel}
          </span>
        </div>
      ) : null}

      {isLive && !feedPaused && isEsportsMap && (statusLine || esportsCurrentRound) ? (
        <div className={styles.liveClockBar}>
          <span className={styles.matchClockPill}>
            <span className={styles.timerDot} aria-hidden />
            {statusLine ? (
              <span className={styles.matchClockPeriod}>{statusLine}</span>
            ) : null}
            {esportsCurrentRound ? (
              <span className={styles.matchClockGameScore}>{esportsCurrentRound}</span>
            ) : null}
          </span>
        </div>
      ) : null}

      {isLive && !feedPaused && isSetSport && statusLine ? (
        <div className={styles.liveClockBar}>
          <span className={styles.matchClockPill}>
            <span className={styles.timerDot} aria-hidden />
            <span className={styles.matchClockPeriod}>{statusLine}</span>
          </span>
        </div>
      ) : null}

      {/* ── SET SPORTS LIVE — per-player rows [name | set scores] */}
      {isLive && isSetSport ? (
        <div className={styles.setMatchLayout}>
          {currentGameScore ? (
            <div className={styles.setGameScoreCenter}>
              <span className={styles.matchClockPill}>
                <span className={styles.matchClockGameScore}>{currentGameScore}</span>
              </span>
            </div>
          ) : null}

          <div className={styles.setScoresHeader}>
            <div className={styles.setScoresHeaderSpacer} aria-hidden />
            <div className={styles.setPlayerScores}>
              <div className={cn(styles.cell_header, styles.cell_header_total, styles.setColHeader)}>
                С
              </div>
              {details.map((_, i) => {
                const isCurrent = i === currentPeriodIdx;
                const isDone = i < currentPeriodIdx;
                return (
                  <div
                    key={i}
                    className={cn(
                      styles.cell_header,
                      styles.setColHeader,
                      isCurrent && styles.cell_header_active,
                      isDone && styles.cell_header_done,
                    )}
                  >
                    {colPrefix}{i + 1}
                  </div>
                );
              })}
              {displayStatCols.map((col) => (
                <div
                  key={col.id}
                  title={col.iconLabel}
                  className={cn(styles.cell_header, styles.cell_header_stat, styles.setColHeader)}
                >
                  {col.icon}
                </div>
              ))}
            </div>
          </div>

          <div className={styles.setPlayerRow}>
            <div className={cn(styles.cell_team, serving === 1 && styles.cell_team_serving)}>
              <div className={styles.teamRowMain}>
                <WcTeamImage teamName={event.homeTeam} iconUrl={event.homeTeamIcon} size={24} />
                <div className={styles.teamNameWithServe}>
                  <span className={styles.teamNameCompact}>{event.homeTeam}</span>
                  {serving === 1 && <span className={styles.serveDot} />}
                </div>
              </div>
            </div>
            <div className={styles.setPlayerScores}>
              <div className={styles.cell_totalScore}><ValueChange value={String(homeTotal)} /></div>
              {details.map(([h], i) => {
                const isCurrent = i === currentPeriodIdx;
                const isDone    = i < currentPeriodIdx;
                const won       = isDone && Number(h) > Number(details[i][1]);
                return (
                  <div key={i} className={cn(styles.cell_periodScore,
                    isCurrent && styles.cell_periodScore_current,
                    won       && styles.cell_periodScore_won)}>{h}</div>
                );
              })}
              {displayStatCols.map((col) => (
                <div key={col.id} className={cn(styles.cell_statValue,
                  col.id === "yellow_cards" && styles.cell_stat_yellow,
                  col.id === "red_cards"    && styles.cell_stat_red)}>{col.home}</div>
              ))}
            </div>
          </div>

          <div className={cn(styles.setPlayerRow, styles.setPlayerRow_away)}>
            <div
              className={cn(
                styles.cell_team,
                serving === 2 && styles.cell_team_serving,
              )}
            >
              <div className={styles.teamRowMain}>
                <WcTeamImage teamName={event.awayTeam} iconUrl={event.awayTeamIcon} size={24} />
                <div className={styles.teamNameWithServe}>
                  <span className={styles.teamNameCompact}>{event.awayTeam}</span>
                  {serving === 2 && <span className={styles.serveDot} />}
                </div>
              </div>
            </div>
            <div className={styles.setPlayerScores}>
              <div className={styles.cell_totalScore}><ValueChange value={String(awayTotal)} /></div>
              {details.map(([, a], i) => {
                const isCurrent = i === currentPeriodIdx;
                const isDone    = i < currentPeriodIdx;
                const won       = isDone && Number(a) > Number(details[i][0]);
                return (
                  <div key={i} className={cn(styles.cell_periodScore,
                    isCurrent && styles.cell_periodScore_current,
                    won       && styles.cell_periodScore_won)}>{a}</div>
                );
              })}
              {displayStatCols.map((col) => (
                <div key={col.id} className={cn(styles.cell_statValue,
                  col.id === "yellow_cards" && styles.cell_stat_yellow,
                  col.id === "red_cards"    && styles.cell_stat_red)}>{col.away}</div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div
          className={styles.compactTable}
          style={{ gridTemplateColumns: gridTemplate }}
        >
          {isFinished && (
            <div className={styles.headerStatusSpanned}>
              <span className={styles.finishedPill}>Окончена</span>
            </div>
          )}

          {isLive && isPenaltiesPhase && (
            <div className={styles.headerStatusSpanned}>
              <span className={styles.penaltiesLabel}>{getPenaltiesPhaseLabel(event.sport)}</span>
            </div>
          )}

          {isLive && !isPenaltiesPhase && !isSetSport && isBreak && (
            <div className={styles.headerStatusSpanned}>
              <span className={styles.gamePhaseLabel}>{gamePhaseLabel ?? "Перерыв"}</span>
            </div>
          )}

          <div className={styles.cell_teamHeader}>
            {showLiveClockBar ? (
              <div className={styles.headerStatusLeft}>
                {isClassicSoccer && varState ? (
                  <span className={styles.varPill}>{varState}</span>
                ) : null}
                {isClassicSoccer && penaltyRisk ? (
                  <span className={styles.penaltyRiskPill}>Пен.</span>
                ) : null}
                {feedPaused ? (
                  <span className={styles.suspendedPill} title={pausedLabel}>
                    {pausedLabel}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className={cn(styles.cell_header, styles.cell_header_total)} />
          {details.map((_, i) => {
            const isCurrent = isLive && i === currentPeriodIdx;
            const isDone    = isLive && i < currentPeriodIdx;
            const isPenCol  = isPenaltiesPhase && i === 4;
            return (
              <div key={i} className={cn(styles.cell_header,
                isCurrent && styles.cell_header_active,
                isDone    && styles.cell_header_done,
                isPenCol  && styles.cell_header_penalties)}>
                {isPenCol ? "Пен" : `${colPrefix}${i + 1}`}
              </div>
            );
          })}
          {bballCurrent && (
            <div className={cn(styles.cell_header, styles.cell_header_active)}>
              {colPrefix}{details.length + 1}
            </div>
          )}
          {displayStatCols.map((col) => (
            <div key={col.id} title={col.iconLabel}
              className={cn(styles.cell_header, styles.cell_header_stat,
                col.id === "yellow_cards" && styles.cell_header_yellow,
                col.id === "red_cards"    && styles.cell_header_red)}>
              {col.icon}
            </div>
          ))}

          <div className={cn(styles.cell_team, serving === 1 && styles.cell_team_serving)}>
            <div className={styles.teamRowMain}>
              <WcTeamImage teamName={event.homeTeam} iconUrl={event.homeTeamIcon} size={24} />
              <span className={styles.teamNameCompact}>{event.homeTeam}</span>
              {isSetSport && serving === 1 && <span className={styles.serveDot} />}
              {cardCounts && teamHasCards(cardCounts.home) && (
                <WcTeamCardBadges
                  red={cardCounts.home.red}
                  yellow={cardCounts.home.yellow}
                />
              )}
            </div>
          </div>
          <div className={styles.cell_totalScore}><ValueChange value={String(homeTotal)} /></div>
          {details.map(([h], i) => {
            const isCurrent = isLive && i === currentPeriodIdx;
            const isDone    = isLive && i < currentPeriodIdx;
            const won       = isDone && Number(h) > Number(details[i][1]);
            return (
              <div key={i} className={cn(styles.cell_periodScore,
                isCurrent && styles.cell_periodScore_current,
                won       && styles.cell_periodScore_won)}>{h}</div>
            );
          })}
          {bballCurrent && (
            <div className={cn(styles.cell_periodScore, styles.cell_periodScore_current)}>
              {bballCurrent.home}
            </div>
          )}
          {displayStatCols.map((col) => (
            <div key={col.id} className={cn(styles.cell_statValue,
              col.id === "yellow_cards" && styles.cell_stat_yellow,
              col.id === "red_cards"    && styles.cell_stat_red)}>{col.home}</div>
          ))}

          <div className={cn(styles.cell_team, serving === 2 && styles.cell_team_serving)}>
            <div className={styles.teamRowMain}>
              <WcTeamImage teamName={event.awayTeam} iconUrl={event.awayTeamIcon} size={24} />
              <span className={styles.teamNameCompact}>{event.awayTeam}</span>
              {isSetSport && serving === 2 && <span className={styles.serveDot} />}
              {cardCounts && teamHasCards(cardCounts.away) && (
                <WcTeamCardBadges
                  red={cardCounts.away.red}
                  yellow={cardCounts.away.yellow}
                />
              )}
            </div>
          </div>
          <div className={styles.cell_totalScore}><ValueChange value={String(awayTotal)} /></div>
          {details.map(([, a], i) => {
            const isCurrent = isLive && i === currentPeriodIdx;
            const isDone    = isLive && i < currentPeriodIdx;
            const won       = isDone && Number(a) > Number(details[i][0]);
            return (
              <div key={i} className={cn(styles.cell_periodScore,
                isCurrent && styles.cell_periodScore_current,
                won       && styles.cell_periodScore_won)}>{a}</div>
            );
          })}
          {bballCurrent && (
            <div className={cn(styles.cell_periodScore, styles.cell_periodScore_current)}>
              {bballCurrent.away}
            </div>
          )}
          {displayStatCols.map((col) => (
            <div key={col.id} className={cn(styles.cell_statValue,
              col.id === "yellow_cards" && styles.cell_stat_yellow,
              col.id === "red_cards"    && styles.cell_stat_red)}>{col.away}</div>
          ))}
        </div>
      )}

      {/* ── Stats block with progress bars (football) ─ */}
      <StatsBlock event={event} />
    </div>
  );
}
