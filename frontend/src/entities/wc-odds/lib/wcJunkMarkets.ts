/** Specialty junk that should not appear in the soccer line UI. */
const JUNK_SPECIALTY_CATALOG_PATTERNS: RegExp[] = [
  /^TOTAL_GOALS_MINUTES/i,
  /^TOTAL_.*GOAL_MINUTES/i,
  /^LEAD_MINUTES_TOTAL/i,
  /^MAX_MINUTES_WITH_NO_GOALS/i,
  /^DRAWN_MINUTES_TOTAL/i,
  /^MINUTE_GOAL/i,
  /^TOTAL_AFTER_X_MINUTES/i,
  /^NEXT_GOAL_TIME/i,
  /^WINNER_\d+MIN/i,
  /^WINNER_[ХX]_MIN/i,

  /^TO_COME_FROM/i,
  /^ALLGOALS_SCORED_AGAINST/i,
  /^NUMBER_FINAL_SCORE/i,
  /^OWNGOAL/i,
  /^HOW_WILL_/i,
  /^EQUAL_SCORE/i,
  /^BOTH_TEAMS_WILL_BE_LEADING/i,
  /^ANY_TEAM_IS_(DOWN|LOSING)/i,
  /RESULTING/i,
  /^MULTISCORE/i,
  /^SCORE_AFTER_X_GOALS/i,
  /^[23]GOALS_IN_ROW/i,
  /^STRONG_WILLED/i,
  /^WHICHS_EARLIER/i,
  /^SPECIAL_BETS/i,
  /^WHEN_WILL_LAST_GOAL/i,
  /^LAST_EVENT/i,
  /^GOALPOST/i,
  /^BALL_WILLBE/i,
  /^DISALLOWED_GOAL/i,
  /^PENALTY_OR_REDCARD/i,
  /^SCORING_EVENTS/i,
];

/** Raw English / nonsense category titles that never should surface in RU UI. */
const JUNK_CATEGORY_NAME_PATTERNS: RegExp[] = [
  /^TO COME FROM/i,
  /^ALLGOALS[_\s]/i,
  /^NUMBER[_\s]FINAL[_\s]SCORE/i,
  /^BOTH[_\s]TEAMS[_\s]WILL[_\s]BE[_\s]LEADING/i,
  /^ANY[_\s]TEAM[_\s]IS[_\s]/i,
  /^WINNER[_\sХX]/i,
  /^SCORE[_\s]AFTER/i,
  /^EQUAL[_\s]SCORE/i,
  /^RESULTING/i,
  /^MULTISCORE/i,
  /^HOW[_\s]WILL/i,
  /волевая\s+победа/i,
  /автогол/i,
  /итоговом\s+счете\s+будет\s+цифра/i,
  /все\s+голы\s+в\s+ворота\s+одной\s+стороны/i,
  /одинаковый\s+счет/i,
  /обе\s+команды\s+будут\s+лидировать/i,
  /проигрывает\s+.*по\s+ходу\s+матча/i,
  /результативность\s+тайм/i,
  /разновидности\s+счета/i,
  /как\s+будет\s+забит/i,
  /в\s+течение\s+матча/i,
  /победа\s*\(\s*\d+\s*мин/i,
  /когда\s+будет\s+забит\s+следующий\s+гол/i,
  /счет\s+после\s+\d+\s+гол/i,
  /специальные\s+ставки/i,
];

export function catalogStemFromMarketKey(marketKey: string): string {
  if (marketKey.startsWith("display_")) return marketKey.slice("display_".length);
  return marketKey;
}

export function isJunkSpecialtyMarketKey(marketKey: string): boolean {
  const catalog = catalogStemFromMarketKey(marketKey);
  return JUNK_SPECIALTY_CATALOG_PATTERNS.some((pattern) => pattern.test(catalog));
}

export function isJunkMarketCategoryName(categoryName: string): boolean {
  const name = categoryName.trim();
  if (!name) return false;
  return JUNK_CATEGORY_NAME_PATTERNS.some((pattern) => pattern.test(name));
}
