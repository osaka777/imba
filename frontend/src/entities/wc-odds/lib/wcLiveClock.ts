import type { WcEventDetail } from "~/entities/wc-odds/api/client";
import { isCountdownClockSport } from "./wcSportKinds";

/** Strip period suffixes like " - T2", " · 2Т" from Olimpbet clock strings. */
export function formatWcLiveClock(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "00:00") return null;

  const cleaned = trimmed
    .replace(/\s*[-·]\s*[TТ]\d+.*$/i, "")
    .replace(/\s*[·]\s*\d+\s*[ТT]?\d*.*$/i, "")
    .trim();

  return cleaned || null;
}

export function secondsToLiveClock(seconds: number | undefined | null): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  const total = Math.floor(seconds);
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

const SET_SPORTS = new Set(["tennis", "table-tennis", "volleyball"]);
const SOCCER_LIKE = new Set(["soccer", "cyber-football"]);
const SOCCER_HALF_SEC = 45 * 60;
export const SOCCER_MAX_MATCH_ELAPSED_SEC = 130 * 60;

function isSoccerLikeSport(sport?: string): boolean {
  return sport != null && SOCCER_LIKE.has(sport);
}

/** Olimpbet soccer feed may send match elapsed or period-relative time — normalize to match elapsed. */
export function normalizeSoccerMatchClockSec(
  rawSec: number,
  period?: number | null,
  sport?: string,
): number {
  if (!Number.isFinite(rawSec) || rawSec < 0) return 0;

  const halfSec = sport === "cyber-football" ? 12 * 60 : SOCCER_HALF_SEC;
  const p = period != null ? Number(period) : null;

  if (p != null && p >= 2) {
    if (rawSec >= halfSec) return rawSec;
    return rawSec + halfSec;
  }

  return rawSec;
}

function isPlausibleSoccerMatchElapsedSec(seconds: number): boolean {
  return Number.isFinite(seconds) && seconds >= 0 && seconds <= SOCCER_MAX_MATCH_ELAPSED_SEC;
}

/** Normalize feed clock to match elapsed seconds for scoreboard MM:SS (soccer). */
export function normalizePeriodClockSec(
  sport: string | undefined,
  rawSec: number,
  period?: number | null,
): number {
  if (!Number.isFinite(rawSec) || rawSec < 0) return 0;

  if (isSoccerLikeSport(sport)) {
    const matchSec = normalizeSoccerMatchClockSec(rawSec, period, sport);
    if (isPlausibleSoccerMatchElapsedSec(matchSec)) return matchSec;
    return 0;
  }

  if (isPlausiblePeriodClockSec(sport, rawSec)) return rawSec;
  return 0;
}

function resolvePeriodClockSource(
  sport: string | undefined,
  score: NonNullable<WcEventDetail["parsedScore"]>,
): LiveClockSource {
  const period = score.period;

  const inPeriod = score.currentTimeInPeriodSec;
  if (inPeriod != null) {
    const normalized = normalizePeriodClockSec(sport, inPeriod, period);
    if (normalized >= 0 && (normalized > 0 || (period != null && Number(period) >= 1))) {
      return { baseSeconds: normalized, countdown: false };
    }
  }

  const fromText = parseClockStringToSeconds(score.text?.time);
  if (fromText >= 0) {
    const normalized = normalizePeriodClockSec(sport, fromText, period);
    if (normalized > 0 || (isSoccerLikeSport(sport) && period != null && Number(period) >= 1)) {
      return { baseSeconds: normalized, countdown: false };
    }
  }

  if (score.seconds != null) {
    const normalized = normalizePeriodClockSec(sport, score.seconds, period);
    if (normalized > 0 || (isSoccerLikeSport(sport) && period != null && Number(period) >= 1)) {
      return { baseSeconds: normalized, countdown: false };
    }
  }

  return { baseSeconds: 0, countdown: false };
}

/** Stop extrapolating after this many seconds without a fresh server clock. */
export const WC_CLOCK_EXTRAPOLATE_MAX_SEC = 120;

/** Upper bound for a single period/half clock value before treating the feed field as corrupt. */
export function getMaxPlausiblePeriodClockSec(sport?: string): number {
  switch (sport) {
    case "cyber-basketball":
      return 10 * 60;
    case "cyber-football":
      return 12 * 60;
    case "basketball":
      return 15 * 60;
    case "hockey":
      return 25 * 60;
    case "soccer":
      return 55 * 60;
    default:
      return 90 * 60;
  }
}

export function isPlausiblePeriodClockSec(sport: string | undefined, seconds: number): boolean {
  return Number.isFinite(seconds) && seconds >= 0 && seconds <= getMaxPlausiblePeriodClockSec(sport);
}

export function parseClockStringToSeconds(raw: string | undefined | null): number {
  if (!raw) return 0;
  const cleaned = formatWcLiveClock(raw) ?? raw.trim();
  const colon = cleaned.match(/^(\d+):(\d+)/);
  if (!colon) return 0;
  return Number(colon[1]) * 60 + Number(colon[2]);
}

export type LiveClockSource = {
  baseSeconds: number;
  countdown: boolean;
};

export function resolveLiveClockSource(
  event: Pick<WcEventDetail, "sport" | "parsedScore">,
): LiveClockSource {
  const score = event.parsedScore;
  const sport = event.sport;
  if (!score) return { baseSeconds: 0, countdown: false };

  const remaining = score.remainingTimeInPeriodSec;
  if (
    isCountdownClockSport(sport)
    && remaining != null
    && isPlausiblePeriodClockSec(sport, remaining)
  ) {
    return { baseSeconds: remaining, countdown: true };
  }

  const inPeriod = score.currentTimeInPeriodSec;
  if (
    isCountdownClockSport(sport)
    && inPeriod != null
    && isPlausiblePeriodClockSec(sport, inPeriod)
  ) {
    return { baseSeconds: inPeriod, countdown: false };
  }

  if (isSoccerLikeSport(sport)) {
    const periodSource = resolvePeriodClockSource(sport, score);
    if (periodSource.baseSeconds > 0) return periodSource;
    if (score.period != null && Number(score.period) >= 1) return periodSource;
  }

  const fromText = parseClockStringToSeconds(score.text?.time);
  if (fromText > 0 && isPlausiblePeriodClockSec(sport, fromText)) {
    return { baseSeconds: fromText, countdown: false };
  }

  if (
    score.seconds != null
    && isPlausiblePeriodClockSec(sport, score.seconds)
  ) {
    return { baseSeconds: score.seconds, countdown: false };
  }

  return { baseSeconds: 0, countdown: false };
}

type WcClockEvent = Pick<WcEventDetail, "phase" | "completed" | "sport" | "parsedScore" | "feedStatus">;

const LIVE_GAME_PHASES = new Set([
  "break",
  "extra_time_1",
  "extra_time_2",
  "penalties",
]);

/** Match is over for UI even if the feed still marks it live. */
export function isWcMatchEffectivelyFinished(event: WcClockEvent): boolean {
  if (event.completed || event.phase === "finished") return true;
  if (event.feedStatus === "EVENT_FINISHED") return true;
  if (event.phase !== "live") return false;

  const gamePhase = event.parsedScore?.gamePhase;
  if (gamePhase && LIVE_GAME_PHASES.has(gamePhase)) return false;

  const secs = event.parsedScore?.seconds;
  if (
    secs != null
    && event.sport != null
    && SOCCER_LIKE.has(event.sport)
    && secs > SOCCER_MAX_MATCH_ELAPSED_SEC
  ) {
    return true;
  }

  return false;
}

/** Elapsed match minute for soccer/hockey-style clocks (best effort). */
export function resolveLiveMatchMinute(
  event: Pick<WcEventDetail, "phase" | "parsedScore">,
): number | null {
  if (event.phase !== "live") return null;

  const parsed = event.parsedScore;
  if (!parsed) return null;

  if (parsed.seconds != null && parsed.seconds > 0) {
    return Math.floor(parsed.seconds / 60);
  }

  const rawTime = formatWcLiveClock(parsed.text?.time);
  if (!rawTime) return null;

  const apostrophe = rawTime.match(/(\d+)\s*[''′]/);
  if (apostrophe) return Number(apostrophe[1]);

  const colon = rawTime.match(/^(\d+):(\d+)/);
  if (colon) return Number(colon[1]);

  return null;
}

export function isWcLiveClockRunning(event: WcClockEvent): boolean {
  if (isWcMatchEffectivelyFinished(event)) return false;
  if (event.phase !== "live") return false;
  if (SET_SPORTS.has(event.sport)) return false;

  const score = event.parsedScore;
  if (score?.gamePhase === "break") return false;

  const source = resolveLiveClockSource(event);
  if (source.baseSeconds > 0) return true;

  return isSoccerLikeSport(event.sport)
    && score?.period != null
    && Number(score.period) >= 1;
}
