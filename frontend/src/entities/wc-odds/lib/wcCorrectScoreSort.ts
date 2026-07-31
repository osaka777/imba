import type { WcMarketOutcome } from "~/entities/wc-odds/api/client";

export function isCorrectScoreMarketKey(marketKey: string): boolean {
  return /CORRECT_SCORE|SCORE_VARIANT|^display_SCORE/i.test(marketKey);
}

/** Hide stub map correct-score books where one price dominates (e.g. all 10.00). */
export function isFlatCorrectScoreOddsBook(prices: number[]): boolean {
  if (prices.length < 8) return false;
  const counts = new Map<number, number>();
  for (const price of prices) {
    const key = Math.round(price * 100) / 100;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let maxCount = 0;
  let mode = 0;
  for (const [key, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      mode = key;
    }
  }
  const ratio = maxCount / prices.length;
  if (mode === 10 && ratio >= 0.55) return true;
  return ratio >= 0.7;
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
