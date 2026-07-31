import type { OneWinOddsGroup } from './onewin-esports-markets.util';

/**
 * Infer series length (BO3 / BO5 / BO7) from 1win signals we already have.
 *
 * Safety rule: when signals conflict, prefer the *larger* bestOf.
 * Settling late (waiting for status/closed) is far safer than clinching a
 * live BO5 at 2-0 because we guessed BO3.
 *
 * We never infer BO3 from "Карта 3" markets alone — BO5 books also offer map 3.
 */
export function inferOneWinBestOf(input: {
  groupNames?: string[];
  leagueName?: null | string;
  seriesScoreLabels?: string[];
}): number | null {
  const fromLeague = bestOfFromLeagueName(input.leagueName);
  const fromScores = bestOfFromSeriesScores(input.seriesScoreLabels);
  const fromMaps = bestOfFromMapMarkets(input.groupNames);

  return coalesceBestOf(fromLeague, coalesceBestOf(fromScores, fromMaps));
}

/** Prefer larger BO when both known — avoids premature clinch. */
export function coalesceBestOf(
  a: null | number | undefined,
  b: null | number | undefined,
): number | null {
  const left = normalizeBestOf(a);
  const right = normalizeBestOf(b);
  if (left == null) return right;
  if (right == null) return left;
  return Math.max(left, right);
}

export function collectBestOfSignalsFromOddsGroups(groups: OneWinOddsGroup[]): {
  groupNames: string[];
  seriesScoreLabels: string[];
} {
  const groupNames: string[] = [];
  const seriesScoreLabels: string[] = [];

  for (const group of groups) {
    const name = group?.name?.trim();
    if (!name) continue;
    groupNames.push(name);

    const isMatchCorrectScore =
      /точный\s*счет|correct\s*score/i.test(name) && !/карта\s*\d+/i.test(name);
    if (!isMatchCorrectScore) continue;

    for (const odd of group.oddsList ?? []) {
      if (odd.name?.trim()) seriesScoreLabels.push(odd.name.trim());
      const rawVars = odd.vars?.v1;
      const fromVars =
        rawVars == null || rawVars === ''
          ? ''
          : String(rawVars).trim();
      if (fromVars) seriesScoreLabels.push(fromVars);
    }
  }

  return { groupNames, seriesScoreLabels };
}

function normalizeBestOf(value: null | number | undefined): number | null {
  if (value !== 1 && value !== 3 && value !== 5 && value !== 7) return null;
  return value;
}

function bestOfFromLeagueName(leagueName: null | string | undefined): number | null {
  if (!leagueName?.trim()) return null;
  const text = leagueName;

  const bo = text.match(/\bBO\s*([13579])\b/i) ?? text.match(/\bbo([13579])\b/i);
  if (bo) return normalizeBestOf(Number(bo[1]));

  const bestOf = text.match(/best\s*of\s*([13579])/i);
  if (bestOf) return normalizeBestOf(Number(bestOf[1]));

  // «до 2 побед» → BO3, «до 3 побед» → BO5, «до 4 побед» → BO7
  const wins = text.match(/до\s*([1-4])\s*побед/i);
  if (wins) {
    const n = Number(wins[1]);
    if (n >= 1 && n <= 4) return normalizeBestOf(2 * n - 1);
  }

  return null;
}

/**
 * Match-level correct score outcomes encode the series format:
 * 2:0 / 2:1 → BO3, 3:0 / 3:1 / 3:2 → BO5, 4:x → BO7.
 */
function bestOfFromSeriesScores(labels: string[] | undefined): number | null {
  if (!labels?.length) return null;
  let maxWins = 0;

  for (const label of labels) {
    const m = String(label).match(/(\d+)\s*[:\-–]\s*(\d+)/);
    if (!m) continue;
    const home = Number(m[1]);
    const away = Number(m[2]);
    if (!Number.isFinite(home) || !Number.isFinite(away)) continue;
    if (home > 4 || away > 4) continue;
    // Series scores always have a side that reached the win threshold.
    maxWins = Math.max(maxWins, home, away);
  }

  if (maxWins >= 4) return 7;
  if (maxWins >= 3) return 5;
  if (maxWins >= 2) return 3;
  return null;
}

/**
 * Map-scoped books: "Карта 5" implies at least BO5. Map 3 alone is inconclusive.
 */
function bestOfFromMapMarkets(groupNames: string[] | undefined): number | null {
  if (!groupNames?.length) return null;
  let maxMap = 0;
  for (const name of groupNames) {
    const m = name.match(/карта\s*(\d+)/i);
    if (!m) continue;
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > maxMap) maxMap = n;
  }
  if (maxMap >= 7) return 7;
  if (maxMap >= 4) return 5;
  return null;
}
