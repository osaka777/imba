/** Parse Olimpbet tennis point token (40, 50=advantage, * server marker). */
export function parseTennisPointToken(raw: string): number | null {
  const core = raw.replace(/\*/g, '').trim();
  if (!core) return null;
  if (core === 'A' || core === '50') return 50;
  const n = Number(core);
  return Number.isFinite(n) ? n : null;
}

export function parseTennisGameScore(
  raw: string | null | undefined,
): { home: number; away: number } | null {
  if (!raw?.trim()) return null;
  const parts = raw.trim().split(':');
  if (parts.length !== 2) return null;
  const home = parseTennisPointToken(parts[0]);
  const away = parseTennisPointToken(parts[1]);
  if (home == null || away == null) return null;
  return { home, away };
}

/** Display form for Olimpbet game_score (50 → A, keeps * server marker). */
export function formatTennisGameScoreDisplay(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;

  return raw
    .trim()
    .split(':')
    .map((part) => {
      const trailingStar = part.endsWith('*');
      const leadingStar = part.startsWith('*');
      const core = part.replace(/\*/g, '').trim();
      const display = core === '50' ? 'A' : core;
      if (trailingStar) return `${display}*`;
      if (leadingStar) return `*${display}`;
      return display;
    })
    .join(':');
}

const POINT_RANK: Record<number, number> = {
  0: 0,
  15: 1,
  30: 2,
  40: 3,
  50: 4,
};

export function isTennisGameStartScore(raw: string | null | undefined): boolean {
  const score = parseTennisGameScore(raw);
  if (!score) return false;
  return score.home === 0 && score.away === 0;
}

/**
 * Detect who won the point between two consecutive game_score snapshots.
 * Returns null when the transition is ambiguous (feed gap / new game without context).
 */
export function detectTennisPointWinner(
  prevRaw: string,
  currRaw: string,
): 'home' | 'away' | null {
  const prev = parseTennisGameScore(prevRaw);
  const curr = parseTennisGameScore(currRaw);
  if (!prev || !curr) return null;

  if (isTennisGameStartScore(currRaw) && !isTennisGameStartScore(prevRaw)) {
    return inferTennisGameClosingPointWinner(prev);
  }

  if (prev.home === 50 && curr.home === 40 && curr.away === 40) return 'away';
  if (prev.away === 50 && curr.home === 40 && curr.away === 40) return 'home';

  if (prev.home === 40 && prev.away === 40 && curr.home === 50 && curr.away === 40) return 'home';
  if (prev.home === 40 && prev.away === 40 && curr.home === 40 && curr.away === 50) return 'away';

  const prevHomeRank = POINT_RANK[prev.home] ?? -1;
  const prevAwayRank = POINT_RANK[prev.away] ?? -1;
  const currHomeRank = POINT_RANK[curr.home] ?? -1;
  const currAwayRank = POINT_RANK[curr.away] ?? -1;

  const homeUp = currHomeRank > prevHomeRank;
  const awayUp = currAwayRank > prevAwayRank;

  if (homeUp && !awayUp) return 'home';
  if (awayUp && !homeUp) return 'away';

  return null;
}

/** Winner of the game-ending point from the last in-game score before 0:0. */
export function inferTennisGameClosingPointWinner(
  lastInGameScore: { home: number; away: number },
): 'home' | 'away' | null {
  const { home, away } = lastInGameScore;

  if (home === 50 && away === 40) return 'home';
  if (away === 50 && home === 40) return 'away';
  if (home === 40 && away < 40) return 'home';
  if (away === 40 && home < 40) return 'away';

  return null;
}

/**
 * Deuce occurred in this game if score is 40:40 or either side has advantage (50).
 * Advantage implies the game passed through deuce.
 */
export function tennisGameScoreHadDeuce(raw: string | null | undefined): boolean {
  const score = parseTennisGameScore(raw);
  if (!score) return false;
  if (score.home === 40 && score.away === 40) return true;
  if (score.home === 50 || score.away === 50) return true;
  return false;
}
