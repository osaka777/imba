import { catalogNameFromMarketKey } from './wc-settlement-profile.util';
import { normalizeWcMarketKey } from './wc-odds-markets.util';

function catalogStem(marketKey: string): string {
  return catalogNameFromMarketKey(marketKey)
    ?? marketKey.replace(/^display_/i, '');
}

/** Catalog families without native settlement — show in line, block coupon. */
const BLOCKED_CATALOG_PATTERNS: RegExp[] = [
  /_OR_/i,
  /^HOW_WILL_/i,
  /^FIRST_GOAL_AND/i,
  /^LAST_GOAL_AND/i,

  /^SERIESPENALTY/i,
  /^MARGIN_PENALTY/i,
  /^NEXT_SERIESPENALTY/i,
  /^WINNER_SERIESPENALTY/i,

  /^STRONG_WILLED_/i,
  /^OWNGOAL/i,
  /^WHICHS_EARLIER/i,
  /^WINNER_YES_NO$/i,

  /^SCORING_EVENTS/i,
  /^CLEAN_WIN_/i,
  /^NUMBER_FINAL_SCORE/i,
  /^PENALTY_OR_REDCARD/i,
  /^ALL_YELLOW_CARDS/i,
  /^ANY_SUBSTITUTE/i,
  /^HEADCOACH_/i,
  /^SPECIAL_BETS_/i,
  /^DRAW_ONE_HALF/i,
  /^TEAM[12]_WIN_(BOTHPART|ONE_PART)/i,
  /^NOT_(WIN|LOSE)_IN_REGULATION/i,
  /^HATTRICK/i,
  /^DOUBLE$/i,
  /^KICKGOAL/i,
  /^HEADER$/i,
  /^DIRECT_FREEKICK/i,
  /^STRIKER/i,
  /^MIDFIELDER/i,
  /^DEFENDER/i,
  /^GOALPOST_/i,
  /^DISALLOWED_GOAL/i,
  /^PLAYER_/i,
  /^BALL_WILLBE/i,

  // Minute-totals junk (sum of goal minutes, lead minutes, …)
  /^TOTAL_GOALS_MINUTES/i,
  /^TOTAL_.*GOAL_MINUTES/i,
  /^LEAD_MINUTES_TOTAL/i,
  /^MAX_MINUTES_WITH_NO_GOALS/i,
  /^DRAWN_MINUTES_TOTAL/i,
  /^MINUTE_GOAL/i,

  /CORNER/i,
  /YELLOW/i,
  /YCARD/i,
  /REDCARD/i,
  /RED_CARD/i,
  /FOUL/i,
  /OFFSIDE/i,
  /ACES/i,
  /ACE_/i,
  /DOUBLE_FAULT/i,
  /BREAK_/i,
  /SUBSTITUT/i,
  /SHOT_ON/i,
  /SAVE/i,
  /FREEKICK/i,
  /GOALKICK/i,
  /THROW_IN/i,
];

export function isBlockedCatalogStem(catalog: string): boolean {
  return BLOCKED_CATALOG_PATTERNS.some((pattern) => pattern.test(catalog));
}

/** Markets we show in the feed but must not accept in the coupon (no reliable settlement). */
export function isWcBetPlacementBlockedMarket(marketKey: string): boolean {
  const catalog = catalogStem(marketKey);
  return isBlockedCatalogStem(catalog);
}

/** Reject parser fallback outcome keys that always settle as LOSE. */
export function isWcBetPlacementBlockedOutcome(
  marketKey: string,
  outcomeKey?: string | null,
): boolean {
  if (!outcomeKey) return false;

  const normalized = normalizeWcMarketKey(marketKey);
  if (normalized === 'handicap') {
    return !/^(HOME|AWAY)_HCP_/.test(outcomeKey);
  }
  if (normalized === 'handicap_3way') {
    return outcomeKey.startsWith('H3W_');
  }
  if (normalized === 'double_chance') {
    return outcomeKey.startsWith('DC_') && !['DC_1X', 'DC_12', 'DC_X2'].includes(outcomeKey);
  }

  return false;
}
