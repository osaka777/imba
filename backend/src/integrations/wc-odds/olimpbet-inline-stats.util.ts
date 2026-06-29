import type { OlimpbetInlineStat } from './wc-odds-statistics.types';

/** Inline stat codes we parse intentionally. Anything else is logged for audit. */
export const KNOWN_OLIMPBET_INLINE_STAT_CODES = new Set([
  'score',
  'scores_by_periods',
  'current_time',
  'remaining_time',
  'match_phase',
  'game_score',
  'current_server',
  'team1_red_cards',
  'team2_red_cards',
  'add_minutes',
]);

export function findUnknownOlimpbetInlineStatCodes(
  inline: OlimpbetInlineStat[] | null | undefined,
): string[] {
  const unknown = new Set<string>();
  for (const row of inline ?? []) {
    const code = row.code?.trim();
    if (!code || KNOWN_OLIMPBET_INLINE_STAT_CODES.has(code)) continue;
    unknown.add(code);
  }
  return [...unknown].sort();
}
