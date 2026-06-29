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
  'COUNT_SET',
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

function isTotalsCatalogName(baseName: string): boolean {
  if (isEvenOddCatalogName(baseName)) return false;
  return (
    TOTALS_CATALOG_NAMES.has(baseName)
    || /^TOTAL/i.test(baseName)
    || /^TEAM_TOTAL/i.test(baseName)
    || /^INDIVIDUAL_TOTAL/i.test(baseName)
    || baseName === 'COUNT_SET'
  );
}

function isHandicapCatalogName(baseName: string): boolean {
  return HANDICAP_CATALOG_NAMES.has(baseName) || /^HANDICAP(?!_3WAY)/i.test(baseName);
}

/** Team-scoped totals (not match total). */
export function resolveTeamTotalsMarketKey(baseName: string): 'totals_home' | 'totals_away' | null {
  if (/^INDIVIDUAL_TOTAL_TEAM1$/i.test(baseName) || /^TEAM_TOTAL_1$/i.test(baseName)) {
    return 'totals_home';
  }
  if (/^INDIVIDUAL_TOTAL_TEAM2$/i.test(baseName) || /^TEAM_TOTAL_2$/i.test(baseName)) {
    return 'totals_away';
  }
  const indMatch = /^INDIVIDUAL_TOTAL_TEAM(\d+)$/i.exec(baseName);
  if (indMatch) {
    const team = Number(indMatch[1]);
    if (team === 1) return 'totals_home';
    if (team === 2) return 'totals_away';
  }
  return null;
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
  if (baseName === 'GOALS_BOTHHALF' || baseName === 'GOALS_BOTH_BOTHHALF') {
    return { marketKey: 'btts', bettable: true };
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
  if (/^HANDICAP_3WAY/i.test(baseName)) {
    return { marketKey: 'handicap_3way', bettable: true };
  }
  if (baseName === 'GOALS_TEAM1') return { marketKey: 'display_GOALS_TEAM1', bettable: true };
  if (baseName === 'GOALS_TEAM2') return { marketKey: 'display_GOALS_TEAM2', bettable: true };
  if (baseName === 'WINNER_YES_NO') return { marketKey: 'display_WINNER_YES_NO', bettable: true };

  return { marketKey: `display_${catalogName}`, bettable: true };
}
