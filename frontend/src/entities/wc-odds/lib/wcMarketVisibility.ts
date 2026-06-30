import type { WcMarketGroup, WcMarketOutcome } from "~/entities/wc-odds/api/client";

import { isWcMarketBettable } from "./wcRate";

export function isWcOutcomeDisplayable(
  outcome: WcMarketOutcome | undefined,
  marketKey: string,
): boolean {
  if (!outcome) return false;
  if (!isWcMarketBettable(marketKey, outcome.outcomeKey)) return false;
  return Number.isFinite(outcome.price) && outcome.price > 1;
}

export function isWcOutcomeOffered(
  outcome: WcMarketOutcome | undefined,
  marketKey: string,
  bettingOpen: boolean,
): boolean {
  if (!outcome) return false;
  if (!bettingOpen) return false;
  if (!isWcMarketBettable(marketKey, outcome.outcomeKey)) return false;
  if (outcome.suspended) return false;
  if (!Number.isFinite(outcome.price) || outcome.price <= 1) return false;
  return true;
}

export function isWcPairOffered(
  left: WcMarketOutcome | undefined,
  right: WcMarketOutcome | undefined,
  marketKey: string,
  bettingOpen: boolean,
): boolean {
  return (
    isWcOutcomeOffered(left, marketKey, bettingOpen)
    || isWcOutcomeOffered(right, marketKey, bettingOpen)
  );
}

export function isWcAnyOffered(
  outcomes: Array<WcMarketOutcome | undefined>,
  marketKey: string,
  bettingOpen: boolean,
): boolean {
  return outcomes.some((outcome) => isWcOutcomeOffered(outcome, marketKey, bettingOpen));
}

export function isWcGroupOffered(group: WcMarketGroup, bettingOpen: boolean): boolean {
  return group.outcomes.some((outcome) => isWcOutcomeOffered(outcome, group.marketKey, bettingOpen));
}

/** Keep groups visible with locks when the feed closed — hide only empty/unpriced markets. */
export function filterDisplayableGroups(groups: WcMarketGroup[]): WcMarketGroup[] {
  return groups.filter((group) =>
    group.outcomes.some((outcome) => isWcOutcomeDisplayable(outcome, group.marketKey)),
  );
}

/**
 * Some live feeds (e.g. tennis from Olimpbet) publish one market group per
 * game-state combination ("next point at 30:15", "next point at 15:0", …).
 * They all share the same category name and plain П1/П2 outcome names, so
 * users see dozens of visually-identical rows.
 *
 * Rule: when outcome names carry NO contextual suffix (no parenthetical), keep
 * only one group per unique rounded-price signature. Groups with labelled
 * outcomes (e.g. "П1 (1-м сете, 5 очко)") are never deduplicated.
 */
export function deduplicateGroupsByOdds(groups: WcMarketGroup[]): WcMarketGroup[] {
  if (groups.length <= 1) return groups;

  const seen = new Set<string>();
  const result: WcMarketGroup[] = [];

  for (const group of groups) {
    // Keep as-is when ANY outcome or the label has contextual info in parentheses.
    const hasContext =
      group.outcomes.some((o) => /\(/.test(o.name)) ||
      (group.label && /\(/.test(group.label));

    if (hasContext) {
      result.push(group);
      continue;
    }

    // Build a canonical signature from rounded prices (±0.01 buckets).
    const sig = group.outcomes
      .filter((o) => o.price > 1)
      .map((o) => `${o.outcomeKey}:${Math.round(o.price * 100)}`)
      .sort()
      .join("|");

    if (!sig || seen.has(sig)) continue;
    seen.add(sig);
    result.push(group);
  }

  return result;
}

export function filterOfferedGroups(groups: WcMarketGroup[], bettingOpen: boolean): WcMarketGroup[] {
  return groups.filter((group) => isWcGroupOffered(group, bettingOpen));
}
