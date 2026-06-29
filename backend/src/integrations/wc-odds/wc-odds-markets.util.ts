export type WcMarketOutcome = {
  name: string;
  price: number;
  point?: number;
  outcomeKey: string;
  suspended?: boolean;
};

export type WcMarketGroup = {
  key: string;
  marketKey: string;
  label: string;
  outcomes: WcMarketOutcome[];
};

export type WcGroupedMarkets = Record<string, WcMarketGroup[]>;

export function findOutcomeOdds(
  grouped: WcGroupedMarkets,
  marketKey: string,
  outcomeKey: string,
  line?: string | null,
  groupKey?: string | null,
): number | null {
  if (groupKey) {
    for (const items of Object.values(grouped)) {
      const group = items.find((g) => g.key === groupKey);
      if (!group) continue;
      const hit = group.outcomes.find((o) => {
        if (o.outcomeKey !== outcomeKey) return false;
        const normalized = normalizeWcMarketKey(marketKey);
        if (isTotalsMarketKey(normalized) && line != null) {
          return String(o.point) === String(line);
        }
        return true;
      });
      if (hit) return hit.price;
    }
  }

  const normalized = normalizeWcMarketKey(marketKey);

  for (const items of Object.values(grouped)) {
    for (const group of items) {
      const groupKey = normalizeWcMarketKey(group.marketKey);
      if (groupKey !== normalized && group.marketKey !== marketKey) continue;
      const hit = group.outcomes.find((o) => {
        if (o.outcomeKey !== outcomeKey) return false;
        if (isTotalsMarketKey(normalized) && line != null) {
          return String(o.point) === String(line);
        }
        return true;
      });
      if (hit) return hit.price;
    }
  }

  for (const items of Object.values(grouped)) {
    for (const group of items) {
      const hit = group.outcomes.find((o) => o.outcomeKey === outcomeKey);
      if (hit) return hit.price;
    }
  }

  return null;
}

export function findMarketGroup(
  grouped: WcGroupedMarkets,
  marketKey: string,
  outcomeKey: string,
  line?: string | null,
  groupKey?: string | null,
): WcMarketGroup | null {
  if (groupKey) {
    for (const items of Object.values(grouped)) {
      const group = items.find((g) => g.key === groupKey);
      if (!group) continue;
      const hit = group.outcomes.find((o) => {
        if (o.outcomeKey !== outcomeKey) return false;
        const normalized = normalizeWcMarketKey(marketKey);
        if (isTotalsMarketKey(normalized) && line != null) {
          return String(o.point) === String(line);
        }
        return true;
      });
      if (hit) return group;
    }
  }

  const normalized = normalizeWcMarketKey(marketKey);

  for (const items of Object.values(grouped)) {
    for (const group of items) {
      const groupMarketKey = normalizeWcMarketKey(group.marketKey);
      if (groupMarketKey !== normalized && group.marketKey !== marketKey) continue;
      const hit = group.outcomes.find((o) => {
        if (o.outcomeKey !== outcomeKey) return false;
        if (isTotalsMarketKey(normalized) && line != null) {
          return String(o.point) === String(line);
        }
        return true;
      });
      if (hit) return group;
    }
  }

  return null;
}

export function findMarketOutcome(
  grouped: WcGroupedMarkets,
  marketKey: string,
  outcomeKey: string,
  line?: string | null,
  groupKey?: string | null,
): WcMarketOutcome | null {
  if (groupKey) {
    for (const items of Object.values(grouped)) {
      const group = items.find((g) => g.key === groupKey);
      if (!group) continue;
      const hit = group.outcomes.find((o) => {
        if (o.outcomeKey !== outcomeKey) return false;
        const normalized = normalizeWcMarketKey(marketKey);
        if (isTotalsMarketKey(normalized) && line != null) {
          return String(o.point) === String(line);
        }
        return true;
      });
      if (hit) return hit;
    }
  }

  const normalized = normalizeWcMarketKey(marketKey);

  for (const items of Object.values(grouped)) {
    for (const group of items) {
      const groupKey = normalizeWcMarketKey(group.marketKey);
      if (groupKey !== normalized && group.marketKey !== marketKey) continue;
      const hit = group.outcomes.find((o) => {
        if (o.outcomeKey !== outcomeKey) return false;
        if (isTotalsMarketKey(normalized) && line != null) {
          return String(o.point) === String(line);
        }
        return true;
      });
      if (hit) return hit;
    }
  }

  return null;
}

export function outcomeKeyToPick(outcomeKey: string): 'HOME' | 'DRAW' | 'AWAY' | null {
  if (outcomeKey === 'HOME') return 'HOME';
  if (outcomeKey === 'DRAW') return 'DRAW';
  if (outcomeKey === 'AWAY') return 'AWAY';
  return null;
}

const BETTABLE_MARKET_KEYS = new Set([
  'h2h',
  'totals',
  'totals_home',
  'totals_away',
  'even_odd',
  'btts',
  'double_chance',
  'handicap',
  'goals_both_min',
  'handicap_3way',
]);

export function isTotalsMarketKey(marketKey: string): boolean {
  const normalized = normalizeWcMarketKey(marketKey);
  return normalized === 'totals' || normalized === 'totals_home' || normalized === 'totals_away';
}

export function stripOvertimeMarketSuffix(marketKey: string): string {
  return marketKey.replace(/_ot$/i, '');
}

export function isOvertimeMarketKey(marketKey: string): boolean {
  return /_ot$/i.test(marketKey) || /WITH_?OT/i.test(marketKey);
}

export function normalizeWcMarketKey(marketKey: string): string {
  const baseKey = stripOvertimeMarketSuffix(marketKey);
  if (BETTABLE_MARKET_KEYS.has(baseKey)) return baseKey;
  if (/HANDICAP_3WAY/i.test(baseKey)) return 'handicap_3way';
  if (baseKey.startsWith('display_MATCH_WINNER')) return 'h2h';
  if (/^display_GOALS_TEAM1/i.test(baseKey)) return 'btts';
  if (/^display_GOALS_TEAM2/i.test(baseKey)) return 'btts';
  if (baseKey.startsWith('display_DOUBLE_CHANCE')) return 'double_chance';
  if (/display_INDIVIDUAL_TOTAL_TEAM1/i.test(baseKey) || /display_TEAM_TOTAL_1/i.test(baseKey)) {
    return 'totals_home';
  }
  if (/display_INDIVIDUAL_TOTAL_TEAM2/i.test(baseKey) || /display_TEAM_TOTAL_2/i.test(baseKey)) {
    return 'totals_away';
  }
  if (baseKey.startsWith('display_TOTAL') || /display_INDIVIDUAL_TOTAL/i.test(baseKey)) return 'totals';
  if (baseKey.startsWith('display_EVEN_ODD') || /display_EVEN_ODD/i.test(baseKey)) return 'even_odd';
  if (baseKey === 'display_GOALS_BOTH' || baseKey.startsWith('display_GOALS_BOTH_')) {
    if (/GOALS_BOTH_MIN/i.test(baseKey)) return 'goals_both_min';
    return 'btts';
  }
  if (baseKey.startsWith('display_GOALS_BOTHHALF')) return 'btts';
  if (baseKey.startsWith('display_HANDICAP')) return 'handicap';
  return baseKey;
}

export function isWcBettableMarketKey(marketKey: string): boolean {
  if (!marketKey) return false;
  if (BETTABLE_MARKET_KEYS.has(marketKey)) return true;
  const normalized = normalizeWcMarketKey(marketKey);
  return BETTABLE_MARKET_KEYS.has(normalized);
}

const CANONICAL_OUTCOME_PREFIXES = ['OVER_', 'UNDER_', 'HOME', 'AWAY', 'DRAW', 'DC_', 'YES', 'NO', 'EVEN', 'ODD'];

/** Whether a WC coupon may be placed for this market/outcome pair. */
export function isWcBetPlacementAllowed(
  marketKey: string,
  outcomeKey?: string | null,
): boolean {
  if (isWcBettableMarketKey(marketKey)) return true;
  if (!marketKey.startsWith('display_') || !outcomeKey) return false;
  if (outcomeKey.startsWith('DISPLAY_')) return true;
  const normalized = normalizeWcMarketKey(marketKey);
  if (!BETTABLE_MARKET_KEYS.has(normalized)) return false;
  return CANONICAL_OUTCOME_PREFIXES.some((prefix) => outcomeKey.startsWith(prefix) || outcomeKey === prefix);
}

const PREFERRED_TOTAL_LINE = 2.5;

export type WcLineMarketExtras = {
  marketsCount: number;
  odds1X: number | null;
  odds12: number | null;
  oddsX2: number | null;
};

function isLikelyUnderOutcome(outcome: WcMarketOutcome): boolean {
  if (outcome.outcomeKey.startsWith('UNDER')) return true;
  const name = outcome.name.trim();
  if (/^тм$/i.test(name) || /^м$/i.test(name) || /меньше/i.test(name)) return true;
  return /under/i.test(outcome.outcomeKey);
}

function isLikelyOverOutcome(outcome: WcMarketOutcome): boolean {
  if (outcome.outcomeKey.startsWith('OVER')) return true;
  const name = outcome.name.trim();
  if (/^тб$/i.test(name) || /^б$/i.test(name) || /больше/i.test(name)) return true;
  return /over/i.test(outcome.outcomeKey);
}

export function countWcMarketOutcomes(grouped: WcGroupedMarkets): number {
  let count = 0;
  for (const groups of Object.values(grouped ?? {})) {
    for (const group of groups) {
      const hasOpenOutcome = group.outcomes.some(
        (outcome) => !outcome.suspended && Number.isFinite(outcome.price) && outcome.price > 1,
      );
      if (hasOpenOutcome) count += 1;
    }
  }
  return count;
}

function normalizeDcLabel(name: string): string {
  return name.replace(/\s/g, '').toUpperCase().replace(/Х/g, 'X');
}

function isMainDoubleChanceGroup(group: WcMarketGroup): boolean {
  const isDoubleChance =
    group.marketKey === 'double_chance'
    || group.marketKey.includes('DOUBLE_CHANCE')
    || group.label.toLowerCase().includes('двойной шанс');
  if (!isDoubleChance) return false;
  return !/тайм|пол\./i.test(group.label);
}

export function extractDoubleChanceOdds(grouped: WcGroupedMarkets): {
  odds1X: number | null;
  odds12: number | null;
  oddsX2: number | null;
} {
  let odds1X: number | null = null;
  let odds12: number | null = null;
  let oddsX2: number | null = null;

  for (const groups of Object.values(grouped ?? {})) {
    for (const group of groups) {
      if (!isMainDoubleChanceGroup(group)) continue;

      for (const outcome of group.outcomes) {
        const label = normalizeDcLabel(outcome.name);
        const key = outcome.outcomeKey;
        if (key === 'DC_1X' || label === '1X' || label.endsWith('1X')) odds1X = outcome.price;
        else if (key === 'DC_12' || label === '12') odds12 = outcome.price;
        else if (key === 'DC_X2' || label === 'X2' || label.endsWith('X2')) oddsX2 = outcome.price;
      }
    }
  }

  return { odds1X, odds12, oddsX2 };
}

export function buildWcLineExtras(grouped: WcGroupedMarkets): WcLineMarketExtras {
  const dc = extractDoubleChanceOdds(grouped);
  return {
    marketsCount: countWcMarketOutcomes(grouped),
    ...dc,
  };
}

export function extractMainTotalLine(grouped: WcGroupedMarkets): {
  totalLine: number | null;
  oddsOver: number | null;
  oddsUnder: number | null;
} {
  const totalsGroups: WcMarketGroup[] = [];

  for (const items of Object.values(grouped)) {
    for (const group of items) {
      if (group.marketKey === 'totals' && group.outcomes.length >= 2) {
        totalsGroups.push(group);
      }
    }
  }

  if (!totalsGroups.length) {
    return { totalLine: null, oddsOver: null, oddsUnder: null };
  }

  const preferred =
    totalsGroups.find((group) =>
      group.outcomes.some((outcome) => outcome.point === PREFERRED_TOTAL_LINE),
    ) ?? totalsGroups[0];

  const under = preferred.outcomes.find((outcome) =>
    outcome.outcomeKey.startsWith('UNDER'),
  ) ?? preferred.outcomes.find((outcome) => isLikelyUnderOutcome(outcome));
  const over = preferred.outcomes.find((outcome) =>
    outcome.outcomeKey.startsWith('OVER'),
  ) ?? preferred.outcomes.find((outcome) => isLikelyOverOutcome(outcome));
  const line = under?.point ?? over?.point ?? null;

  return {
    totalLine: line != null ? Number(line) : null,
    oddsOver: over?.price ?? null,
    oddsUnder: under?.price ?? null,
  };
}

export type WcGroupedMarketsWarning = {
  eventId?: string;
  category: string;
  groupKey: string;
  marketKey: string;
  reason: string;
};

/** Detect totals groups that cannot be rendered or settled as over/under pairs. */
export function collectGroupedMarketsWarnings(
  grouped: WcGroupedMarkets,
  eventId?: string,
): WcGroupedMarketsWarning[] {
  const warnings: WcGroupedMarketsWarning[] = [];

  for (const [category, groups] of Object.entries(grouped ?? {})) {
    for (const group of groups) {
      const normalized = normalizeWcMarketKey(group.marketKey);
      if (!isTotalsMarketKey(normalized) || group.outcomes.length < 2) continue;

      const hasOverUnder = group.outcomes.some((o) =>
        o.outcomeKey.startsWith('OVER') || o.outcomeKey.startsWith('UNDER'),
      );
      if (hasOverUnder) continue;

      warnings.push({
        eventId,
        category,
        groupKey: group.key,
        marketKey: group.marketKey,
        reason: 'totals_group_missing_over_under_keys',
      });
    }
  }

  return warnings;
}

function dedupeMainH2hGroups(grouped: WcGroupedMarkets): WcGroupedMarkets {
  const h2h = grouped['1X2'];
  if (!h2h || h2h.length < 2) return grouped;

  const threeWay = h2h.filter((group) =>
    group.outcomes.some((outcome) => outcome.outcomeKey === 'DRAW'),
  );
  if (!threeWay.length) return grouped;

  return { ...grouped, '1X2': threeWay };
}

function semanticGroupSignature(group: WcMarketGroup): string {
  const outcomes = group.outcomes
    .map((outcome) => `${outcome.outcomeKey}:${outcome.name}`)
    .sort()
    .join('|');
  return `${group.marketKey}::${group.label}::${outcomes}`;
}

/** Drop byte-identical groups (Olimpbet may repeat the same market block twice). */
function dedupeIdenticalMarketGroups(grouped: WcGroupedMarkets): WcGroupedMarkets {
  const result: WcGroupedMarkets = {};

  for (const [category, groups] of Object.entries(grouped)) {
    const seen = new Set<string>();
    const unique: WcMarketGroup[] = [];

    for (const group of groups) {
      const sig = semanticGroupSignature(group);
      if (seen.has(sig)) continue;
      seen.add(sig);
      unique.push(group);
    }

    result[category] = unique;
  }

  return result;
}

export function finalizeGroupedMarkets(grouped: WcGroupedMarkets): WcGroupedMarkets {
  return dedupeIdenticalMarketGroups(dedupeMainH2hGroups(grouped));
}
