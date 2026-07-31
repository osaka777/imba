"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  GiCornerFlag,
  GiCrosshair,
  GiGoalKeeper,
} from "react-icons/gi";
import {
  MdOutlineCompareArrows,
  MdOutlineSports,
  MdOutlineSportsSoccer,
  MdSportsTennis,
} from "react-icons/md";
import {
  TbActivity,
  TbArrowsExchange,
  TbBolt,
  TbCards,
  TbChevronLeft,
  TbClockHour4,
  TbFlagFilled,
} from "react-icons/tb";

import type { WcEventDetail } from "~/entities/wc-odds/api/client";

import { getSportBackgroundCss } from "~/entities/game/lib/sportBackground";
import scoreStyles from "~/entities/game/ui/Match/ScoreBoard.module.css";
import { isEsportsMapScoreSport } from "~/entities/wc-odds/lib/wcEsportsScore";
import { isWcFeedPaused, wcFeedPausedLabel } from "~/entities/wc-odds/lib/wcFeedStatus";
import { toFeedLocale } from "~/shared/i18n";
import { isWcMatchEffectivelyFinished } from "~/entities/wc-odds/lib/wcLiveClock";
import {
  formatTennisGameScore,
  resolveWcDisplayPeriod,
  sportUsesTennisPointScore,
} from "~/entities/wc-odds/lib/wcLiveScore";
import { getWcSoccerCardCounts, teamHasCards } from "~/entities/wc-odds/lib/wcSoccerCards";
import { isStaleSoccerBreak } from "~/entities/wc-odds/lib/wcSoccerPhase";
import { isBasketballLikeSport, isSoccerLikeSport } from "~/entities/wc-odds/lib/wcSportKinds";
import { WcLiveMatchClockBar } from "~/entities/wc-odds/ui/WcLiveMatchClock";
import { WcLiveTrackerPanel } from "~/entities/wc-odds/ui/WcLiveTrackerPanel";
import { WcPrematchKickoffCountdown } from "~/entities/wc-odds/ui/WcPrematchKickoffCountdown";
import styles from "~/entities/wc-odds/ui/WcScoreBoard.module.css";
import { WcTeamCardBadges } from "~/entities/wc-odds/ui/WcTeamCardBadges";
import { WcTeamImage } from "~/entities/wc-odds/ui/WcTeamImage";
import { BroadcastIcon, StatsIcon } from "~/shared/assets";
import { cn } from "~/shared/lib";
import { useLocale } from "~/shared/model/useLocale";

type WcScoreBoardProps = {
  event: WcEventDetail;
  onBroadcastOpen?: () => void;
  showBroadcastLink?: boolean;
  telegramAction?: ReactNode;
  /** Resolved externally (see useWcLiveTracker) so the sidebar can share the same fetch. */
  trackerUrl?: null | string;
};

function BroadcastLink({
  onOpen,
  show,
  variant = "inline",
  t,
}: {
  onOpen?: () => void;
  show?: boolean;
  variant?: "inline" | "meta";
  t: ReturnType<typeof useLocale>["t"];
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
      {t("wc.broadcast")}
    </button>
  );
}

function TrackerLink({
  active,
  onToggle,
  show,
}: {
  active?: boolean;
  onToggle?: () => void;
  show?: boolean;
}) {
  if (!show || !onToggle) return null;

  return (
    <button
      className={cn(styles.trackerLink, active && styles.trackerLink_active)}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      type="button"
    >
      <span className={styles.trackerLinkIconWrap}>
        <TbActivity className={styles.trackerLinkIcon} />
      </span>
      <span className={styles.trackerLinkLabel}>Live Tracker</span>
    </button>
  );
}

function MetaBar({
  leagueName,
  onBroadcastOpen,
  onTrackerToggle,
  showBroadcastLink,
  showTrackerLink,
  status,
  telegramAction,
  trackerActive,
  t,
}: {
  leagueName: string;
  onBroadcastOpen?: () => void;
  onTrackerToggle?: () => void;
  showBroadcastLink?: boolean;
  showTrackerLink?: boolean;
  status: ReactNode;
  telegramAction?: ReactNode;
  trackerActive?: boolean;
  t: ReturnType<typeof useLocale>["t"];
}) {
  return (
    <div className={styles.metaBar}>
      <div className={styles.metaBar_league}>{leagueName}</div>
      <div className={styles.metaBar_right}>
        <div className={styles.metaBar_status}>{status}</div>
        {telegramAction}
        <TrackerLink
          active={trackerActive}
          onToggle={onTrackerToggle}
          show={showTrackerLink}
        />
        <BroadcastLink
          onOpen={onBroadcastOpen}
          show={showBroadcastLink}
          t={t}
          variant="meta"
        />
      </div>
    </div>
  );
}

const SET_SPORTS = new Set(["tennis", "table-tennis", "volleyball"]);

function colPrefixForSport(
  sport: string,
  t: ReturnType<typeof useLocale>["t"],
): string {
  const map: Record<string, string> = {
    basketball: t("wc.unitQuarterShort"),
    "cyber-basketball": t("wc.unitQuarterShort"),
    "cyber-football": t("wc.unitHalfShort"),
    "esports.cs": t("wc.unitMapShort"),
    "esports.dota2": t("wc.unitMapShort"),
    "esports.valorant": t("wc.unitMapShort"),
    hockey: t("wc.unitPeriodShort"),
    soccer: t("wc.unitHalfShort"),
    "table-tennis": t("wc.unitSetShort"),
    tennis: t("wc.unitSetShort"),
    volleyball: t("wc.unitSetShort"),
  };
  return map[sport] ?? (sport.startsWith("esports.") ? t("wc.unitMapShort") : t("wc.unitPeriodShort"));
}

function periodFullForSport(
  sport: string,
  t: ReturnType<typeof useLocale>["t"],
): string {
  const map: Record<string, string> = {
    basketball: t("wc.unitQuarter"),
    "cyber-basketball": t("wc.unitQuarter"),
    "cyber-football": t("wc.unitHalf"),
    "esports.cs": t("wc.unitMap"),
    "esports.dota2": t("wc.unitMap"),
    "esports.valorant": t("wc.unitMap"),
    hockey: t("wc.unitPeriod"),
    soccer: t("wc.unitHalf"),
    "table-tennis": t("wc.unitSet"),
    tennis: t("wc.unitSet"),
    volleyball: t("wc.unitSet"),
  };
  return map[sport] ?? (sport.startsWith("esports.") ? t("wc.unitMap") : t("wc.unitPeriod"));
}

function gamePhaseLabels(t: ReturnType<typeof useLocale>["t"]): Record<string, string> {
  return {
    break: t("wc.phaseBreak"),
    extra_time_1: t("wc.phaseEt1"),
    extra_time_2: t("wc.phaseEt2"),
    penalties: t("wc.phasePenalties"),
  };
}

/** Sport-specific label for the "penalties" game phase */
function getPenaltiesPhaseLabel(
  sport: string,
  t: ReturnType<typeof useLocale>["t"],
): string {
  switch (sport) {
    case "tennis":
    case "table-tennis":
    case "volleyball":
    case "beach-volleyball":
    case "badminton":
    case "squash":
      return t("wc.phaseTiebreak");
    case "hockey":
    case "bandy":
    case "floorball":
      return t("wc.phaseShootout");
    default:
      return t("wc.phasePenalties");
  }
}

// ── Stat metadata: icon component + label ─────────────────────────────────
type StatMeta = { icon: React.ReactNode; labelKey: `wc.${string}` };

const STAT_META: Record<string, StatMeta> = {
  aces:              { icon: <MdSportsTennis />,           labelKey: "wc.statAces" },
  aerial_duels:      { icon: <MdOutlineCompareArrows />,   labelKey: "wc.statAerial" },
  corners:           { icon: <GiCornerFlag />,             labelKey: "wc.statCorners" },
  dangerous_attacks: { icon: <TbBolt />,                  labelKey: "wc.statDanger" },
  double_faults:     { icon: <MdOutlineCompareArrows />,   labelKey: "wc.statDoubleFaults" },
  dribbles:          { icon: <MdOutlineSportsSoccer />,   labelKey: "wc.statDribbles" },
  expected_goals:    { icon: <GiCrosshair />,             labelKey: "wc.statShots" },
  extra_time_score:  { icon: <TbClockHour4 />,             labelKey: "wc.statEtGoals" },
  fouls:             { icon: <MdOutlineSports />,          labelKey: "wc.statFouls" },
  free_kicks:        { icon: <MdOutlineSportsSoccer />,   labelKey: "wc.statFreeKicks" },
  goal_kicks:        { icon: <MdOutlineSportsSoccer />,   labelKey: "wc.statGoalKicks" },
  interceptions:     { icon: <TbArrowsExchange />,         labelKey: "wc.statInterceptions" },
  offsides:          { icon: <TbFlagFilled />,             labelKey: "wc.statOffsides" },
  outs:              { icon: <MdOutlineSports />,          labelKey: "wc.statOuts" },
  penalty_minutes:   { icon: <TbClockHour4 />,             labelKey: "wc.statPenaltyMin" },
  penalty_score:     { icon: <MdOutlineSportsSoccer />,   labelKey: "wc.statPenalties" },
  players_on_ice:    { icon: <MdOutlineSports />,          labelKey: "wc.statOnIce" },
  possession:        { icon: <MdOutlineSportsSoccer />,   labelKey: "wc.statPossession" },
  red_cards:         { icon: <TbCards />,                  labelKey: "wc.statRed" },
  saves:             { icon: <GiGoalKeeper />,            labelKey: "wc.statSaves" },
  server:            { icon: <MdSportsTennis />,           labelKey: "wc.statServe" },
  shots:             { icon: <GiCrosshair />,             labelKey: "wc.statShots" },
  shots_off:         { icon: <GiCrosshair />,             labelKey: "wc.statShotsOff" },
  shots_on:          { icon: <GiGoalKeeper />,            labelKey: "wc.statShotsOn" },
  substitutions:     { icon: <TbArrowsExchange />,         labelKey: "wc.statSubs" },
  tackles:           { icon: <MdOutlineSports />,          labelKey: "wc.statTackles" },
  woodwork:          { icon: <MdOutlineSportsSoccer />,   labelKey: "wc.statWoodwork" },
  yellow_cards:      { icon: <TbCards />,                  labelKey: "wc.statYellow" },
  yellow_red_cards:  { icon: <TbCards />,                  labelKey: "wc.statYellowRed" },
};

function statLabel(
  id: string,
  t: ReturnType<typeof useLocale>["t"],
  fallback?: string,
): string {
  if (id === "expected_goals") return "xG";
  const meta = STAT_META[id];
  return meta ? t(meta.labelKey) : (fallback ?? id);
}

// ── Helpers ────────────────────────────────────────────────────────────────

// ── ValueChange animation ─────────────────────────────────────────────────
function ValueChange({ className, value }: { className?: string; value: number | string }) {
  const [prev, setPrev] = useState(value);
  const [type, setType] = useState<"decreased" | "increased" | null>(null);
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
type StatCol = { away: string; home: string; icon: React.ReactNode; iconLabel: string; id: string };

function buildStatCols(
  event: WcEventDetail,
  t: ReturnType<typeof useLocale>["t"],
): StatCol[] {
  const cols: StatCol[] = [];
  const pick = (id: string) => event.statList?.find((s) => s.id === id);
  const add = (id: string) => {
    const s = pick(id);
    if (!s) return;
    const meta = STAT_META[id];
    cols.push({
      away: s.opp2,
      home: s.opp1,
      icon: meta?.icon ?? null,
      iconLabel: statLabel(id, t, s.name),
      id,
    });
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

function StatsBlock({
  event,
  t,
}: {
  event: WcEventDetail;
  t: ReturnType<typeof useLocale>["t"];
}) {
  const [open, setOpen] = useState(false);
  const rows = useMemo(
    () => (event.statList ?? []).filter((s) => s.id !== "server"),
    [event.statList],
  );
  const stickyRef = useRef<{ at: number; rows: typeof rows } | null>(null);
  const [displayRows, setDisplayRows] = useState(rows);

  useEffect(() => {
    if (rows.length > 0) {
      stickyRef.current = { at: Date.now(), rows };
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
        aria-expanded={open}
        className={cn(styles.statsToggle, open && styles.statsToggle_open)}
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <StatsIcon aria-hidden className={styles.statsToggleIcon} />
        <span className={styles.statsToggleLabel}>{t("wc.stats")}</span>
        <span className={cn(styles.statsToggleChevron, open && styles.statsToggleChevron_open)} />
      </button>

      {open && (
        <div className={styles.statsBlock}>
          <div className={styles.statsBlock_header}>
            <span className={styles.statsBlock_homeTeam}>{event.homeTeam}</span>
            <span className={styles.statsBlock_title}>{t("wc.stats")}</span>
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
              <div className={styles.statsRow} key={row.id}>
                <div className={styles.statsLabel}>
                  {meta?.icon && <span className={styles.statIcon}>{meta.icon}</span>}
                  <span className={styles.statLabelText}>{statLabel(row.id, t, row.name)}</span>
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
function PrematchView({
  event,
  onBroadcastOpen,
  showBroadcastLink,
  telegramAction,
  t,
}: WcScoreBoardProps & { t: ReturnType<typeof useLocale>["t"] }) {
  return (
    <div className={styles.wcScoreBoard} style={{
      background: getSportBackgroundCss(event.sport),
    }}>
      <MetaBar
        leagueName={event.leagueName}
        onBroadcastOpen={onBroadcastOpen}
        showBroadcastLink={showBroadcastLink}
        status={<span className={styles.prematchMetaPill}>{t("wc.line")}</span>}
        t={t}
        telegramAction={telegramAction}
      />

      <div className={styles.prematchBody}>
        <div className={styles.prematchSide}>
          <WcTeamImage iconUrl={event.homeTeamIcon} rounded size={56} teamName={event.homeTeam} />
          <span className={styles.prematchTeamName}>{event.homeTeam}</span>
        </div>

        <div className={styles.prematchCenter}>
          <WcPrematchKickoffCountdown commenceTime={event.commenceTime} />
        </div>

        <div className={styles.prematchSide}>
          <WcTeamImage iconUrl={event.awayTeamIcon} rounded size={56} teamName={event.awayTeam} />
          <span className={styles.prematchTeamName}>{event.awayTeam}</span>
        </div>
      </div>
    </div>
  );
}

// ── Main scoreboard ────────────────────────────────────────────────────────
export function WcScoreBoard({
  event,
  onBroadcastOpen,
  showBroadcastLink,
  telegramAction,
  trackerUrl,
}: WcScoreBoardProps) {
  const { t, locale } = useLocale();
  const score = event.parsedScore;

  const isLive     = event.phase === "live" && !isWcMatchEffectivelyFinished(event);
  const isFinished = event.phase === "finished" || isWcMatchEffectivelyFinished(event);
  const isPrematch = event.phase === "prematch";
  const isSetSport = SET_SPORTS.has(event.sport);
  const isEsportsMap = isEsportsMapScoreSport(event.sport);

  // Mobile/APK: horizontal swipe between scoreboard ↔ Live Tracker.
  // Desktop (>=1081px) keeps the scoreboard only; tracker lives in the coupon sidebar.
  const canSwipeTracker = Boolean(trackerUrl);
  const [swipePage, setSwipePage] = useState(0);
  const swipeViewportRef = useRef<HTMLDivElement>(null);
  const scorePageRef = useRef<HTMLDivElement>(null);
  const trackerPageRef = useRef<HTMLDivElement>(null);

  const goToSwipePage = useCallback((index: number) => {
    const el = swipeViewportRef.current;
    if (!el) return;
    el.scrollTo({ behavior: "smooth", left: index * el.clientWidth });
    setSwipePage(index);
  }, []);

  useEffect(() => {
    if (!trackerUrl) {
      setSwipePage(0);
      const el = swipeViewportRef.current;
      if (el) el.scrollTo({ left: 0 });
    }
  }, [trackerUrl]);

  const syncSwipeHeight = useCallback(() => {
    const vp = swipeViewportRef.current;
    if (!vp || !canSwipeTracker) {
      if (vp) vp.style.height = "";
      return;
    }
    const active = swipePage === 1 ? trackerPageRef.current : scorePageRef.current;
    if (!active) return;
    vp.style.height = `${active.offsetHeight}px`;
  }, [canSwipeTracker, swipePage]);

  useEffect(() => {
    syncSwipeHeight();
  }, [syncSwipeHeight, event, trackerUrl]);

  useEffect(() => {
    const vp = swipeViewportRef.current;
    if (!vp || !canSwipeTracker) return undefined;

    const onScroll = () => {
      const next = Math.round(vp.scrollLeft / Math.max(1, vp.clientWidth));
      setSwipePage((prev) => (prev === next ? prev : next));
    };

    vp.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", syncSwipeHeight);
    return () => {
      vp.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", syncSwipeHeight);
    };
  }, [canSwipeTracker, syncSwipeHeight]);

  const rawGamePhase     = score?.gamePhase ?? null;
  const isStaleBreak     = rawGamePhase === "break" && isStaleSoccerBreak(score ?? undefined);
  const gamePhase        = isStaleBreak ? null : rawGamePhase;
  const gamePhaseLabelsMap = useMemo(() => gamePhaseLabels(t), [t]);
  const gamePhaseLabel   = gamePhase ? (gamePhaseLabelsMap[gamePhase] ?? null) : null;
  const isBreak          = gamePhase === "break";
  const isClassicSoccer = event.sport === "soccer";

  // ── Period data ─────────────────────────────────────────────────────────
  const details    = score?.details ?? [];

  // Detect penalty shootout: either explicit gamePhase or 5+ periods in details
  const isPenaltiesPhase = gamePhase === "penalties" || (isClassicSoccer && isLive && details.length >= 5);

  const showLiveClockBar = isLive && !isSetSport && !isBreak && !isPenaltiesPhase && !isEsportsMap;
  const colPrefix  = colPrefixForSport(event.sport, t);
  const periodStr  = periodFullForSport(event.sport, t);
  const varState = score?.varState ?? null;
  const penaltyRisk = score?.penaltyRisk === true;
  const feedPaused = isWcFeedPaused(event.feedStatus);
  const pausedLabel = wcFeedPausedLabel(toFeedLocale(locale));

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
    if (isPenaltiesPhase) return getPenaltiesPhaseLabel(event.sport, t);
    if (gamePhaseLabel) return gamePhaseLabel;
    if (isEsportsMap) return details.length > 0 ? t("wc.mapN", { n: details.length }) : "Live";
    if (isSetSport) return details.length > 0 ? `${details.length} ${periodStr}` : null;
    const p = resolveWcDisplayPeriod(event.sport, score?.period, details.length);
    return p > 0 ? `${p} ${periodStr}` : null;
  }, [isLive, isPenaltiesPhase, gamePhaseLabel, isSetSport, isEsportsMap, details.length, periodStr, score?.period, event.sport, t]);

  // ── Stat columns (inline in table header) ──────────────────────────────
  const statCols = useMemo(() => buildStatCols(event, t), [event, t]);

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
    return { away: ca, home: ch };
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
        t={t}
        telegramAction={telegramAction}
      />
    );
  }

  return (
    <div
      className={cn(styles.wcScoreBoard, canSwipeTracker && styles.wcScoreBoard_swipeable)}
      style={{
        background: getSportBackgroundCss(event.sport),
      }}
    >
      <div className={styles.swipeViewport} ref={swipeViewportRef}>
        <div className={styles.swipeTrack}>
          <div className={styles.swipePage} data-swipe-page="score" ref={scorePageRef}>
      {/* ── Meta bar ──────────────────────────────────── */}
      <MetaBar
        leagueName={event.leagueName}
        onBroadcastOpen={onBroadcastOpen}
        onTrackerToggle={() => goToSwipePage(swipePage === 1 ? 0 : 1)}
        showBroadcastLink={showBroadcastLink}
        showTrackerLink={canSwipeTracker}
        status={
          <>
            {isFinished && t("wc.finished")}
            {isLive && feedPaused && (
              <span className={styles.suspendedPill} title={pausedLabel}>
                {pausedLabel}
              </span>
            )}
            {isLive && !feedPaused && isPenaltiesPhase && getPenaltiesPhaseLabel(event.sport, t)}
            {isLive && !feedPaused && !isPenaltiesPhase && !isSetSport && isBreak && (gamePhaseLabel ?? t("wc.break"))}
            {isLive && !feedPaused && isSetSport && (setsScore ? t("wc.setsScore", { score: setsScore }) : "Live")}
          </>
        }
        t={t}
        telegramAction={telegramAction}
        trackerActive={swipePage === 1}
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
            <span aria-hidden className={styles.timerDot} />
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
            <span aria-hidden className={styles.timerDot} />
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
            <div aria-hidden className={styles.setScoresHeaderSpacer} />
            <div className={styles.setPlayerScores}>
              <div className={cn(styles.cell_header, styles.cell_header_total, styles.setColHeader)}>
                {t("wc.unitSetShort")}
              </div>
              {details.map((_, i) => {
                const isCurrent = i === currentPeriodIdx;
                const isDone = i < currentPeriodIdx;
                return (
                  <div
                    className={cn(
                      styles.cell_header,
                      styles.setColHeader,
                      isCurrent && styles.cell_header_active,
                      isDone && styles.cell_header_done,
                    )}
                    key={i}
                  >
                    {colPrefix}{i + 1}
                  </div>
                );
              })}
              {displayStatCols.map((col) => (
                <div
                  className={cn(styles.cell_header, styles.cell_header_stat, styles.setColHeader)}
                  key={col.id}
                  title={col.iconLabel}
                >
                  {col.icon}
                </div>
              ))}
            </div>
          </div>

          <div className={styles.setPlayerRow}>
            <div className={cn(styles.cell_team, serving === 1 && styles.cell_team_serving)}>
              <div className={styles.teamRowMain}>
                <WcTeamImage iconUrl={event.homeTeamIcon} size={24} teamName={event.homeTeam} />
                <div className={styles.teamNameWithServe}>
                  <span className={styles.teamNameCompact} title={event.homeTeam}>{event.homeTeam}</span>
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
                  <div className={cn(styles.cell_periodScore,
                    isCurrent && styles.cell_periodScore_current,
                    won       && styles.cell_periodScore_won)} key={i}>{h}</div>
                );
              })}
              {displayStatCols.map((col) => (
                <div className={cn(styles.cell_statValue,
                  col.id === "yellow_cards" && styles.cell_stat_yellow,
                  col.id === "red_cards"    && styles.cell_stat_red)} key={col.id}>{col.home}</div>
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
                <WcTeamImage iconUrl={event.awayTeamIcon} size={24} teamName={event.awayTeam} />
                <div className={styles.teamNameWithServe}>
                  <span className={styles.teamNameCompact} title={event.awayTeam}>{event.awayTeam}</span>
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
                  <div className={cn(styles.cell_periodScore,
                    isCurrent && styles.cell_periodScore_current,
                    won       && styles.cell_periodScore_won)} key={i}>{a}</div>
                );
              })}
              {displayStatCols.map((col) => (
                <div className={cn(styles.cell_statValue,
                  col.id === "yellow_cards" && styles.cell_stat_yellow,
                  col.id === "red_cards"    && styles.cell_stat_red)} key={col.id}>{col.away}</div>
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
              <span className={styles.finishedPill}>{t("wc.finished")}</span>
            </div>
          )}

          {isLive && isPenaltiesPhase && (
            <div className={styles.headerStatusSpanned}>
              <span className={styles.penaltiesLabel}>{getPenaltiesPhaseLabel(event.sport, t)}</span>
            </div>
          )}

          {isLive && !isPenaltiesPhase && !isSetSport && isBreak && (
            <div className={styles.headerStatusSpanned}>
              <span className={styles.gamePhaseLabel}>{gamePhaseLabel ?? t("wc.break")}</span>
            </div>
          )}

          <div className={styles.cell_teamHeader}>
            {showLiveClockBar ? (
              <div className={styles.headerStatusLeft}>
                {isClassicSoccer && varState ? (
                  <span className={styles.varPill}>{varState}</span>
                ) : null}
                {isClassicSoccer && penaltyRisk ? (
                  <span className={styles.penaltyRiskPill}>{t("wc.penaltyShort")}</span>
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
              <div className={cn(styles.cell_header,
                isCurrent && styles.cell_header_active,
                isDone    && styles.cell_header_done,
                isPenCol  && styles.cell_header_penalties)} key={i}>
                {isPenCol ? t("wc.penaltyCol") : `${colPrefix}${i + 1}`}
              </div>
            );
          })}
          {bballCurrent && (
            <div className={cn(styles.cell_header, styles.cell_header_active)}>
              {colPrefix}{details.length + 1}
            </div>
          )}
          {displayStatCols.map((col) => (
            <div className={cn(styles.cell_header, styles.cell_header_stat,
                col.id === "yellow_cards" && styles.cell_header_yellow,
                col.id === "red_cards"    && styles.cell_header_red)} key={col.id}
              title={col.iconLabel}>
              {col.icon}
            </div>
          ))}

          <div className={cn(styles.cell_team, serving === 1 && styles.cell_team_serving)}>
            <div className={styles.teamRowMain}>
              <WcTeamImage iconUrl={event.homeTeamIcon} size={24} teamName={event.homeTeam} />
              <span className={styles.teamNameCompact} title={event.homeTeam}>{event.homeTeam}</span>
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
              <div className={cn(styles.cell_periodScore,
                isCurrent && styles.cell_periodScore_current,
                won       && styles.cell_periodScore_won)} key={i}>{h}</div>
            );
          })}
          {bballCurrent && (
            <div className={cn(styles.cell_periodScore, styles.cell_periodScore_current)}>
              {bballCurrent.home}
            </div>
          )}
          {displayStatCols.map((col) => (
            <div className={cn(styles.cell_statValue,
              col.id === "yellow_cards" && styles.cell_stat_yellow,
              col.id === "red_cards"    && styles.cell_stat_red)} key={col.id}>{col.home}</div>
          ))}

          <div className={cn(styles.cell_team, serving === 2 && styles.cell_team_serving)}>
            <div className={styles.teamRowMain}>
              <WcTeamImage iconUrl={event.awayTeamIcon} size={24} teamName={event.awayTeam} />
              <span className={styles.teamNameCompact} title={event.awayTeam}>{event.awayTeam}</span>
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
              <div className={cn(styles.cell_periodScore,
                isCurrent && styles.cell_periodScore_current,
                won       && styles.cell_periodScore_won)} key={i}>{a}</div>
            );
          })}
          {bballCurrent && (
            <div className={cn(styles.cell_periodScore, styles.cell_periodScore_current)}>
              {bballCurrent.away}
            </div>
          )}
          {displayStatCols.map((col) => (
            <div className={cn(styles.cell_statValue,
              col.id === "yellow_cards" && styles.cell_stat_yellow,
              col.id === "red_cards"    && styles.cell_stat_red)} key={col.id}>{col.away}</div>
          ))}
        </div>
      )}

      {/* ── Stats block with progress bars (football) ─ */}
      <StatsBlock event={event} t={t} />
          </div>

          {canSwipeTracker && trackerUrl ? (
            <div
              className={styles.swipePageTracker}
              data-swipe-page="tracker"
              ref={trackerPageRef}
            >
              <button
                aria-label={t("wc.backToScore")}
                className={styles.swipeTrackerChrome}
                onClick={() => goToSwipePage(0)}
                type="button"
              >
                <span className={styles.swipeTrackerChromeIcon}>
                  <TbActivity />
                </span>
                <span className={styles.swipeTrackerChromeTitle}>Live Tracker</span>
                <span aria-hidden className={styles.swipeTrackerChromeHint}>
                  <TbChevronLeft />
                </span>
              </button>
              <WcLiveTrackerPanel url={trackerUrl} />
            </div>
          ) : null}
        </div>
      </div>

      {canSwipeTracker ? (
        <div aria-hidden className={styles.swipeDots}>
          <button
            aria-label={t("wc.matchScoreAria")}
            className={cn(styles.swipeDot, swipePage === 0 && styles.swipeDot_active)}
            onClick={() => goToSwipePage(0)}
            type="button"
          />
          <button
            aria-label="Live Tracker"
            className={cn(styles.swipeDot, swipePage === 1 && styles.swipeDot_active)}
            onClick={() => goToSwipePage(1)}
            type="button"
          />
        </div>
      ) : null}
    </div>
  );
}
