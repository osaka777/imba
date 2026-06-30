import { describe, expect, it } from "vitest";

import type { WcMarketGroup } from "~/entities/wc-odds/api/client";
import {
  buildTimeWindowYesNoTitle,
  expandTimeWindowYesNoCategories,
  extractTimeWindowMinutes,
  extractTimeWindowRange,
  filterRelevantTimeWindowGroups,
  findYesNoOutcomes,
  formatTimeWindowYesNoCategoryName,
  isTimeWindowYesNoCategory,
  sortTimeWindowYesNoGroups,
} from "~/entities/wc-odds/lib/wcYesNoTimeGroups";

function group(label: string, from: number, to: number): WcMarketGroup {
  return {
    key: `${from}-${to}`,
    marketKey: "display_GOAL15MIN_YES_NO",
    label,
    outcomes: [
      {
        outcomeKey: `DISPLAY_${from}_YES|PARAMETER_FROM:${from}|PARAMETER_TO:${to}`,
        name: "Да",
        price: 2,
      },
      {
        outcomeKey: `DISPLAY_${from}_NO|PARAMETER_FROM:${from}|PARAMETER_TO:${to}`,
        name: "Нет",
        price: 1.5,
      },
    ],
  };
}

describe("wcYesNoTimeGroups", () => {
  it("detects time-window yes/no categories", () => {
    const groups = [group("GOAL15MIN: да/нет 16–30 мин", 16, 30)];
    expect(isTimeWindowYesNoCategory("GOAL15MIN: да/нет", groups)).toBe(true);
    expect(isTimeWindowYesNoCategory("Гол в 15-минутном интервале", groups)).toBe(true);
  });

  it("drops elapsed intervals during live play", () => {
    const groups = [
      group("GOAL15MIN: да/нет 1–15 мин", 1, 15),
      group("GOAL15MIN: да/нет 46–60 мин", 46, 60),
      group("GOAL15MIN: да/нет 61–75 мин", 61, 75),
    ];

    const filtered = filterRelevantTimeWindowGroups(groups, {
      phase: "live",
      parsedScore: { seconds: 52 * 60 },
    });

    expect(filtered.map((item) => extractTimeWindowRange(item)?.from)).toEqual([46, 61]);
  });

  it("sorts groups chronologically", () => {
    const groups = [
      group("GOAL15MIN: да/нет 61–75 мин", 61, 75),
      group("GOAL15MIN: да/нет 1–15 мин", 1, 15),
      group("GOAL15MIN: да/нет 16–30 мин", 16, 30),
    ];

    expect(sortTimeWindowYesNoGroups(groups).map((item) => extractTimeWindowMinutes(item))).toEqual([
      1, 16, 61,
    ]);
  });

  it("builds compact button titles", () => {
    const sample = group("GOAL15MIN: да/нет 16–30 мин", 16, 30);
    const { yes, no } = findYesNoOutcomes(sample);

    expect(buildTimeWindowYesNoTitle(sample, yes!, "GOAL15MIN: да/нет")).toBe("16–30 мин·Да");
    expect(buildTimeWindowYesNoTitle(sample, no!, "GOAL15MIN: да/нет")).toBe("16–30 мин·Нет");
  });

  it("splits 15-minute goal windows into separate category titles", () => {
    const groups = [
      group("GOAL15MIN: да/нет 1–15 мин", 1, 15),
      group("GOAL15MIN: да/нет 16–30 мин", 16, 30),
    ];

    const expanded = expandTimeWindowYesNoCategories([
      ["Гол в 15-минутном интервале", groups],
    ]);

    expect(expanded).toEqual([
      ["1–15 мин", [groups[0]]],
      ["16–30 мин", [groups[1]]],
    ]);
    expect(formatTimeWindowYesNoCategoryName("Гол в 15-минутном интервале", groups[0]!)).toBe("1–15 мин");
  });

  it("does not treat expanded interval category as time-window block", () => {
    const sample = group("GOAL15MIN: да/нет 1–15 мин", 1, 15);
    expect(isTimeWindowYesNoCategory("1–15 мин", [sample])).toBe(false);
  });
});
