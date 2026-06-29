import {
  collectGroupedMarketsWarnings,
  normalizeWcMarketKey,
  type WcGroupedMarkets,
  type WcMarketGroup,
} from './wc-odds-markets.util';

export type WcMarketsSmokeIssue = {
  code: string;
  message: string;
  category?: string;
  groupKey?: string;
};

export type WcMarketsSmokeResult = {
  ok: boolean;
  issues: WcMarketsSmokeIssue[];
  stats: {
    totalsGroups: number;
    handicapGroups: number;
    h2hGroups: number;
    evenOddGroups: number;
  };
};

function groupsInCategory(grouped: WcGroupedMarkets, predicate: (g: WcMarketGroup) => boolean): WcMarketGroup[] {
  const out: WcMarketGroup[] = [];
  for (const groups of Object.values(grouped ?? {})) {
    for (const group of groups) {
      if (predicate(group)) out.push(group);
    }
  }
  return out;
}

function hasOverUnderPair(group: WcMarketGroup): boolean {
  const hasOver = group.outcomes.some((o) => o.outcomeKey.startsWith('OVER'));
  const hasUnder = group.outcomes.some((o) => o.outcomeKey.startsWith('UNDER'));
  return hasOver && hasUnder;
}

function hasNumericLine(group: WcMarketGroup): boolean {
  return group.outcomes.some(
    (o) => o.point != null && Number.isFinite(Number(o.point)),
  );
}

function hasHandicapPair(group: WcMarketGroup): boolean {
  const hasHome = group.outcomes.some((o) => o.outcomeKey.startsWith('HOME_HCP_'));
  const hasAway = group.outcomes.some((o) => o.outcomeKey.startsWith('AWAY_HCP_'));
  if (hasHome && hasAway) return true;
  const names = group.outcomes.map((o) => o.name);
  return names.some((n) => /Ф1\s*\(/i.test(n)) && names.some((n) => /Ф2\s*\(/i.test(n));
}

function hasEvenOddPair(group: WcMarketGroup): boolean {
  const hasEven = group.outcomes.some((o) => o.outcomeKey === 'EVEN' || (/чет/i.test(o.name) && !/нечет/i.test(o.name)));
  const hasOdd = group.outcomes.some((o) => o.outcomeKey === 'ODD' || /нечет/i.test(o.name));
  return hasEven && hasOdd;
}

/** Structural checks used by HTTP smoke tests and ops monitoring. */
export function validateGroupedMarketsForSmoke(grouped: WcGroupedMarkets): WcMarketsSmokeResult {
  const issues: WcMarketsSmokeIssue[] = [];

  const totalsGroups = groupsInCategory(grouped, (g) => normalizeWcMarketKey(g.marketKey) === 'totals');
  const handicapGroups = groupsInCategory(grouped, (g) => normalizeWcMarketKey(g.marketKey) === 'handicap');
  const h2hGroups = groupsInCategory(grouped, (g) => normalizeWcMarketKey(g.marketKey) === 'h2h');
  const evenOddGroups = groupsInCategory(grouped, (g) => normalizeWcMarketKey(g.marketKey) === 'even_odd');

  for (const warning of collectGroupedMarketsWarnings(grouped)) {
    issues.push({
      code: warning.reason,
      message: `Broken totals group in ${warning.category}`,
      category: warning.category,
      groupKey: warning.groupKey,
    });
  }

  if (totalsGroups.length > 0) {
    const validTotals = totalsGroups.filter((g) => hasOverUnderPair(g) && hasNumericLine(g));
    if (!validTotals.length) {
      issues.push({
        code: 'totals_missing_valid_pair',
        message: `Expected at least one totals group with OVER/UNDER and numeric line, got ${totalsGroups.length} totals group(s)`,
        category: 'Тотал',
      });
    }
  }

  if (handicapGroups.length > 0) {
    const validHandicap = handicapGroups.filter(hasHandicapPair);
    if (!validHandicap.length) {
      issues.push({
        code: 'handicap_missing_valid_pair',
        message: `Expected at least one handicap group with F1/F2 or HOME_HCP/AWAY_HCP pair`,
        category: 'Фора',
      });
    }
  }

  if (h2hGroups.length > 0) {
    const threeWay = h2hGroups.filter((g) => g.outcomes.some((o) => o.outcomeKey === 'DRAW'));
    const canonical = h2hGroups.filter((g) =>
      g.outcomes.some((o) => ['HOME', 'DRAW', 'AWAY'].includes(o.outcomeKey)),
    );
    if (canonical.length > 1 && threeWay.length > 0 && canonical.length !== threeWay.length) {
      issues.push({
        code: 'h2h_duplicate_blocks',
        message: `Expected deduplicated 1X2 block, found ${h2hGroups.length} h2h groups (${threeWay.length} with draw)`,
        category: '1X2',
      });
    }

    const mainH2h = h2hGroups.find((g) =>
      g.outcomes.some((o) => o.outcomeKey === 'HOME') && g.outcomes.some((o) => o.outcomeKey === 'AWAY'),
    );
    if (!mainH2h) {
      issues.push({
        code: 'h2h_missing_home_away',
        message: 'No h2h group with HOME and AWAY outcomes',
        category: '1X2',
      });
    }
  }

  for (const group of evenOddGroups) {
    if (!hasEvenOddPair(group)) {
      issues.push({
        code: 'even_odd_missing_pair',
        message: 'Even/odd group without EVEN/ODD pair',
        category: group.label,
        groupKey: group.key,
      });
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    stats: {
      totalsGroups: totalsGroups.length,
      handicapGroups: handicapGroups.length,
      h2hGroups: h2hGroups.length,
      evenOddGroups: evenOddGroups.length,
    },
  };
}
