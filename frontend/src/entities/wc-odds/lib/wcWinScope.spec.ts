import { describe, expect, it } from "vitest";

import type { WcMarketGroup } from "~/entities/wc-odds/api/client";
import {
  expandWinnerScopeCategories,
  formatWinnerIntervalLabel,
  resolveWinnerScopedBlockName,
  shouldExpandWinnerByScope,
} from "~/entities/wc-odds/lib/wcWinScope";

function winGroup(from: number, to: number, marketKey = "display_WINNER_Х_MIN"): WcMarketGroup {
  const param = `PARAMETER_FROM:${from}|PARAMETER_TO:${to}`;
  return {
    key: `win-${from}-${to}`,
    marketKey,
    label: `Победа в течение матча ${from}–${to} мин`,
    outcomes: [
      { outcomeKey: `DISPLAY_1|${param}`, name: "П1", price: 5.3 },
      { outcomeKey: `DISPLAY_2|${param}`, name: "Х", price: 1.73 },
      { outcomeKey: `DISPLAY_3|${param}`, name: "П2", price: 3.01 },
    ],
  };
}

describe("wcWinScope", () => {
  it("extracts interval from label", () => {
    expect(formatWinnerIntervalLabel(winGroup(1, 80))).toBe("1–80 мин");
    expect(formatWinnerIntervalLabel(winGroup(71, 80, "display_WINNER_10MIN"))).toBe("71–80 мин");
  });

  it("detects merged scoped winner blocks", () => {
    const groups = [winGroup(1, 70), winGroup(1, 75), winGroup(1, 80)];
    expect(shouldExpandWinnerByScope("Победа в течение матча", groups)).toBe(true);
  });

  it("splits merged category into per-interval accordions", () => {
    const groups = [winGroup(1, 80), winGroup(1, 70), winGroup(1, 75)];
    const expanded = expandWinnerScopeCategories([
      ["Победа в течение матча", groups],
    ]);

    expect(expanded).toEqual([
      ["Победа 1–70 мин", [groups[1]]],
      ["Победа 1–75 мин", [groups[2]]],
      ["Победа 1–80 мин", [groups[0]]],
    ]);
  });

  it("builds canonical block names for fast-event winner", () => {
    expect(
      resolveWinnerScopedBlockName("Победа в течение матча", winGroup(1, 85)),
    ).toBe("Победа 1–85 мин");
    expect(
      resolveWinnerScopedBlockName("Победа (10 мин)", winGroup(71, 80, "display_WINNER_10MIN")),
    ).toBe("Победа (10 мин) · 71–80 мин");
  });
});
