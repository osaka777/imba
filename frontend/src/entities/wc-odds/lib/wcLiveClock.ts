import type { WcEventDetail } from "~/entities/wc-odds/api/client";

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

/** Stop extrapolating after this many seconds without a fresh server clock. */
export const WC_CLOCK_EXTRAPOLATE_MAX_SEC = 120;

const SOCCER_ABNORMAL_CLOCK_SEC = 100 * 60;

type WcClockEvent = Pick<WcEventDetail, "phase" | "completed" | "sport" | "parsedScore" | "feedStatus">;

/** Match is over for UI even if the feed still marks it live. */
export function isWcMatchEffectivelyFinished(event: WcClockEvent): boolean {
  if (event.completed || event.phase === "finished") return true;
  if (event.feedStatus === "EVENT_FINISHED") return true;
  if (event.phase !== "live") return false;

  const secs = event.parsedScore?.seconds;
  if (secs != null && secs >= SOCCER_ABNORMAL_CLOCK_SEC && event.sport === "soccer") {
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

  const remaining = score?.remainingTimeInPeriodSec;
  if (remaining != null && remaining > 0) return true;

  if (!score?.seconds || score.seconds <= 0) return false;

  return true;
}
