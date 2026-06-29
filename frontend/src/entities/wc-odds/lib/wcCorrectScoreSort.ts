import type { WcMarketOutcome } from "~/entities/wc-odds/api/client";

export function isCorrectScoreMarketKey(marketKey: string): boolean {
  return /CORRECT_SCORE|SCORE_VARIANT|^display_SCORE/i.test(marketKey);
}

function parseScorePair(name: string): { home: number; away: number } | null {
  const match = name.trim().match(/^(\d+):(\d+)$/);
  if (!match) return null;
  return { home: Number(match[1]), away: Number(match[2]) };
}

function correctScoreSortKey(home: number, away: number): [number, number, number] {
  if (home > away) return [0, away, home];
  if (home === away) return [1, home, away];
  return [2, home, away];
}

export function compareCorrectScoreOutcomes(
  left: WcMarketOutcome,
  right: WcMarketOutcome,
): number {
  const leftScore = parseScorePair(left.name);
  const rightScore = parseScorePair(right.name);

  if (!leftScore && !rightScore) return left.name.localeCompare(right.name, "ru");
  if (!leftScore) return 1;
  if (!rightScore) return -1;

  const leftKey = correctScoreSortKey(leftScore.home, leftScore.away);
  const rightKey = correctScoreSortKey(rightScore.home, rightScore.away);

  for (let i = 0; i < leftKey.length; i += 1) {
    if (leftKey[i] !== rightKey[i]) return leftKey[i]! - rightKey[i]!;
  }

  return 0;
}

export function sortCorrectScoreOutcomes(outcomes: WcMarketOutcome[]): WcMarketOutcome[] {
  if (outcomes.length < 2) return outcomes;
  return [...outcomes].sort(compareCorrectScoreOutcomes);
}
