import type { OlimpbetEventDetail } from './olimpbet-wc.types';
import {
  isPointSetSportFeed,
  usesPointAggregateScore,
} from './point-set-sport-score.util';
import {
  extractOlimpbetScore,
  isOlimpbetEventCompleted,
  parseScorePair,
  statValue,
} from './olimpbet-event-result.util';

/** Minimal tennis cursor fields from persisted match-state (survives stripped feed stats). */
export type TennisMatchStateCursorSource = {
  tennis?: {
    setScores?: Array<{ home: number; away: number }>;
    gamesCompletedBySet?: Record<string, number>;
    games?: Record<string, { completed?: boolean; lastGameScore?: string }>;
  };
};

export type OlimpbetScorePair = {
  homeScore: number;
  awayScore: number;
};

export type PeriodScope =
  | { kind: 'quarter'; index: number }
  | { kind: 'half'; index: number };

export type MarketScope =
  | PeriodScope
  | { kind: 'set'; index: number }
  /** Tennis/table-tennis game within a set (e.g. "1-й сет, 7-й гейм"). */
  | { kind: 'game'; setIndex: number; gameIndex: number }
  /** Tennis point within a game (e.g. "1-й сет, 7-й гейм, 3-е очко"). */
  | { kind: 'point'; setIndex: number; gameIndex: number; pointIndex: number };

/** Parse half/quarter scope from coupon title or group label. */
export function parsePeriodScopeFromText(text: string): PeriodScope | null {
  const quarter = text.match(/(\d+)-я\s+четверть/i);
  if (quarter) {
    const index = Number(quarter[1]);
    if (index >= 1 && index <= 4) return { kind: 'quarter', index };
  }

  const half = text.match(/(\d+)-й\s+тайм/i);
  if (half) {
    const index = Number(half[1]);
    if (index >= 1 && index <= 2) return { kind: 'half', index };
  }

  return null;
}

/**
 * Parse set / game / point / half / quarter scope from bet label.
 * Prefer the most specific scope (point > game > set) so "1-й сет, 7-й гейм"
 * does not collapse to set-only.
 */
export function parseMarketScopeFromText(text: string): MarketScope | null {
  const point = text.match(
    /(\d+)\s*[-–—]?\s*[йи]\s+сет[\s\S]*?(\d+)\s*[-–—]?\s*[йи]\s+гейм[\s\S]*?(\d+)\s*[-–—]?\s*(?:[еейя]-?\s*)?очк/i,
  );
  if (point) {
    const setIndex = Number(point[1]);
    const gameIndex = Number(point[2]);
    const pointIndex = Number(point[3]);
    if (
      Number.isFinite(setIndex) && setIndex >= 1
      && Number.isFinite(gameIndex) && gameIndex >= 1
      && Number.isFinite(pointIndex) && pointIndex >= 1
    ) {
      return { kind: 'point', setIndex, gameIndex, pointIndex };
    }
  }

  const game = text.match(
    /(\d+)\s*[-–—]?\s*[йи]\s+сет[\s\S]*?(\d+)\s*[-–—]?\s*[йи]\s+гейм/i,
  );
  if (game) {
    const setIndex = Number(game[1]);
    const gameIndex = Number(game[2]);
    if (
      Number.isFinite(setIndex) && setIndex >= 1
      && Number.isFinite(gameIndex) && gameIndex >= 1
    ) {
      return { kind: 'game', setIndex, gameIndex };
    }
  }

  const set = text.match(/(\d+)-[йи]\s+сет/i);
  if (set) {
    const index = Number(set[1]);
    if (index >= 1 && index <= 5) return { kind: 'set', index };
  }

  return parsePeriodScopeFromText(text);
}

export function parsePeriodScoreList(
  detail?: OlimpbetEventDetail,
): Array<{ home: number; away: number }> {
  const raw = statValue(detail ?? { statistics: null }, 'scores_by_periods');
  if (raw) {
    const fromStats = raw
      .split(',')
      .map((chunk) => chunk.trim())
      .map((chunk) => parseScorePair(chunk.replace(/\s/g, '')))
      .filter((pair): pair is { home: number; away: number } => pair != null);
    if (fromStats.length > 0) return fromStats;
  }

  const homePeriods = detail?.fullStatistics?.homeStatistics?.periodScores ?? [];
  if (!homePeriods.length) return [];

  const awayByPeriod = new Map<number, number>();
  for (const period of detail?.fullStatistics?.awayStatistics?.periodScores ?? []) {
    const value = Number(period.score);
    if (Number.isFinite(value)) awayByPeriod.set(period.periodNumber, value);
  }

  return [...homePeriods]
    .sort((a, b) => a.periodNumber - b.periodNumber)
    .map((period) => {
      const home = Number(period.score);
      const away = awayByPeriod.get(period.periodNumber) ?? 0;
      if (!Number.isFinite(home)) return null;
      return { home, away };
    })
    .filter((pair): pair is { home: number; away: number } => pair != null);
}

const SOCCER_AFTER_FIRST_HALF = new Set([
  '31', '7', '32', '41', '42', '33', '34', '50', '100', '110', '120', '130',
]);

/** Whether a scoped period (half / quarter / set / game / point) is finished. */
export function isMarketScopeFinalized(
  detail: OlimpbetEventDetail | undefined,
  scope: MarketScope,
  matchState?: TennisMatchStateCursorSource | null,
): boolean {
  if (!detail) return false;

  if (scope.kind === 'half') {
    const phase = statValue(detail, 'match_phase');
    if (scope.index === 1) {
      if (phase === '6') return false;
      if (phase && SOCCER_AFTER_FIRST_HALF.has(phase)) return true;
      const periods = parsePeriodScoreList(detail);
      return periods.length >= 2;
    }
    if (scope.index === 2) {
      return isOlimpbetEventCompleted(detail);
    }
    return false;
  }

  if (scope.kind === 'quarter') {
    const periods = parsePeriodScoreList(detail);
    if (periods.length > scope.index) return true;
    if (isOlimpbetEventCompleted(detail) && periods.length >= scope.index) return true;
    return false;
  }

  if (scope.kind === 'set') {
    const periods = parsePeriodScoreList(detail);
    // Set is done only when the next set appears in scores_by_periods.
    // Do not compare raw match_phase to set index — Olimpbet uses Sportradar
    // status codes (e.g. 7 = soccer 2nd half) that are unrelated to set number.
    if (periods.length > scope.index) return true;

    if (isOlimpbetEventCompleted(detail)) {
      if (periods.length >= scope.index) return true;
      // Match ended before this set started (e.g. 2:1 → no 4th set).
      if (periods.length < scope.index) return true;
    }
    return false;
  }

  if (scope.kind === 'game' || scope.kind === 'point') {
    return isTennisGameOrPointScopeFinalized(detail, scope, matchState);
  }

  return false;
}

const TENNIS_POINT_RANK: Record<number, number> = {
  0: 0,
  15: 1,
  30: 2,
  40: 3,
  50: 4,
};

/**
 * Estimate how many points have already been played in the current game from
 * the live game_score (0:0 → 0, 30:15 → 3, 40:40 → 6, A:40 → 7).
 */
export function estimateTennisPointsPlayed(gameScoreRaw: string | null | undefined): number | null {
  if (!gameScoreRaw?.trim()) return null;
  const parts = gameScoreRaw.trim().split(':');
  if (parts.length !== 2) return null;

  const parseToken = (raw: string): number | null => {
    const core = raw.replace(/\*/g, '').trim();
    if (!core) return null;
    if (core === 'A' || core === '50') return 50;
    const n = Number(core);
    return Number.isFinite(n) ? n : null;
  };

  const home = parseToken(parts[0]!);
  const away = parseToken(parts[1]!);
  if (home == null || away == null) return null;

  const homeRank = TENNIS_POINT_RANK[home];
  const awayRank = TENNIS_POINT_RANK[away];
  if (homeRank == null || awayRank == null) return null;
  return homeRank + awayRank;
}

/** Current set index + games completed + live game number from feed score. */
export function resolveTennisLiveGameCursor(
  detail: OlimpbetEventDetail | undefined,
  matchState?: TennisMatchStateCursorSource | null,
): {
  setIndex: number;
  gamesCompleted: number;
  currentGameIndex: number;
  pointsPlayed: number | null;
} | null {
  if (!detail && !matchState?.tennis) return null;

  const periods = detail ? parsePeriodScoreList(detail) : [];
  const tennis = matchState?.tennis;
  const setScores = tennis?.setScores?.length ? tennis.setScores : periods;

  if (setScores.length > 0) {
    const setIndex = setScores.length;
    const current = setScores[setIndex - 1]!;
    const fromPair = current.home + current.away;
    const fromMap = tennis?.gamesCompletedBySet?.[String(setIndex)];
    const gamesCompleted = Math.max(
      fromPair,
      typeof fromMap === 'number' && Number.isFinite(fromMap) ? fromMap : 0,
    );
    const currentGameIndex = gamesCompleted + 1;
    const gameScoreRaw =
      (detail ? statValue(detail, 'game_score') : null)
      ?? tennis?.games?.[`${setIndex}:${currentGameIndex}`]?.lastGameScore
      ?? null;
    return {
      setIndex,
      gamesCompleted,
      currentGameIndex,
      pointsPlayed: estimateTennisPointsPlayed(gameScoreRaw),
    };
  }

  // Feed stripped period scores — fall back to gamesCompletedBySet alone.
  if (tennis?.gamesCompletedBySet) {
    const setIndexes = Object.keys(tennis.gamesCompletedBySet)
      .map(Number)
      .filter((n) => Number.isFinite(n) && n >= 1);
    if (setIndexes.length === 0) return null;
    const setIndex = Math.max(...setIndexes);
    const gamesCompleted = tennis.gamesCompletedBySet[String(setIndex)] ?? 0;
    const currentGameIndex = gamesCompleted + 1;
    const gameScoreRaw =
      (detail ? statValue(detail, 'game_score') : null)
      ?? tennis.games?.[`${setIndex}:${currentGameIndex}`]?.lastGameScore
      ?? null;
    return {
      setIndex,
      gamesCompleted,
      currentGameIndex,
      pointsPlayed: estimateTennisPointsPlayed(gameScoreRaw),
    };
  }

  return null;
}

function isTennisGameOrPointScopeFinalized(
  detail: OlimpbetEventDetail,
  scope: Extract<MarketScope, { kind: 'game' | 'point' }>,
  matchState?: TennisMatchStateCursorSource | null,
): boolean {
  // Entire match over → every in-game market is done.
  if (isOlimpbetEventCompleted(detail)) return true;

  const cursor = resolveTennisLiveGameCursor(detail, matchState);
  if (!cursor) return false;

  // Earlier set than the live one → game/point already finished with that set.
  if (scope.setIndex < cursor.setIndex) return true;
  // Future set → keep (not started).
  if (scope.setIndex > cursor.setIndex) return false;

  // Same set: past games are done; current/future stay open.
  if (scope.gameIndex < cursor.currentGameIndex) return true;
  if (scope.gameIndex > cursor.currentGameIndex) return false;

  // Current game — game-level books stay open until the game completes.
  if (scope.kind === 'game') return false;

  // Point book for the live game: drop points that have already been played.
  if (cursor.pointsPlayed == null) return false;
  return scope.pointIndex <= cursor.pointsPlayed;
}

function extractSetScore(
  detail: OlimpbetEventDetail | undefined,
  setIndex: number,
): OlimpbetScorePair | null {
  const pair = parsePeriodScoreList(detail)[setIndex - 1];
  if (!pair) return null;
  return { homeScore: pair.home, awayScore: pair.away };
}

function sumSlice(
  pairs: Array<{ home: number; away: number }>,
  start: number,
  count: number,
): OlimpbetScorePair | null {
  const slice = pairs.slice(start, start + count);
  if (slice.length < count) return null;

  let home = 0;
  let away = 0;
  for (const pair of slice) {
    home += pair.home;
    away += pair.away;
  }
  return { homeScore: home, awayScore: away };
}

/** Score for a specific half or quarter when period breakdown is available. */
export function extractPeriodScore(
  detail: OlimpbetEventDetail | undefined,
  scope: PeriodScope,
): OlimpbetScorePair | null {
  if (!detail) return null;

  const periods = parsePeriodScoreList(detail);
  if (!periods.length) return null;

  if (scope.kind === 'quarter') {
    const pair = periods[scope.index - 1];
    if (!pair) return null;
    return { homeScore: pair.home, awayScore: pair.away };
  }

  if (periods.length >= 4) {
    if (scope.index === 1) return sumSlice(periods, 0, 2);
    if (scope.index === 2) return sumSlice(periods, 2, 2);
  }

  const pair = periods[scope.index - 1];
  if (!pair) return null;
  return { homeScore: pair.home, awayScore: pair.away };
}

function sumScorePairs(
  pairs: Array<{ home: number; away: number }>,
  take: number,
): OlimpbetScorePair | null {
  const slice = pairs.slice(0, take);
  if (slice.length < take) return null;

  let home = 0;
  let away = 0;
  for (const pair of slice) {
    home += pair.home;
    away += pair.away;
  }
  return { homeScore: home, awayScore: away };
}

function sumAllPeriods(
  pairs: Array<{ home: number; away: number }>,
): OlimpbetScorePair {
  let home = 0;
  let away = 0;
  for (const pair of pairs) {
    home += pair.home;
    away += pair.away;
  }
  return { homeScore: home, awayScore: away };
}

/** Tennis set periods in scores_by_periods (not soccer halves). */
export function looksLikeTennisSetPeriods(
  periods: Array<{ home: number; away: number }>,
): boolean {
  if (periods.length === 0) return false;
  return periods.every(
    (period) =>
      period.home >= 0
      && period.away >= 0
      && period.home <= 7
      && period.away <= 7
      && period.home + period.away >= 4,
  );
}

/** Volleyball / table-tennis point totals per set (not tennis games or soccer halves). */
export function looksLikePointSetSportPeriods(
  periods: Array<{ home: number; away: number }>,
): boolean {
  if (periods.length === 0) return false;
  if (looksLikeTennisSetPeriods(periods)) return false;
  return periods.some(
    (period) => period.home > 7 || period.away > 7 || period.home + period.away >= 15,
  );
}

/** Regulation-time score (excludes overtime periods when period breakdown is available). */
export function extractRegulationScore(detail?: OlimpbetEventDetail): OlimpbetScorePair | null {
  if (!detail) return null;

  for (const code of ['score_regular_time', 'regular_time_score', 'score_main_time']) {
    const parsed = parseScorePair(statValue(detail, code));
    if (parsed) return { homeScore: parsed.home, awayScore: parsed.away };
  }

  const periods = parsePeriodScoreList(detail);
  if (periods.length >= 1 && looksLikePointSetSportPeriods(periods)) {
    return sumAllPeriods(periods);
  }
  if (periods.length >= 4) {
    if (looksLikeTennisSetPeriods(periods.slice(0, 4))) return null;
    const fourPeriods = sumScorePairs(periods, 4);
    if (fourPeriods) return fourPeriods;
  }
  if (periods.length >= 2) {
    if (looksLikeTennisSetPeriods(periods.slice(0, 2))) return null;
    return sumScorePairs(periods, 2);
  }

  return null;
}

export function isOvertimeMarketKey(marketKey: string): boolean {
  return /_ot$/i.test(marketKey) || /WITH_?OT/i.test(marketKey);
}

export { usesPointAggregateScore } from './point-set-sport-score.util';

/** Pick home/away goals for settlement based on market OT scope. */
export function pickSettlementScores(
  detail: OlimpbetEventDetail | undefined,
  fallbackHome: number,
  fallbackAway: number,
  marketKey: string,
  scopeHint?: string | null,
): OlimpbetScorePair {
  const marketScope = scopeHint ? parseMarketScopeFromText(scopeHint) : null;

  if (marketScope?.kind === 'set') {
    const setScore = extractSetScore(detail, marketScope.index);
    if (setScore) return setScore;
  }

  if (marketScope?.kind === 'half' || marketScope?.kind === 'quarter') {
    const periodScore = extractPeriodScore(detail, marketScope);
    if (periodScore) return periodScore;
  }

  const legacyScope = scopeHint ? parsePeriodScopeFromText(scopeHint) : null;
  if (legacyScope) {
    const periodScore = extractPeriodScore(detail, legacyScope);
    if (periodScore) return periodScore;
  }

  const includeOt = isOvertimeMarketKey(marketKey);

  if (!includeOt && usesPointAggregateScore(marketKey)) {
    const regulation = extractRegulationScore(detail);
    if (regulation) return regulation;
  }

  const fromDetail = extractOlimpbetScore(detail ?? { score: null, statistics: null });
  const home = fromDetail.homeScore ?? fallbackHome;
  const away = fromDetail.awayScore ?? fallbackAway;

  return { homeScore: home, awayScore: away };
}
