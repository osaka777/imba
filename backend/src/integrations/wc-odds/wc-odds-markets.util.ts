import {
  isWcBetPlacementBlockedMarket,
  isWcBetPlacementBlockedOutcome,
} from './wc-bet-placement-blocklist.util';

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
  'goals_both_half',
  'goals_both_teams_both_halves',
  'handicap_3way',
]);

export function isTotalsMarketKey(marketKey: string): boolean {
  const normalized = normalizeWcMarketKey(marketKey);
  if (normalized === 'totals' || normalized === 'totals_home' || normalized === 'totals_away') {
    return true;
  }
  return /^map_\d+_totals$/i.test(stripOvertimeMarketSuffix(marketKey));
}

export function stripOvertimeMarketSuffix(marketKey: string): string {
  return marketKey.replace(/_WITH_?OT$/i, '').replace(/_ot$/i, '');
}

export function isOvertimeMarketKey(marketKey: string): boolean {
  return /_ot$/i.test(marketKey) || /WITH_?OT/i.test(marketKey);
}

export function normalizeWcMarketKey(marketKey: string): string {
  const baseKey = stripOvertimeMarketSuffix(marketKey);
  if (BETTABLE_MARKET_KEYS.has(baseKey)) return baseKey;
  if (/HANDICAP_3WAY/i.test(baseKey)) return 'handicap_3way';
  // Keep map_N_* keys intact for scoped settlement; only remap legacy aliases.
  if (baseKey === 'spreads') return 'handicap';
  if (baseKey === 'total_oe') return 'even_odd';
  if (/^map_\d+_spreads$/i.test(baseKey)) {
    return baseKey.replace(/_spreads$/i, '_handicap');
  }
  if (/^map_\d+_total_oe$/i.test(baseKey)) {
    return baseKey.replace(/_total_oe$/i, '_even_odd');
  }
  if (baseKey.startsWith('display_MATCH_WINNER')) return 'h2h';
  if (/^display_GOALS_TEAM1/i.test(baseKey)) return 'btts';
  if (/^display_GOALS_TEAM2/i.test(baseKey)) return 'btts';
  if (baseKey.startsWith('display_DOUBLE_CHANCE')) return 'double_chance';
  if (
    /display_INDIVIDUAL_TOTAL(?:_ASIAN)?_TEAM1/i.test(baseKey)
    || /display_TEAM_TOTAL_1/i.test(baseKey)
  ) {
    return 'totals_home';
  }
  if (
    /display_INDIVIDUAL_TOTAL(?:_ASIAN)?_TEAM2/i.test(baseKey)
    || /display_TEAM_TOTAL_2/i.test(baseKey)
  ) {
    return 'totals_away';
  }
  // Match totals only — not specialty display_TOTAL_GOALS_MINUTES / TOTAL_FOULS_* etc.
  // Team totals (any suffix) must not collapse into match totals.
  if (/display_INDIVIDUAL_TOTAL(?:_ASIAN)?_TEAM\d/i.test(baseKey)) {
    return 'totals';
  }
  if (
    /^display_TOTAL(_ASIAN)?(_HALF)?(_3WAY)?$/i.test(baseKey)
    || /^display_TOTAL_(MAP|ROUNDS|SET|ADD_TIME(_HALF)?)$/i.test(baseKey)
  ) {
    return 'totals';
  }
  if (baseKey.startsWith('display_EVEN_ODD') || /display_EVEN_ODD/i.test(baseKey)) return 'even_odd';
  if (baseKey.startsWith('display_GOALS_BOTH_BOTHHALF')) return 'goals_both_teams_both_halves';
  if (baseKey.startsWith('display_GOALS_BOTHHALF')) return 'goals_both_half';
  if (baseKey.startsWith('display_GOALS_BOTH_HALF')) return 'goals_both_half';
  if (baseKey === 'display_GOALS_BOTH' || baseKey.startsWith('display_GOALS_BOTH_')) {
    if (/GOALS_BOTH_MIN/i.test(baseKey)) return 'goals_both_min';
    return 'btts';
  }
  if (baseKey.startsWith('display_HANDICAP')) return 'handicap';
  return baseKey;
}

/** True for map-scoped winner books we settle from periodScores. */
export function isMapWinnerMarketKey(marketKey: string): boolean {
  return /^map_\d+_winner$/i.test(stripOvertimeMarketSuffix(marketKey));
}

export function parseMapWinnerNumber(marketKey: string): number | null {
  const m = stripOvertimeMarketSuffix(marketKey).match(/^map_(\d+)_winner$/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function isWcBettableMarketKey(marketKey: string): boolean {
  if (!marketKey) return false;
  if (BETTABLE_MARKET_KEYS.has(marketKey)) return true;
  if (isMapWinnerMarketKey(marketKey)) return true;
  if (/^map_\d+_(totals|handicap|spreads|even_odd|total_oe)$/i.test(marketKey)) {
    return true;
  }
  if (marketKey === 'spreads' || marketKey === 'total_oe') return true;
  const normalized = normalizeWcMarketKey(marketKey);
  return (
    BETTABLE_MARKET_KEYS.has(normalized)
    || isMapWinnerMarketKey(normalized)
    || /^map_\d+_(totals|handicap|even_odd)$/i.test(normalized)
  );
}

const CANONICAL_OUTCOME_PREFIXES = ['OVER_', 'UNDER_', 'HOME', 'AWAY', 'DRAW', 'DC_', 'YES', 'NO', 'EVEN', 'ODD'];

/** Whether a WC coupon may be placed for this market/outcome pair. */
export function isWcBetPlacementAllowed(
  marketKey: string,
  outcomeKey?: string | null,
): boolean {
  if (isWcBetPlacementBlockedMarket(marketKey)) return false;
  if (isWcBetPlacementBlockedOutcome(marketKey, outcomeKey)) return false;
  if (isWcBettableMarketKey(marketKey)) return true;
  if (!marketKey.startsWith('display_') || !outcomeKey) return false;
  if (outcomeKey.startsWith('DISPLAY_')) return true;
  const normalized = normalizeWcMarketKey(marketKey);
  if (!BETTABLE_MARKET_KEYS.has(normalized)) return false;
  return CANONICAL_OUTCOME_PREFIXES.some((prefix) => outcomeKey.startsWith(prefix) || outcomeKey === prefix);
}

/** Main match-goal totals only — never halves / corners / team / asian buckets. */
const MAIN_TOTAL_CATEGORIES = new Set([
  'Тотал',
  'Тотал (с ОТ)',
  'Total',
  'Total (incl. OT)',
]);

const NON_MAIN_TOTAL_SCOPE_RE =
  /тайм|половин|сет|карта|четверть|период|угл|фол|карт|азиат|3\s*исход|индивид|half|quarter|period|set\b|map\b|corner|card|asian|3-?way|individual|team\s*total/i;

export type WcLineMarketExtras = {
  marketsCount: number;
  odds1X: number | null;
  odds12: number | null;
  oddsX2: number | null;
};

function readTotalsOverUnder(group: WcMarketGroup): {
  over: WcMarketOutcome | undefined;
  under: WcMarketOutcome | undefined;
} {
  const under = group.outcomes.find((outcome) =>
    outcome.outcomeKey.startsWith('UNDER'),
  ) ?? group.outcomes.find((outcome) => isLikelyUnderOutcome(outcome));
  const over = group.outcomes.find((outcome) =>
    outcome.outcomeKey.startsWith('OVER'),
  ) ?? group.outcomes.find((outcome) => isLikelyOverOutcome(outcome));
  return { over, under };
}

/** Whether this group is the main match total (Olimpbet TOTAL), not a scoped/stat total. */
export function isMainMatchTotalsGroup(category: string, group: WcMarketGroup): boolean {
  if (normalizeWcMarketKey(group.marketKey) !== 'totals') return false;
  if (group.outcomes.length < 2) return false;
  if (!MAIN_TOTAL_CATEGORIES.has(category)) return false;
  const scopeText = `${category} ${group.label}`;
  if (NON_MAIN_TOTAL_SCOPE_RE.test(scopeText)) return false;
  const { over, under } = readTotalsOverUnder(group);
  return over != null && under != null && over.point != null && under.point != null;
}

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

  for (const [category, items] of Object.entries(grouped ?? {})) {
    for (const group of items) {
      if (isMainMatchTotalsGroup(category, group)) {
        totalsGroups.push(group);
      }
    }
  }

  if (!totalsGroups.length) {
    return { totalLine: null, oddsOver: null, oddsUnder: null };
  }

  // Prefer the most balanced OVER/UNDER pair — matches Olimpbet list main total
  // (e.g. ТБ 2 / ТМ 2), not a hardcoded 2.5 from any totals* market.
  let preferred = totalsGroups[0]!;
  let bestBalance = Number.POSITIVE_INFINITY;
  for (const group of totalsGroups) {
    const { over, under } = readTotalsOverUnder(group);
    if (!over || !under || !(over.price > 1) || !(under.price > 1)) continue;
    const balance = Math.abs(Math.log(over.price) - Math.log(under.price));
    if (balance < bestBalance) {
      bestBalance = balance;
      preferred = group;
    }
  }

  const { over, under } = readTotalsOverUnder(preferred);
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

/**
 * Merge a full Olimpbet snapshot with cached markets.
 * Structure/labels come from `full` (handles renamed categories).
 * Prices always prefer `full` — cached prices must not overwrite a fresher feed
 * (that caused live odds to flash between old and new values).
 * Outcomes present only in cache are kept when the group still exists in full.
 */
export function mergeFullGroupedMarketsPreservingOdds(
  full: WcGroupedMarkets,
  cached: WcGroupedMarkets,
): WcGroupedMarkets {
  if (!cached || Object.keys(cached).length === 0) return finalizeGroupedMarkets(full);

  const cachedByGroupKey = new Map<string, WcMarketGroup>();
  for (const groups of Object.values(cached)) {
    for (const group of groups) {
      cachedByGroupKey.set(group.key, group);
    }
  }

  const next: WcGroupedMarkets = {};
  for (const [category, groups] of Object.entries(full)) {
    next[category] = groups.map((group) => {
      const cachedGroup = cachedByGroupKey.get(group.key);
      if (!cachedGroup) return group;

      const fullOutcomeKeys = new Set(group.outcomes.map((outcome) => outcome.outcomeKey));
      const cachedOnlyOutcomes = cachedGroup.outcomes.filter(
        (outcome) => !fullOutcomeKeys.has(outcome.outcomeKey),
      );

      return {
        ...group,
        // Full snapshot prices win; keep any cache-only outcomes on the same group.
        outcomes: [...group.outcomes, ...cachedOnlyOutcomes],
      };
    });
  }

  return finalizeGroupedMarkets(next);
}

/** Mark every cached outcome suspended when the Olimpbet feed closed trading. */
export function markGroupedMarketsSuspended(grouped: WcGroupedMarkets): WcGroupedMarkets {
  const next: WcGroupedMarkets = {};
  for (const [category, groups] of Object.entries(grouped)) {
    next[category] = groups.map((group) => ({
      ...group,
      outcomes: group.outcomes.map((outcome) => ({ ...outcome, suspended: true })),
    }));
  }
  return next;
}

type ListScalarOdds = {
  oddsHome?: number | null;
  oddsDraw?: number | null;
  oddsAway?: number | null;
  oddsOver?: number | null;
  oddsUnder?: number | null;
  totalLine?: number | null;
  odds1X?: number | null;
  odds12?: number | null;
  oddsX2?: number | null;
};

function patchOutcomePrice(
  outcomes: WcMarketOutcome[],
  outcomeKey: string,
  price: number | null | undefined,
): WcMarketOutcome[] {
  if (price == null || !Number.isFinite(price) || price <= 1) return outcomes;
  let changed = false;
  const next = outcomes.map((outcome) => {
    if (outcome.outcomeKey !== outcomeKey || outcome.price === price) return outcome;
    changed = true;
    return { ...outcome, price };
  });
  return changed ? next : outcomes;
}

/**
 * Apply fresher list-card scalars onto a stale detail `groupedMarkets` blob.
 * Covers main 1X2 / DC / totals only — full refresh still needed for the rest.
 */
export function patchGroupedMarketsFromListScalars(
  grouped: WcGroupedMarkets,
  list: ListScalarOdds,
): WcGroupedMarkets {
  if (!grouped || Object.keys(grouped).length === 0) return grouped;

  let changed = false;
  const next: WcGroupedMarkets = {};

  for (const [category, groups] of Object.entries(grouped)) {
    next[category] = groups.map((group) => {
      const mk = normalizeWcMarketKey(group.marketKey);
      let outcomes = group.outcomes;

      if (mk === 'h2h') {
        const before = outcomes;
        outcomes = patchOutcomePrice(outcomes, 'HOME', list.oddsHome);
        outcomes = patchOutcomePrice(outcomes, 'DRAW', list.oddsDraw);
        outcomes = patchOutcomePrice(outcomes, 'AWAY', list.oddsAway);
        if (outcomes !== before) changed = true;
      } else if (mk === 'double_chance' || mk === 'dc') {
        const before = outcomes;
        outcomes = patchOutcomePrice(outcomes, '1X', list.odds1X);
        outcomes = patchOutcomePrice(outcomes, '12', list.odds12);
        outcomes = patchOutcomePrice(outcomes, 'X2', list.oddsX2);
        if (outcomes !== before) changed = true;
      } else if (
        mk === 'totals'
        && list.totalLine != null
        && isMainMatchTotalsGroup(category, group)
      ) {
        const line = String(list.totalLine);
        const before = outcomes;
        let patched = outcomes;
        for (const outcome of outcomes) {
          if (outcome.point == null || String(outcome.point) !== line) continue;
          if (outcome.outcomeKey.startsWith('OVER') && list.oddsOver != null) {
            patched = patchOutcomePrice(patched, outcome.outcomeKey, list.oddsOver);
          } else if (outcome.outcomeKey.startsWith('UNDER') && list.oddsUnder != null) {
            patched = patchOutcomePrice(patched, outcome.outcomeKey, list.oddsUnder);
          }
        }
        outcomes = patched;
        if (outcomes !== before) changed = true;
      }

      return outcomes === group.outcomes ? group : { ...group, outcomes };
    });
  }

  return changed ? next : grouped;
}

/** Patch prices from a partial (main-event) snapshot without dropping linked-only categories. */
export function patchGroupedMarketsOdds(
  prev: WcGroupedMarkets,
  incoming: WcGroupedMarkets,
): WcGroupedMarkets {
  if (!prev || Object.keys(prev).length === 0) return incoming;
  if (!incoming || Object.keys(incoming).length === 0) return prev;

  const next: WcGroupedMarkets = { ...prev };

  for (const [category, groups] of Object.entries(incoming)) {
    const prevGroups = prev[category] ?? [];
    const byKey = new Map(prevGroups.map((group) => [group.key, group]));

    for (const group of groups) {
      const existing = byKey.get(group.key);
      if (!existing) {
        byKey.set(group.key, group);
        continue;
      }

      byKey.set(group.key, {
        ...existing,
        ...group,
        outcomes: group.outcomes,
      });
    }

    next[category] = [...byKey.values()];
  }

  return next;
}
