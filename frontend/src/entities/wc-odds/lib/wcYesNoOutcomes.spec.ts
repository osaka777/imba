import { describe, expect, it } from "vitest";

import type { WcMarketGroup } from "~/entities/wc-odds/api/client";
import {
  findYesNoOutcomes,
  isPlainYesNoGroup,
  isYesNoLikeGroup,
} from "~/entities/wc-odds/lib/wcYesNoOutcomes";

describe("wcYesNoOutcomes", () => {
  const gameCountGroup: WcMarketGroup = {
    key: "g8",
    marketKey: "display_COUNT_SET_YES_NO",
    label: "Кол-во геймов 1-й сет",
    outcomes: [
      { outcomeKey: "DISPLAY_YES|PARAMETER_VALUE:8", name: "Да", price: 3.65 },
      { outcomeKey: "DISPLAY_NO|PARAMETER_VALUE:8", name: "Нет", price: 1.25 },
    ],
  };

  const legacyTotalsGroup: WcMarketGroup = {
    key: "legacy8",
    marketKey: "totals",
    label: "Кол-во геймов 1-й сет",
    outcomes: [
      { outcomeKey: "TOTAL_101_8", name: "Да", price: 3.7 },
      { outcomeKey: "TOTAL_102_8", name: "Нет", price: 1.23 },
    ],
  };

  const parserDisplayGroup: WcMarketGroup = {
    key: "p8",
    marketKey: "display_COUNT_SET_YES_NO",
    label: "Кол-во геймов 1-й сет",
    outcomes: [
      { outcomeKey: "DISPLAY_1164_1401_PARAMETER_VALUE:8|PARAMETER_SET_NUMBER:1", name: "Да", price: 3.7 },
      { outcomeKey: "DISPLAY_1164_1402_PARAMETER_VALUE:8|PARAMETER_SET_NUMBER:1", name: "Нет", price: 1.23 },
    ],
  };

  it("detects COUNT_SET yes/no groups", () => {
    expect(isYesNoLikeGroup(gameCountGroup)).toBe(true);
    expect(isPlainYesNoGroup(gameCountGroup)).toBe(true);
  });

  it("pairs DISPLAY_YES|PARAMETER_VALUE outcomes", () => {
    const { yes, no } = findYesNoOutcomes(gameCountGroup);
    expect(yes?.outcomeKey).toBe("DISPLAY_YES|PARAMETER_VALUE:8");
    expect(no?.outcomeKey).toBe("DISPLAY_NO|PARAMETER_VALUE:8");
  });

  it("pairs legacy totals COUNT_SET groups cached in DB", () => {
    expect(isYesNoLikeGroup(legacyTotalsGroup)).toBe(true);
    const { yes, no } = findYesNoOutcomes(legacyTotalsGroup);
    expect(yes?.name).toBe("Да");
    expect(no?.name).toBe("Нет");
  });

  it("pairs parser DISPLAY_<marketId>_<typeId> keys by outcome type id", () => {
    const { yes, no } = findYesNoOutcomes(parserDisplayGroup);
    expect(yes?.outcomeKey).toContain("1401");
    expect(no?.outcomeKey).toContain("1402");
  });
});
