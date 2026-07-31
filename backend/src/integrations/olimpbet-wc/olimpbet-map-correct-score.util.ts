import type { WcGroupedMarkets, WcMarketGroup } from '../wc-odds/wc-odds-markets.util';

/**
 * CS2 / Valorant-style map correct score.
 *
 * A map can never end in a draw, and can't be won before 13 rounds. The only
 * scores that are structurally impossible are the two "would-have-gone-to-OT"
 * caps (13:12 and 16:15). Everything else (regulation, Valorant OT 14:12/15:13,
 * CS2 OT 16:12–16:14, double-OT 19:15–19:17, …) is a legitimate final, so we
 * stay permissive rather than encoding per-title OT rules we can't detect here.
 */
export function isValidEsportsMapCorrectScore(home: number, away: number): boolean {
  if (!Number.isFinite(home) || !Number.isFinite(away)) return false;
  if (home < 0 || away < 0) return false;
  if (home === away) return false; // maps do not end in a draw

  const winner = Math.max(home, away);
  const loser = Math.min(home, away);

  if (winner < 13) return false; // a map isn't won before 13
  if (winner === 13 && loser === 12) return false; // 12-12 forces OT, 13:12 impossible
  if (winner === 16 && loser === 15) return false; // 15-15 forces OT, 16:15 impossible

  return true;
}

export function parseScorePairLabel(name: string): { home: number; away: number } | null {
  const match = name.trim().match(/^(\d+):(\d+)$/);
  if (!match) return null;
  return { home: Number(match[1]), away: Number(match[2]) };
}

export function isMapCorrectScoreMarketKey(marketKey: string): boolean {
  return /SCORE_MAP/i.test(marketKey);
}

export function isMapCorrectScoreCategoryName(categoryName: string): boolean {
  return /сч[её]т\s+в\s+\d/i.test(categoryName.trim());
}

/**
 * Olimpbet often stubs unpriced lines at a single coefficient (commonly 10.00).
 * Hide the whole book when one price dominates.
 *
 * Live CS map-score books frequently land at ~75% × 10.00 (18/24), so the
 * default dominance is 0.7. Known stub price 10.00 is detected earlier (55%).
 */
export function isFlatPlaceholderOddsBook(
  prices: number[],
  options?: { minOutcomes?: number; dominance?: number },
): boolean {
  const minOutcomes = options?.minOutcomes ?? 8;
  const dominance = options?.dominance ?? 0.7;
  if (prices.length < minOutcomes) return false;

  const counts = new Map<number, number>();
  for (const price of prices) {
    const key = Math.round(price * 100) / 100;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  let maxCount = 0;
  let mode = 0;
  for (const [key, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      mode = key;
    }
  }
  const ratio = maxCount / prices.length;

  // Olimpbet's classic unpriced stub coefficient.
  if (mode === 10 && prices.length >= 8 && ratio >= 0.55) return true;

  return ratio >= dominance;
}

/** Drop individual 10.00 stub outcomes from a multi-way book that still has real prices. */
export function stripStubTenOutcomes<T extends { price: number }>(
  outcomes: T[],
  options?: { minStubs?: number },
): T[] {
  const minStubs = options?.minStubs ?? 3;
  if (outcomes.length < 6) return outcomes;
  const stubs = outcomes.filter((o) => Math.round(o.price * 100) / 100 === 10);
  if (stubs.length < minStubs) return outcomes;
  // Only strip when stubs are a minority-or-majority chunk but not the entire book
  // (entire-book case is handled by isFlatPlaceholderOddsBook).
  if (stubs.length === outcomes.length) return outcomes;
  const kept = outcomes.filter((o) => Math.round(o.price * 100) / 100 !== 10);
  return kept.length >= 2 ? kept : outcomes;
}

function sanitizeMapCorrectScoreGroup(group: WcMarketGroup): WcMarketGroup | null {
  if (!isMapCorrectScoreMarketKey(group.marketKey)) return group;

  const valid = group.outcomes.filter((outcome) => {
    const score = parseScorePairLabel(outcome.name);
    if (!score) return false;
    return isValidEsportsMapCorrectScore(score.home, score.away);
  });

  // If the feed mostly stubbed this book at 10.00, hide it entirely — keeping only
  // the minority "priced" longshots leaves a confusing half-empty score grid.
  if (isFlatPlaceholderOddsBook(valid.map((o) => o.price))) return null;

  const outcomes = stripStubTenOutcomes(valid);
  if (!outcomes.length) return null;
  return { ...group, outcomes };
}

/**
 * Drop junk / placeholder SCORE_MAP books from a grouped markets blob.
 * Safe to run on live + cached payloads.
 */
export function stripPlaceholderMapCorrectScoreMarkets(
  grouped: WcGroupedMarkets,
): WcGroupedMarkets {
  const out: WcGroupedMarkets = {};

  for (const [category, groups] of Object.entries(grouped)) {
    const sanitized: WcMarketGroup[] = [];
    for (const group of groups) {
      const next = sanitizeMapCorrectScoreGroup(group);
      if (next) sanitized.push(next);
    }

    const isMapScoreCategory =
      isMapCorrectScoreCategoryName(category)
      || sanitized.some((group) => isMapCorrectScoreMarketKey(group.marketKey));

    if (isMapScoreCategory) {
      const prices = sanitized.flatMap((group) => group.outcomes.map((o) => o.price));
      if (isFlatPlaceholderOddsBook(prices)) continue;
      if (!sanitized.some((group) => isMapCorrectScoreMarketKey(group.marketKey))) {
        // Category was map-score titled but all SCORE_MAP groups were dropped
        if (sanitized.length === 0) continue;
      }
    }

    if (sanitized.length > 0) out[category] = sanitized;
  }

  return out;
}

/**
 * Esports feeds occasionally publish an entire market book stubbed at one
 * coefficient (commonly 10.00) before it is priced. This is the same failure
 * that flattened SCORE_MAP, but it can hit any high-outcome esports book
 * (тотал раундов, индивидуальный тотал, разница раундов, гонка по убийствам…).
 * Drop such categories wholesale. Only applied to esports events, and only when
 * a category is large enough that a dominant single price is unambiguous junk.
 */
export function stripFlatPlaceholderEsportsMarkets(
  grouped: WcGroupedMarkets,
): WcGroupedMarkets {
  const out: WcGroupedMarkets = {};

  for (const [category, groups] of Object.entries(grouped)) {
    const cleanedGroups: WcMarketGroup[] = [];
    for (const group of groups) {
      // Strip stub-10 outcomes from high-way esports specialty books (margin, race…).
      if (
        /SCORE_MAP|ROUNDS_WINNIGMARGIN|RACE_TO_|WINNER_PISTOL|TOTAL_KILL|TOTAL_MAP/i.test(
          group.marketKey,
        )
      ) {
        const outcomes = stripStubTenOutcomes(group.outcomes);
        if (outcomes.length < 2) continue;
        cleanedGroups.push(outcomes === group.outcomes ? group : { ...group, outcomes });
      } else {
        cleanedGroups.push(group);
      }
    }

    const prices = cleanedGroups.flatMap((group) => group.outcomes.map((o) => o.price));
    if (isFlatPlaceholderOddsBook(prices)) continue;
    if (cleanedGroups.length > 0) out[category] = cleanedGroups;
  }

  return out;
}
