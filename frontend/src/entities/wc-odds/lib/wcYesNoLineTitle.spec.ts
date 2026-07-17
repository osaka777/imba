import { describe, expect, it } from "vitest";

import type { WcMarketGroup } from "~/entities/wc-odds/api/client";
import {
  expandYesNoLineCategories,
  expandYesNoScopedCategories,
  mergeYesNoCategoryWithLine,
} from "~/entities/wc-odds/lib/wcYesNoLineTitle";

function yesNoGroup(label: string, line: string): WcMarketGroup {
  return {
    key: line,
    marketKey: "display_BOTHTEAM_WILL_SCORE_OVER_YES_NO",
    label,
    outcomes: [
      { outcomeKey: `DISPLAY_YES|PARAMETER_VALUE:${line}`, name: "Да", price: 2 },
      { outcomeKey: `DISPLAY_NO|PARAMETER_VALUE:${line}`, name: "Нет", price: 1.5 },
    ],
  };
}

describe("wcYesNoLineTitle", () => {
  it("merges line into «Каждая команда забьет больше (Да/Нет)»", () => {
    const group = yesNoGroup("1.5", "1.5");
    expect(
      mergeYesNoCategoryWithLine("Каждая команда забьет больше (Да/Нет)", group),
    ).toBe("Каждая команда забьет 1.5Б (Да/Нет)");
  });

  it("splits multi-line categories into separate section titles", () => {
    const groups = [yesNoGroup("1.5", "1.5"), yesNoGroup("2.5", "2.5")];
    const expanded = expandYesNoLineCategories([
      ["Каждая команда забьет больше (Да/Нет)", groups],
    ]);

    expect(expanded).toEqual([
      ["Каждая команда забьет 1.5Б (Да/Нет)", [groups[0]]],
      ["Каждая команда забьет 2.5Б (Да/Нет)", [groups[1]]],
    ]);
  });

  it("splits «1-й сет · Кол-во геймов» into per-line sections", () => {
    const group8: WcMarketGroup = {
      key: "g8",
      marketKey: "display_COUNT_SET_YES_NO",
      label: "Кол-во геймов 1-й сет",
      outcomes: [
        { outcomeKey: "DISPLAY_YES|PARAMETER_VALUE:8", name: "Да", price: 3.65 },
        { outcomeKey: "DISPLAY_NO|PARAMETER_VALUE:8", name: "Нет", price: 1.25 },
      ],
    };
    const group9: WcMarketGroup = {
      key: "g9",
      marketKey: "display_COUNT_SET_YES_NO",
      label: "Кол-во геймов 1-й сет",
      outcomes: [
        { outcomeKey: "DISPLAY_YES|PARAMETER_VALUE:9", name: "Да", price: 5.4 },
        { outcomeKey: "DISPLAY_NO|PARAMETER_VALUE:9", name: "Нет", price: 1.11 },
      ],
    };

    expect(
      mergeYesNoCategoryWithLine("1-й сет · Кол-во геймов", group8),
    ).toBe("1-й сет · 8 геймов");

    const expanded = expandYesNoLineCategories([
      ["1-й сет · Кол-во геймов", [group8, group9]],
    ]);

    expect(expanded).toEqual([
      ["1-й сет · 8 геймов", [group8]],
      ["1-й сет · 9 геймов", [group9]],
    ]);
  });

  it("splits half BTTS markets into separate accordions", () => {
    const canonical: WcMarketGroup = {
      key: "b1",
      marketKey: "btts",
      label: "",
      outcomes: [
        { outcomeKey: "YES", name: "Да", price: 33 },
        { outcomeKey: "NO", name: "Нет", price: 4.67 },
      ],
    };
    const display: WcMarketGroup = {
      key: "d1",
      marketKey: "display_GOALS_BOTH_HALF",
      label: "Обе забьют 1-й тайм",
      outcomes: [
        { outcomeKey: "YES", name: "Да", price: 12 },
        { outcomeKey: "NO", name: "Нет", price: 1.76 },
      ],
    };

    const expanded = expandYesNoScopedCategories([
      ["1-й тайм", [canonical, display]],
    ]);

    expect(expanded).toHaveLength(2);
    expect(expanded.map(([title]) => title)).toEqual(
      expect.arrayContaining(["1-й тайм · Обе забьют", "Обе забьют 1-й тайм"]),
    );
  });
});
