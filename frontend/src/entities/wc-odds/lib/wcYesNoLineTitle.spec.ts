import { describe, expect, it } from "vitest";

import type { WcMarketGroup } from "~/entities/wc-odds/api/client";
import {
  expandYesNoLineCategories,
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
});
