import type { WcGroupedMarkets, WcMarketGroup, WcMarketOutcome } from '../wc-odds/wc-odds-markets.util';

export type OneWinOddItem = {
  cf: number;
  id: string;
  name?: string;
  outcome?: string;
  status: number;
  vars?: { v1?: string; v2?: string };
};

export type OneWinOddsGroup = {
  id: string;
  isBase?: boolean;
  name: string;
  oddsList: OneWinOddItem[];
  renderType?: string;
};

export type OneWinOddsSnapshot = {
  isBaseOddsGroups?: boolean;
  matchId: number;
  oddsGroups: OneWinOddsGroup[];
  updatedAtMs: number;
};

/** status 1 = open for betting on 1win push feed. */
export function isOneWinOddOpen(odd: OneWinOddItem): boolean {
  return odd.status === 1 && Number.isFinite(odd.cf) && odd.cf > 1;
}

function slugKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

function parseMapNumber(groupName: string): number | null {
  const m = groupName.match(/карта\s*(\d+)/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function classifyGroup(groupName: string): {
  category: string;
  marketKey: string;
  mapNumber: null | number;
} {
  const name = groupName.trim();
  const mapNumber = parseMapNumber(name);
  const lower = name.toLowerCase();

  if (
    /^победитель\s*$/i.test(name)
    || /^победитель\s+матча\s*$/i.test(name)
    || /^match\s*winner\s*$/i.test(name)
  ) {
    return { category: 'Основные', marketKey: 'h2h', mapNumber: null };
  }
  if (/карта\s*\d+\.\s*победитель/i.test(name)) {
    return {
      category: `Карта ${mapNumber}`,
      marketKey: `map_${mapNumber}_winner`,
      mapNumber,
    };
  }
  if (/точный\s*счет/i.test(name) && mapNumber == null) {
    return { category: 'Основные', marketKey: 'correct_score', mapNumber: null };
  }
  if (/карта\s*\d+\.\s*точный\s*счет/i.test(name)) {
    return {
      category: `Карта ${mapNumber}`,
      marketKey: `map_${mapNumber}_correct_score`,
      mapNumber,
    };
  }
  if (/тотал/i.test(lower) && /чет|нечет/i.test(lower)) {
    return {
      category: mapNumber ? `Карта ${mapNumber}` : 'Тоталы',
      marketKey: mapNumber ? `map_${mapNumber}_even_odd` : 'even_odd',
      mapNumber,
    };
  }
  if (/индивидуальный\s*тотал/i.test(lower)) {
    return {
      category: mapNumber ? `Карта ${mapNumber}` : 'Тоталы',
      marketKey: mapNumber ? `map_${mapNumber}_team_total` : 'team_total',
      mapNumber,
    };
  }
  if (/тотал/i.test(lower)) {
    return {
      category: mapNumber ? `Карта ${mapNumber}` : 'Тоталы',
      // Keep map scope in the key so settlement can target periodScores[N].
      marketKey: mapNumber ? `map_${mapNumber}_totals` : 'totals',
      mapNumber,
    };
  }
  if (/фора/i.test(lower)) {
    return {
      category: mapNumber ? `Карта ${mapNumber}` : 'Форы',
      marketKey: mapNumber ? `map_${mapNumber}_handicap` : 'handicap',
      mapNumber,
    };
  }

  return {
    category: mapNumber ? `Карта ${mapNumber}` : 'Ещё',
    marketKey: `ow_${slugKey(name)}`,
    mapNumber,
  };
}

/**
 * 1win odd ids look like `12:L:17642683:[1,[],[0],1,0,[]]`.
 * Live deltas sometimes omit `outcome`/`name` — recover the side from the
 * trailing outcome code (`0`=home/`1`, `3`=away/`2`, `6`=even, `7`=odd).
 */
function inferOutcomeFromOneWinId(id: string): string {
  const codeMatch = String(id).match(/,(\d+),\[\]\]$/);
  if (!codeMatch) return '';
  const code = Number(codeMatch[1]);
  if (code === 0) return '1';
  if (code === 3) return '2';
  if (code === 6) return 'even';
  if (code === 7) return 'odd';
  return '';
}

function outcomeKeyFor(
  marketKey: string,
  odd: OneWinOddItem,
  homeTeam: string,
  awayTeam: string,
): string {
  const outcome = (
    (odd.outcome ?? '').toLowerCase() || inferOutcomeFromOneWinId(String(odd.id ?? ''))
  );
  const name = (odd.name ?? '').trim();
  const nameLooksHome =
    Boolean(homeTeam) && name.toLowerCase() === homeTeam.toLowerCase();
  const nameLooksAway =
    Boolean(awayTeam) && name.toLowerCase() === awayTeam.toLowerCase();

  if (marketKey === 'h2h' || /_winner$/.test(marketKey) || /победитель/i.test(marketKey)) {
    if (outcome === '1' || nameLooksHome) return 'HOME';
    if (outcome === '2' || nameLooksAway) return 'AWAY';
    if (outcome === 'x' || /^ничья/i.test(name)) return 'DRAW';
  }

  if (/totals|total/.test(marketKey) && !/oe|team_total|even_odd/.test(marketKey)) {
    const line = odd.vars?.v1 ?? name.match(/([\d.]+)/)?.[1];
    if (outcome === 'over' || /^больше/i.test(name)) return `OVER_${line ?? ''}`;
    if (outcome === 'under' || /^меньше/i.test(name)) return `UNDER_${line ?? ''}`;
  }

  if (/handicap|spreads|фора/.test(marketKey) || /_handicap$|_spreads$/.test(marketKey)) {
    const line = odd.vars?.v1 ?? name.match(/(-?[\d.]+)/)?.[1] ?? '';
    if (outcome === '1' || nameLooksHome) return `HOME_HCP_${line}`;
    if (outcome === '2' || nameLooksAway) return `AWAY_HCP_${line}`;
  }

  if (/even_odd|_oe$|total_oe/.test(marketKey)) {
    if (outcome === 'even' || /^чет/i.test(name)) return 'EVEN';
    if (outcome === 'odd' || /^нечет/i.test(name)) return 'ODD';
  }

  const idTail = String(odd.id ?? '').slice(-8);
  return `OW_${slugKey(name)}_${idTail}`;
}

/** 1win often omits `name` on live deltas — synthesize a stable label for the UI. */
function outcomeDisplayName(
  marketKey: string,
  odd: OneWinOddItem,
  homeTeam: string,
  awayTeam: string,
  outcomeKey: string,
): string {
  const raw = (odd.name ?? '').trim();
  if (raw) return raw;

  if (outcomeKey === 'HOME') return homeTeam || 'П1';
  if (outcomeKey === 'AWAY') return awayTeam || 'П2';
  if (outcomeKey === 'DRAW') return 'Ничья';
  if (outcomeKey === 'EVEN') return 'Четное';
  if (outcomeKey === 'ODD') return 'Нечетное';
  if (outcomeKey === 'YES' || /_YES\b/i.test(outcomeKey)) return 'Да';
  if (outcomeKey === 'NO' || /_NO\b/i.test(outcomeKey)) return 'Нет';

  if (outcomeKey.startsWith('OVER_')) {
    const line = outcomeKey.slice('OVER_'.length);
    return line ? `Больше ${line}` : 'Больше';
  }
  if (outcomeKey.startsWith('UNDER_')) {
    const line = outcomeKey.slice('UNDER_'.length);
    return line ? `Меньше ${line}` : 'Меньше';
  }
  if (outcomeKey.startsWith('HOME_HCP_')) {
    const line = outcomeKey.slice('HOME_HCP_'.length);
    return line ? `${homeTeam || 'П1'} (${line})` : homeTeam || 'П1';
  }
  if (outcomeKey.startsWith('AWAY_HCP_')) {
    const line = outcomeKey.slice('AWAY_HCP_'.length);
    return line ? `${awayTeam || 'П2'} (${line})` : awayTeam || 'П2';
  }
  if (outcomeKey.startsWith('HOME_')) {
    const line = outcomeKey.slice('HOME_'.length);
    return line ? `${homeTeam || 'П1'} ${line}` : homeTeam || 'П1';
  }
  if (outcomeKey.startsWith('AWAY_')) {
    const line = outcomeKey.slice('AWAY_'.length);
    return line ? `${awayTeam || 'П2'} ${line}` : awayTeam || 'П2';
  }

  const outcome = (
    (odd.outcome ?? '').toLowerCase() || inferOutcomeFromOneWinId(String(odd.id ?? ''))
  );
  if (outcome === '1') return homeTeam || 'П1';
  if (outcome === '2') return awayTeam || 'П2';
  if (outcome === 'x') return 'Ничья';
  if (outcome === 'over') return 'Больше';
  if (outcome === 'under') return 'Меньше';
  if (outcome === 'even') return 'Четное';
  if (outcome === 'odd') return 'Нечетное';
  if (outcome === 'yes') return 'Да';
  if (outcome === 'no') return 'Нет';

  return marketKey.replace(/^ow_/, '').replace(/_/g, ' ') || 'Исход';
}

/**
 * Map 1win push odds groups into our WC coupon shape.
 * Starts with the markets we can settle from matchScore/periodsScore;
 * exotic rows are still exposed under "Ещё" for display.
 */
export function mapOneWinOddsToGroupedMarkets(
  groups: OneWinOddsGroup[],
  homeTeam: string,
  awayTeam: string,
): {
  groupedMarkets: WcGroupedMarkets;
  oddsHome: null | number;
  oddsAway: null | number;
  oddsDraw: null | number;
} {
  const grouped: WcGroupedMarkets = {};
  let oddsHome: null | number = null;
  let oddsAway: null | number = null;
  let oddsDraw: null | number = null;

  for (const group of groups) {
    if (!group?.name) continue;
    const { category, marketKey } = classifyGroup(group.name);
    const outcomes: WcMarketOutcome[] = [];

    for (const odd of group.oddsList ?? []) {
      if (!Number.isFinite(odd.cf) || odd.cf <= 1) continue;
      const outcomeKey = outcomeKeyFor(marketKey, odd, homeTeam, awayTeam);
      const point = odd.vars?.v1 != null ? Number(odd.vars.v1) : undefined;
      outcomes.push({
        name: outcomeDisplayName(
          marketKey,
          odd,
          homeTeam,
          awayTeam,
          outcomeKey,
        ),
        outcomeKey,
        point: Number.isFinite(point) ? point : undefined,
        price: odd.cf,
        suspended: !isOneWinOddOpen(odd),
      });

      if (marketKey === 'h2h') {
        // Keep priced match-winner even when 1win suspends between maps —
        // list/UI still needs a number (locked cell), not blank "--".
        if (outcomeKey === 'HOME' && odd.cf > 1) {
          if (isOneWinOddOpen(odd) || oddsHome == null) oddsHome = odd.cf;
        }
        if (outcomeKey === 'AWAY' && odd.cf > 1) {
          if (isOneWinOddOpen(odd) || oddsAway == null) oddsAway = odd.cf;
        }
        if (outcomeKey === 'DRAW' && odd.cf > 1) {
          if (isOneWinOddOpen(odd) || oddsDraw == null) oddsDraw = odd.cf;
        }
      }
    }

    if (outcomes.length === 0) continue;

    // Only expose markets we can settle from matchScore / periodsScore.
    // Exotic / correct-score / team-total rows previously became orphan voids.
    if (
      marketKey.startsWith('ow_')
      || marketKey === 'correct_score'
      || /_correct_score$/i.test(marketKey)
      || /team_total$/i.test(marketKey)
    ) {
      continue;
    }

    const entry: WcMarketGroup = {
      key: `${marketKey}:${group.id}`,
      label: group.name.trim(),
      marketKey,
      outcomes,
    };

    if (!grouped[category]) grouped[category] = [];
    grouped[category].push(entry);
  }

  // No match-level winner book — fall back to the lowest live map winner for list 1/2.
  if (oddsHome == null || oddsAway == null) {
    for (let mapNum = 1; mapNum <= 7; mapNum += 1) {
      const key = `map_${mapNum}_winner`;
      let found = false;
      for (const groupsInCat of Object.values(grouped)) {
        for (const entry of groupsInCat) {
          if (entry.marketKey !== key) continue;
          if (/\(\s*без\s*ОТ\s*\)/i.test(entry.label)) continue;
          let home: null | number = null;
          let away: null | number = null;
          for (const o of entry.outcomes) {
            if (!(o.price > 1)) continue;
            if (o.outcomeKey === 'HOME') home = o.price;
            if (o.outcomeKey === 'AWAY') away = o.price;
          }
          if (home != null && away != null) {
            if (oddsHome == null) oddsHome = home;
            if (oddsAway == null) oddsAway = away;
            found = true;
            break;
          }
        }
        if (found) break;
      }
      if (found) break;
    }
  }

  return { groupedMarkets: grouped, oddsAway, oddsDraw, oddsHome };
}
