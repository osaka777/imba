import type { WcMarketGroup, WcMarketOutcome } from "~/entities/wc-odds/api/client";

import { isWcMarketBettable } from "./wcRate";

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

export function filterOfferedGroups(groups: WcMarketGroup[], bettingOpen: boolean): WcMarketGroup[] {
  return groups.filter((group) => isWcGroupOffered(group, bettingOpen));
}
