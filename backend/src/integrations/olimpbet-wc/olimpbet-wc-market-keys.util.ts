import type { WcGroupedMarkets } from '../wc-odds/wc-odds-markets.util';
import {
  stripFlatPlaceholderEsportsMarkets,
  stripPlaceholderMapCorrectScoreMarkets,
} from './olimpbet-map-correct-score.util';

export type WcResolvedMarketKey = {
  marketKey: string;
  bettable: boolean;
};

/** Overtime variants share the same settlement/display logic as base markets. */
export function stripOvertimeCatalogSuffix(catalogName: string): string {
  return catalogName.replace(/_WITH_?OT$/i, '');
}

const H2H_CATALOG_NAMES = new Set([
  'MATCH_WINNER_X3',
  'MATCH_WINNER',
  'MATCH_WINNER_X2',
  'WINNER_GAME',
]);

const TOTALS_CATALOG_NAMES = new Set([
  'TOTAL',
  'TOTAL_ASIAN',
  'TOTAL_SET',
  'TOTAL_HALF',
  'TOTAL_ASIAN_HALF',
  'TOTAL_HALF_3WAY',
  'TOTAL_ADD_TIME_HALF',
  'TOTAL_MAP',
  'TOTAL_ROUNDS',
  'TEAM_TOTAL',
  'TEAM_TOTAL_1',
  'TEAM_TOTAL_2',
  'INDIVIDUAL_TOTAL_TEAM1',
  'INDIVIDUAL_TOTAL_TEAM2',
]);

const EVEN_ODD_CATALOG_NAMES = new Set(['EVEN_ODD']);

const HANDICAP_CATALOG_NAMES = new Set([
  'HANDICAP',
  'HANDICAP_ASIAN',
  'HANDICAP_EUROPEAN',
  'HANDICAP_BY_SET',
]);

function isH2hCatalogName(baseName: string): boolean {
  return H2H_CATALOG_NAMES.has(baseName) || /^MATCH_WINNER/i.test(baseName);
}

function isEvenOddCatalogName(baseName: string): boolean {
  return EVEN_ODD_CATALOG_NAMES.has(baseName) || /^EVEN_ODD/i.test(baseName);
}

function isCountSetCatalogName(baseName: string): boolean {
  return baseName === 'COUNT_SET' || /^COUNT_SET_/i.test(baseName);
}

/** Match / period / asian / map totals — not specialty TOTAL_FOULS_*, TOTAL_GOALS_MINUTES, etc. */
function isMatchTotalsCatalogName(baseName: string): boolean {
  if (TOTALS_CATALOG_NAMES.has(baseName)) return true;
  if (/^TOTAL(_ASIAN)?(_HALF)?(_3WAY)?$/i.test(baseName)) return true;
  if (/^TOTAL_ADD_TIME(_HALF)?$/i.test(baseName)) return true;
  if (/^TOTAL_(MAP|ROUNDS|SET)$/i.test(baseName)) return true;
  return false;
}

function isTotalsCatalogName(baseName: string): boolean {
  if (isEvenOddCatalogName(baseName)) return false;
  if (isCountSetCatalogName(baseName)) return false;
  if (isMatchTotalsCatalogName(baseName)) return true;
  if (/^TEAM_TOTAL/i.test(baseName) || /^INDIVIDUAL_TOTAL/i.test(baseName)) return true;
  return false;
}

function isHandicapCatalogName(baseName: string): boolean {
  return HANDICAP_CATALOG_NAMES.has(baseName) || /^HANDICAP(?!_3WAY)/i.test(baseName);
}

/** Team-scoped totals (not match total). Includes HALF / ASIAN / X_MIN / MAP suffixes. */
export function resolveTeamTotalsMarketKey(baseName: string): 'totals_home' | 'totals_away' | null {
  const asian = /^INDIVIDUAL_TOTAL_ASIAN_TEAM(\d+)/i.exec(baseName);
  if (asian) {
    const team = Number(asian[1]);
    if (team === 1) return 'totals_home';
    if (team === 2) return 'totals_away';
    return null;
  }

  // INDIVIDUAL_TOTAL_TEAM1, _TEAM1_HALF, _TEAM1_X_MIN, _TEAM1_MAP, …
  const individual = /^INDIVIDUAL_TOTAL_TEAM(\d+)/i.exec(baseName);
  if (individual) {
    const team = Number(individual[1]);
    if (team === 1) return 'totals_home';
    if (team === 2) return 'totals_away';
    return null;
  }

  if (/^TEAM_TOTAL_1(?:_|$)/i.test(baseName) || /^TEAM_TOTAL_1$/i.test(baseName)) {
    return 'totals_home';
  }
  if (/^TEAM_TOTAL_2(?:_|$)/i.test(baseName) || /^TEAM_TOTAL_2$/i.test(baseName)) {
    return 'totals_away';
  }
  return null;
}

/**
 * Specialty junk that does not belong in a clean soccer line
 * (minute sums, “digit in score”, how goal scored, come-from-behind English keys, …).
 * Dropped at parse and hidden in UI.
 */
const JUNK_SPECIALTY_CATALOG_PATTERNS: RegExp[] = [
  // Minute / interval nonsense
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

  // Illogical / unreadable specialty (raw EN catalogs & nonsense props)
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

export function isJunkSpecialtyCatalogName(catalogName: string): boolean {
  const base = stripOvertimeCatalogSuffix(catalogName);
  return JUNK_SPECIALTY_CATALOG_PATTERNS.some((pattern) => pattern.test(base));
}

/** @deprecated use isJunkSpecialtyCatalogName */
export function isJunkMinuteTotalsCatalogName(catalogName: string): boolean {
  return isJunkSpecialtyCatalogName(catalogName);
}

const JUNK_SPECIALTY_CATEGORY_PATTERNS: RegExp[] = [
  /в\s+течение\s+матча/i,
  /результативность\s+тайм/i,
  /волевая\s+победа/i,
  /автогол/i,
  /итоговом\s+счете\s+будет\s+цифра/i,
  /все\s+голы\s+в\s+ворота\s+одной\s+стороны/i,
  /одинаковый\s+счет/i,
  /обе\s+команды\s+будут\s+лидировать/i,
  /проигрывает\s+.*по\s+ходу\s+матча/i,
  /разновидности\s+счета/i,
  /как\s+будет\s+забит/i,
  /специальные\s+ставки/i,
  /^TO COME FROM/i,
  /^ALLGOALS/i,
  /^NUMBER[_\s]FINAL/i,
  /^BOTH[_\s]TEAMS[_\s]WILL/i,
  /^ANY[_\s]TEAM[_\s]IS/i,
  /^RESULTING/i,
  /^MULTISCORE/i,
  /^HOW[_\s]WILL/i,
];

export function isJunkSpecialtyCategoryName(categoryName: string): boolean {
  const name = categoryName.trim();
  if (!name) return false;
  return JUNK_SPECIALTY_CATEGORY_PATTERNS.some((pattern) => pattern.test(name));
}

export function catalogStemFromMarketKey(marketKey: string): string {
  if (marketKey.startsWith('display_')) return marketKey.slice('display_'.length);
  return marketKey;
}

export function isJunkSpecialtyMarketKey(marketKey: string): boolean {
  return isJunkSpecialtyCatalogName(catalogStemFromMarketKey(marketKey));
}

/** Drop junk specialty markets from a grouped blob (cached + live). */
export function stripJunkSpecialtyGroupedMarkets<
  T extends { marketKey: string },
>(grouped: Record<string, T[]>): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const [category, groups] of Object.entries(grouped)) {
    if (isJunkSpecialtyCategoryName(category)) continue;
    const kept = groups.filter((group) => !isJunkSpecialtyMarketKey(group.marketKey));
    if (kept.length > 0) out[category] = kept;
  }
  return stripFlatPlaceholderEsportsMarkets(
    stripPlaceholderMapCorrectScoreMarkets(out as unknown as WcGroupedMarkets),
  ) as unknown as Record<string, T[]>;
}

export function resolveWcMarketKey(
  catalogName: string,
  _isMainEvent = true,
): WcResolvedMarketKey {
  const baseName = stripOvertimeCatalogSuffix(catalogName);

  if (isH2hCatalogName(baseName)) {
    return { marketKey: 'h2h', bettable: true };
  }
  if (baseName === 'GOALS_BOTH') return { marketKey: 'btts', bettable: true };
  if (baseName === 'GOALS_BOTH_HALF') {
    return { marketKey: 'goals_both_half', bettable: true };
  }
  if (baseName === 'GOALS_BOTHHALF') {
    return { marketKey: 'goals_both_half', bettable: true };
  }
  if (baseName === 'GOALS_BOTH_BOTHHALF') {
    return { marketKey: 'goals_both_teams_both_halves', bettable: true };
  }
  if (baseName === 'GOALS_BOTH_MIN_YES_NO' || baseName.startsWith('GOALS_BOTH_MIN')) {
    return { marketKey: 'goals_both_min', bettable: true };
  }
  if (baseName === 'DOUBLE_CHANCE' || /^DOUBLE_CHANCE/i.test(baseName)) {
    return { marketKey: 'double_chance', bettable: true };
  }
  if (isEvenOddCatalogName(baseName)) {
    return { marketKey: 'even_odd', bettable: true };
  }
  const teamTotals = resolveTeamTotalsMarketKey(baseName);
  if (teamTotals) {
    return { marketKey: teamTotals, bettable: true };
  }
  if (isTotalsCatalogName(baseName)) {
    return { marketKey: 'totals', bettable: true };
  }
  if (isHandicapCatalogName(baseName)) {
    return { marketKey: 'handicap', bettable: true };
  }
  if (isCountSetCatalogName(baseName)) {
    return { marketKey: `display_${catalogName}`, bettable: true };
  }
  if (/^HANDICAP_3WAY/i.test(baseName)) {
    return { marketKey: 'handicap_3way', bettable: true };
  }
  if (baseName === 'GOALS_TEAM1') return { marketKey: 'display_GOALS_TEAM1', bettable: true };
  if (baseName === 'GOALS_TEAM2') return { marketKey: 'display_GOALS_TEAM2', bettable: true };
  if (baseName === 'WINNER_YES_NO') return { marketKey: 'display_WINNER_YES_NO', bettable: true };

  return { marketKey: `display_${catalogName}`, bettable: true };
}
