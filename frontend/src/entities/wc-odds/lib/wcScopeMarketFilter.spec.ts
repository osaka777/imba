import type { WcEvent } from "~/entities/wc-odds/api/client";

import {
  filterFinalizedScopeGroupedMarkets,
  isScopeFinalizedForEvent,
  parseMarketScopeFromText,
  resolveMarketGroupScope,
} from "./wcScopeMarketFilter";

describe("wcScopeMarketFilter", () => {
  const liveEvent = {
    phase: "live",
    completed: false,
    homeScore: 0,
    awayScore: 2,
    parsedScore: {
      details: [
        [6, 11],
        [8, 11],
        [6, 3],
      ],
    },
  } as WcEvent;

  it("marks finished set scope as finalized", () => {
    expect(isScopeFinalizedForEvent(liveEvent, { kind: "set", index: 1 })).toBe(true);
    expect(isScopeFinalizedForEvent(liveEvent, { kind: "set", index: 3 })).toBe(false);
  });

  it("removes combo markets for finished sets", () => {
    const grouped = filterFinalizedScopeGroupedMarkets({
      "Результат + тотал": [
        {
          key: "1297__PARAMETER_SET_NUMBER:1|PARAMETER_VALUE:18.5",
          marketKey: "display_WIN1_AND_TOTAL_SET",
          label: "Результат + тотал 18.5 1-й сет",
          outcomes: [{
            name: "ТМ",
            price: 12,
            outcomeKey: "DISPLAY_1297_1729_PARAMETER_SET_NUMBER:1|PARAMETER_VALUE:18.5",
          }],
        },
        {
          key: "1297__PARAMETER_SET_NUMBER:3|PARAMETER_VALUE:18.5",
          marketKey: "display_WIN1_AND_TOTAL_SET",
          label: "Результат + тотал 18.5 3-й сет",
          outcomes: [{
            name: "ТМ",
            price: 4.1,
            outcomeKey: "DISPLAY_1297_1729_PARAMETER_SET_NUMBER:3|PARAMETER_VALUE:18.5",
          }],
        },
      ],
      "1-й сет": [{
        key: "totals-1",
        marketKey: "totals",
        label: "Тотал 18.5",
        outcomes: [{ name: "ТМ", price: 1.9, outcomeKey: "UNDER_18.5", point: 18.5 }],
      }],
    }, liveEvent);

    expect(grouped["1-й сет"]).toBeUndefined();
    expect(grouped["Результат + тотал"]).toHaveLength(1);
    expect(resolveMarketGroupScope("Результат + тотал", grouped["Результат + тотал"]![0]!)).toEqual({
      kind: "set",
      index: 3,
    });
    expect(parseMarketScopeFromText("1-й сет")).toEqual({ kind: "set", index: 1 });
  });
});
