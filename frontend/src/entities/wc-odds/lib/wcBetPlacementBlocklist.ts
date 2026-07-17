function catalogStem(marketKey: string): string {
  if (marketKey.startsWith("display_")) return marketKey.slice("display_".length);
  return marketKey;
}

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

export function isWcBetPlacementBlockedMarket(marketKey: string): boolean {
  const catalog = catalogStem(marketKey);
  return BLOCKED_CATALOG_PATTERNS.some((pattern) => pattern.test(catalog));
}

export function isWcBetPlacementBlockedOutcome(
  marketKey: string,
  outcomeKey?: string | null,
): boolean {
  if (!outcomeKey) return false;

  const normalized = normalizeWcMarketKey(marketKey);
  if (normalized === "handicap") {
    return !/^(HOME|AWAY)_HCP_/.test(outcomeKey);
  }
  if (normalized === "handicap_3way") {
    return outcomeKey.startsWith("H3W_");
  }
  if (normalized === "double_chance") {
    return outcomeKey.startsWith("DC_") && !["DC_1X", "DC_12", "DC_X2"].includes(outcomeKey);
  }

  return false;
}

function normalizeWcMarketKey(marketKey: string): string {
  const baseKey = marketKey.replace(/_ot$/i, "");
  if (
    baseKey === "h2h"
    || baseKey === "totals"
    || baseKey === "totals_home"
    || baseKey === "totals_away"
    || baseKey === "even_odd"
    || baseKey === "btts"
    || baseKey === "double_chance"
    || baseKey === "handicap"
    || baseKey === "goals_both_min"
    || baseKey === "goals_both_half"
    || baseKey === "goals_both_teams_both_halves"
    || baseKey === "handicap_3way"
  ) {
    return baseKey;
  }
  if (/HANDICAP_3WAY/i.test(baseKey)) return "handicap_3way";
  if (baseKey.startsWith("display_GOALS_BOTH_BOTHHALF")) return "goals_both_teams_both_halves";
  if (baseKey.startsWith("display_GOALS_BOTHHALF")) return "goals_both_half";
  if (baseKey.startsWith("display_GOALS_BOTH_HALF")) return "goals_both_half";
  if (baseKey.startsWith("display_DOUBLE_CHANCE")) return "double_chance";
  if (baseKey.startsWith("display_HANDICAP")) return "handicap";
  if (baseKey.startsWith("display_TOTAL") || /display_INDIVIDUAL_TOTAL/i.test(baseKey)) return "totals";
  return baseKey;
}
