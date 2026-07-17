import { describe, expect, it } from "vitest";

import type { WcMarketGroup } from "~/entities/wc-odds/api/client";
import {
  expandDoubleChanceScopeCategories,
  formatDoubleChanceIntervalLabel,
  resolveDoubleChanceScopedBlockName,
  shouldExpandDoubleChanceByScope,
} from "~/entities/wc-odds/lib/wcDoubleChanceScope";

function dcGroup(from: number, to: number): WcMarketGroup {
  const param = `PARAMETER_FROM:${from}|PARAMETER_TO:${to}`;
  return {
    key: `dc-${from}-${to}`,
    marketKey: "display_DOUBLE_CHANCE",
    label: "Двойной шанс в течение матча",
    outcomes: [
      { outcomeKey: `DISPLAY_1|${param}`, name: "1X", price: 1.6 },
      { outcomeKey: `DISPLAY_2|${param}`, name: "12", price: 1.33 },
      { outcomeKey: `DISPLAY_3|${param}`, name: "X2", price: 1.21 },
    ],
  };
}

describe("wcDoubleChanceScope", () => {
  it("extracts interval from outcome keys", () => {
    expect(formatDoubleChanceIntervalLabel(dcGroup(0, 5))).toBe("0–5 мин");
    expect(formatDoubleChanceIntervalLabel(dcGroup(45, 50))).toBe("45–50 мин");
  });

  it("detects merged scoped double chance blocks", () => {
    const groups = [dcGroup(0, 5), dcGroup(5, 10), dcGroup(10, 15)];
    expect(shouldExpandDoubleChanceByScope("Двойной шанс в течение матча", groups)).toBe(true);
  });

  it("splits merged category into per-interval accordions", () => {
    const groups = [dcGroup(5, 10), dcGroup(0, 5)];
    const expanded = expandDoubleChanceScopeCategories([
      ["Двойной шанс в течение матча", groups],
    ]);

    expect(expanded).toEqual([
      ["Двойной шанс 0–5 мин", [groups[1]]],
      ["Двойной шанс 5–10 мин", [groups[0]]],
    ]);
  });

  it("builds canonical block names for fast-event double chance", () => {
    expect(
      resolveDoubleChanceScopedBlockName("Двойной шанс в течение матча", dcGroup(15, 20)),
    ).toBe("Двойной шанс 15–20 мин");
  });
});
