import { describe, expect, it } from "vitest";

import type { WcMarketGroup } from "~/entities/wc-odds/api/client";

import {
  coalesceTotalsGroups,
  findTotalsPair,
  hasCompleteTotalsPair,
} from "./wcTotalsPairs";

function totalsGroup(
  key: string,
  marketKey: string,
  outcomes: WcMarketGroup["outcomes"],
): WcMarketGroup {
  return {
    key,
    marketKey,
    label: "Тотал",
    outcomes,
  };
}

describe("wcTotalsPairs", () => {
  it("pairs canonical OVER/UNDER keys", () => {
    const group = totalsGroup("g1", "totals", [
      { outcomeKey: "UNDER_4", name: "ТМ", price: 1.05, point: 4 },
      { outcomeKey: "OVER_4", name: "ТБ", price: 13, point: 4 },
    ]);

    const pair = findTotalsPair(group);
    expect(pair.under?.outcomeKey).toBe("UNDER_4");
    expect(pair.over?.outcomeKey).toBe("OVER_4");
    expect(pair.point).toBe(4);
    expect(hasCompleteTotalsPair(group)).toBe(true);
  });

  it("coalesces split groups for the same line into one pair", () => {
    const underOnly = totalsGroup("g-under", "totals", [
      { outcomeKey: "UNDER_4", name: "ТМ", price: 1.05, point: 4 },
    ]);
    const overOnly = totalsGroup("g-over", "totals", [
      { outcomeKey: "OVER_4", name: "ТБ", price: 13, point: 4 },
    ]);

    const merged = coalesceTotalsGroups([underOnly, overOnly]);
    expect(merged).toHaveLength(1);
    expect(hasCompleteTotalsPair(merged[0]!)).toBe(true);
  });

  it("keeps overtime totals separate from regular totals", () => {
    const regular = totalsGroup("g-reg", "totals", [
      { outcomeKey: "UNDER_2.5", name: "ТМ", price: 1.8, point: 2.5 },
      { outcomeKey: "OVER_2.5", name: "ТБ", price: 1.9, point: 2.5 },
    ]);
    const ot = totalsGroup("g-ot", "totals_ot", [
      { outcomeKey: "UNDER_3.5", name: "ТМ", price: 1.7, point: 3.5 },
      { outcomeKey: "OVER_3.5", name: "ТБ", price: 2.0, point: 3.5 },
    ]);

    const merged = coalesceTotalsGroups([regular, ot]);
    expect(merged).toHaveLength(2);
  });
});
