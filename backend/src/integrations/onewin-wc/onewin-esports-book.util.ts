import type { OneWinMatchSnapshot } from './onewin-wc.types';

/**
 * Whether 1win still accepts bets on this match.
 * Prefer explicit `hasOpenOdds`; fall back to `enabledOddsCount`.
 * Unknown → true (do not lock the book on missing push data).
 */
export function isOneWinBookOpen(
  snap: Pick<OneWinMatchSnapshot, 'enabledOddsCount' | 'hasOpenOdds'> | null | undefined,
  completed = false,
): boolean {
  if (completed) return false;
  if (!snap) return true;
  if (snap.hasOpenOdds === false) return false;
  if (snap.hasOpenOdds === true) return true;
  if (typeof snap.enabledOddsCount === 'number') {
    return snap.enabledOddsCount > 0;
  }
  return true;
}
