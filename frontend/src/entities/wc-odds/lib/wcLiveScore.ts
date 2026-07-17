import type { WcEvent, WcParsedScore } from "~/entities/wc-odds/api/client";

import {
  formatWcLiveClock,
  isPlausiblePeriodClockSec,
  parseClockStringToSeconds,
  secondsToLiveClock,
} from "./wcLiveClock";
import { isBasketballLikeSport, isSoccerLikeSport } from "./wcSportKinds";
import { isStaleSoccerBreak, refineWcParsedScorePhase } from "./wcSoccerPhase";

/** Olimpbet encodes tennis advantage as 50 — display as A (40:50 → 40:A). */
export function formatTennisGameScore(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  return trimmed
    .split(":")
    .map((part) => {
      const trailingStar = part.endsWith("*");
      const leadingStar = part.startsWith("*");
      const core = part.replace(/\*/g, "").trim();
      const display = core === "50" ? "A" : core;
      if (trailingStar) return `${display}*`;
      if (leadingStar) return `*${display}`;
      return display;
    })
    .join(":");
}

export function sportUsesTennisPointScore(sport?: string): boolean {
  return sport === "tennis" || sport === "table-tennis";
}

/** Prefer referee-announced added time; fall back to elapsed stoppage. */
export function wcDisplayAddedMinutes(parsedScore?: WcParsedScore | null): number | null {
  if (!parsedScore) return null;
  if (parsedScore.announcedAddedTime != null && parsedScore.announcedAddedTime > 0) {
    return parsedScore.announcedAddedTime;
  }
  if (parsedScore.extraTime != null && parsedScore.extraTime > 0) {
    return parsedScore.extraTime;
  }
  return null;
}

export function wcAddedMinutesIsAnnounced(parsedScore?: WcParsedScore | null): boolean {
  return (parsedScore?.announcedAddedTime ?? 0) > 0;
}

export function formatRemainingPeriodTime(seconds?: number | null): string | null {
  if (seconds == null || seconds <= 0) return null;
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  if (min <= 0) return `${sec}с`;
  if (sec === 0) return `${min}м`;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

/**
 * Human period number for hockey/basketball scoreboards.
 * Sportradar sends break codes like 31 (after period 1), not period 31.
 */
export function resolveWcDisplayPeriod(
  sport: string | undefined,
  rawPeriod: string | number | undefined | null,
  detailsLength: number,
): number {
  const phaseStr = rawPeriod == null ? "" : String(rawPeriod).trim();

  if (/^[1-9]$/.test(phaseStr)) return Number(phaseStr);

  if (/^3[0-9]$/.test(phaseStr)) {
    const periodDigit = Number(phaseStr[1]);
    if (periodDigit >= 1) {
      if (detailsLength > periodDigit) return detailsLength;
      return periodDigit;
    }
  }

  if (phaseStr === "301") return detailsLength > 1 ? detailsLength : 1;
  if (phaseStr === "302") return detailsLength > 2 ? detailsLength : 2;
  if (phaseStr === "40" && sport === "hockey") return 4;

  if (detailsLength > 0) return detailsLength;

  const n = Number(phaseStr);
  if (Number.isFinite(n) && n >= 1 && n <= 9) return n;

  return 1;
}

export function mergeWcParsedScore(
  prev?: WcParsedScore | null,
  incoming?: WcParsedScore | null,
): WcParsedScore | null | undefined {
  if (!incoming && !prev) return null;
  if (!incoming) return prev ?? null;
  if (!prev) return incoming;

  const prevText = prev.text ?? {};
  const incText = incoming.text ?? {};

  const periodChanged =
    incoming.period != null
    && prev.period != null
    && incoming.period !== prev.period;

  let seconds = incoming.seconds ?? prev.seconds;
  if (
    prev.seconds != null
    && incoming.seconds != null
    && !periodChanged
    && incoming.seconds < prev.seconds - 2
  ) {
    seconds = prev.seconds;
  }

  const mergedDetails = incoming.details?.length ? incoming.details : prev.details;
  const matchPhaseRaw = incoming.matchPhaseRaw ?? prev.matchPhaseRaw ?? null;
  const hasIncomingGamePhase = Object.prototype.hasOwnProperty.call(incoming, "gamePhase");
  const mergedGamePhase = hasIncomingGamePhase ? incoming.gamePhase : prev.gamePhase;
  const mergedPeriod = incoming.period ?? prev.period;

  // When Olimpbet doesn't send match_phase but 5+ period details exist → penalties started
  const inferredGamePhase =
    !mergedGamePhase && (mergedDetails?.length ?? 0) >= 5
      ? "penalties"
      : mergedGamePhase;
  const inferredPeriod =
    inferredGamePhase === "penalties" && (!mergedPeriod || Number(mergedPeriod) < 5)
      ? 5
      : mergedPeriod;

  return refineWcParsedScorePhase({
    ...prev,
    ...incoming,
    text: {
      ...prevText,
      ...incText,
      currentScore: incText.currentScore || prevText.currentScore,
      liveScore: incText.liveScore || prevText.liveScore,
      time: incText.time || prevText.time,
    },
    details: mergedDetails,
    seconds,
    period: inferredPeriod,
    extraTime: incoming.extraTime ?? prev.extraTime,
    announcedAddedTime: incoming.announcedAddedTime ?? prev.announcedAddedTime,
    varState: incoming.varState ?? prev.varState,
    remainingTimeInPeriodSec: incoming.remainingTimeInPeriodSec ?? prev.remainingTimeInPeriodSec,
    currentTimeInPeriodSec: incoming.currentTimeInPeriodSec ?? prev.currentTimeInPeriodSec,
    overtimeNumber: incoming.overtimeNumber ?? prev.overtimeNumber,
    penaltyRisk: incoming.penaltyRisk ?? prev.penaltyRisk,
    gamePhase: inferredGamePhase,
    matchPhaseRaw,
    currentScore: incoming.currentScore ?? prev.currentScore,
    liveScore: incoming.liveScore ?? prev.liveScore,
  }, matchPhaseRaw);
}

/**
 * Format live clock for the compact line row.
 * Clock-based sports (soccer, basketball, hockey): show "47'" – minutes only.
 * Set sports (tennis, table-tennis, volleyball): show "MM:SS".
 */
export function formatWcRowLiveTime(
  parsedScore?: WcParsedScore | null,
  sport?: string,
): string | null {
  if (!parsedScore) return null;
  if (parsedScore.gamePhase === "break" && !isStaleSoccerBreak(parsedScore)) {
    return "Перерыв";
  }
  if (parsedScore.gamePhase === "penalties" || (parsedScore.details?.length ?? 0) >= 5) return "Пен";

  const isSetSport =
    sport === "tennis" || sport === "table-tennis" || sport === "volleyball";

  const rawTime = formatWcLiveClock(parsedScore.text?.time);

  if (rawTime) {
    if (!isSetSport) {
      const secFromText = parseClockStringToSeconds(rawTime);
      if (!isPlausiblePeriodClockSec(sport, secFromText)) return null;
      // Convert "47:30" → "47'"
      const colonIdx = rawTime.indexOf(":");
      if (colonIdx > 0) {
        const minutes = rawTime.slice(0, colonIdx);
        const extra = wcDisplayAddedMinutes(parsedScore);
        const base = `${minutes}'`;
        return extra != null ? `${base} +${extra}'` : base;
      }
      // Already plain or apostrophe format
      return rawTime.endsWith("'") ? rawTime : `${rawTime}'`;
    }
    return rawTime; // set sports: keep MM:SS
  }

  const secs = parsedScore.seconds;
  if (secs != null && secs > 0 && isPlausiblePeriodClockSec(sport, secs)) {
    const totalMin = Math.floor(secs / 60);
    if (!isSetSport) return `${totalMin}'`;
    const ss = String(secs % 60).padStart(2, "0");
    return `${String(totalMin).padStart(2, "0")}:${ss}`;
  }

  return null;
}

export function formatWcRowScore(event: WcEvent): {
  main: string;
  periods: string | null;
} {
  const isLive = event.phase === "live";
  const isSetSport =
    event.sport === "tennis"
    || event.sport === "table-tennis"
    || event.sport === "volleyball";

  const parsed = event.parsedScore;
  const details = parsed?.details;

  if (parsed?.text?.currentScore) {
    const main = parsed.text.currentScore;
    if (isLive && isSetSport && parsed.text.liveScore) {
      const gameScore = sportUsesTennisPointScore(event.sport)
        ? formatTennisGameScore(parsed.text.liveScore) ?? parsed.text.liveScore
        : parsed.text.liveScore;
      return { main: `${main} (${gameScore})`, periods: null };
    }

    if (details?.length && !isSetSport) {
      const periods = details.map(([h, a]) => `${h}:${a}`).join(" - ");
      return { main, periods: `(${periods})` };
    }

    return { main, periods: null };
  }

  if (event.homeScore != null && event.awayScore != null) {
    const main = `${event.homeScore}:${event.awayScore}`;
    if (details?.length && !isSetSport) {
      const periods = details.map(([h, a]) => `${h}:${a}`).join(" - ");
      return { main, periods: `(${periods})` };
    }
    return { main, periods: null };
  }

  return { main: "-", periods: null };
}

/** Compact list rows (homepage + /live): total score only. */
export function formatWcListLiveScore(event: WcEvent): {
  main: string;
  periods: string | null;
} {
  const { main } = formatWcRowScore(event);

  if (
    event.sport === "tennis"
    || event.sport === "table-tennis"
    || event.sport === "volleyball"
  ) {
    const cleanMain = main.replace(/\s*\([^)]*\)\s*$/, "").trim() || main;
    return { main: cleanMain, periods: null };
  }

  return { main, periods: null };
}

/** @deprecated use formatWcListLiveScore */
export const formatWcHomeLiveScore = formatWcListLiveScore;

export function sportHasTotals(sport: string): boolean {
  return isSoccerLikeSport(sport) || isBasketballLikeSport(sport) || sport === "hockey";
}

export function sportHasDoubleChance(sport: string): boolean {
  return isSoccerLikeSport(sport);
}

export function sportIsTwoWay(sport: string): boolean {
  return (
    sport === "tennis"
    || sport === "table-tennis"
    || sport === "volleyball"
    || sport === "mma"
    || sport.startsWith("esports.")
  );
}
