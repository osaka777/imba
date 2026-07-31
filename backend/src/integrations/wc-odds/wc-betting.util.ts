import { WC_LINE_WINDOW_MS, WC_LINE_WINDOW_MS_MMA, WC_MMA_SPORT_KEY } from './wc-line-time.util';

/** Betting stays open until the match is marked completed (prematch + live). */
export function isWcBettingOpen(
  completed: boolean,
  _commenceTime?: Date,
  _nowMs: number = Date.now(),
): boolean {
  return !completed;
}

export type WcEventPhase = 'prematch' | 'live' | 'finished';

export function getWcEventPhase(
  completed: boolean,
  commenceTime: Date,
  nowMs: number = Date.now(),
): WcEventPhase {
  if (completed) return 'finished';
  if (commenceTime.getTime() <= nowMs) return 'live';
  return 'prematch';
}

/** Line list: upcoming prematch within sport-specific horizon. */
export function wcLineEventWhere(now: Date = new Date()) {
  const weekEnd = new Date(now.getTime() + WC_LINE_WINDOW_MS);
  const mmaEnd = new Date(now.getTime() + WC_LINE_WINDOW_MS_MMA);
  return {
    completed: false,
    OR: [
      { sportKey: WC_MMA_SPORT_KEY, commenceTime: { gt: now, lte: mmaEnd } },
      { sportKey: { not: WC_MMA_SPORT_KEY }, commenceTime: { gt: now, lte: weekEnd } },
    ],
  };
}

/**
 * Max age for live list/enrich/rotate.
 * Unfinished rows older than this are zombies (Olimp 404) that starve the HTTP queue.
 * 8h covers ET/pens; anything longer is not a real in-play book.
 */
export const WC_LIVE_MAX_AGE_MS = 8 * 60 * 60 * 1000;

export function wcLiveEventWhere(now: Date = new Date()) {
  return {
    completed: false,
    commenceTime: {
      lte: now,
      gt: new Date(now.getTime() - WC_LIVE_MAX_AGE_MS),
    },
  } as const;
}
