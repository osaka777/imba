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

  it("drops finished tennis games and already-played points", () => {
    const tennisLive = {
      phase: "live",
      completed: false,
      homeScore: 0,
      awayScore: 0,
      parsedScore: {
        details: [[4, 4]],
        text: { liveScore: "30:15" },
      },
    } as WcEvent;

    expect(parseMarketScopeFromText("1-й сет, 7-й гейм, 3-е очко")).toEqual({
      kind: "point",
      setIndex: 1,
      gameIndex: 7,
      pointIndex: 3,
    });
    expect(isScopeFinalizedForEvent(tennisLive, { kind: "game", setIndex: 1, gameIndex: 7 })).toBe(true);
    expect(isScopeFinalizedForEvent(tennisLive, { kind: "game", setIndex: 1, gameIndex: 9 })).toBe(false);
    expect(
      isScopeFinalizedForEvent(tennisLive, {
        kind: "point",
        setIndex: 1,
        gameIndex: 9,
        pointIndex: 3,
      }),
    ).toBe(true);
    expect(
      isScopeFinalizedForEvent(tennisLive, {
        kind: "point",
        setIndex: 1,
        gameIndex: 9,
        pointIndex: 4,
      }),
    ).toBe(false);

    const grouped = filterFinalizedScopeGroupedMarkets({
      "Следующее очко в гейме": [
        {
          key: "g6",
          marketKey: "display_NEXT_POINTS_GAME",
          label: "1-й сет, 6-й гейм, 5-е очко",
          outcomes: [
            {
              name: "П1",
              price: 1.9,
              outcomeKey:
                "DISPLAY_1_1_PARAMETER_SET_NUMBER:1|PARAMETER_GAME_NUMBER:6|PARAMETER_POINT_NUMBER:5",
            },
          ],
        },
        {
          key: "g9",
          marketKey: "display_NEXT_POINTS_GAME",
          label: "1-й сет, 9-й гейм, 4-е очко",
          outcomes: [
            {
              name: "П1",
              price: 1.85,
              outcomeKey:
                "DISPLAY_1_1_PARAMETER_SET_NUMBER:1|PARAMETER_GAME_NUMBER:9|PARAMETER_POINT_NUMBER:4",
            },
          ],
        },
      ],
      "40:40": [
        {
          key: "d7",
          marketKey: "display_DEUSE_POINT",
          label: "1-й сет, 7-й гейм",
          outcomes: [
            {
              name: "Да",
              price: 2.1,
              outcomeKey: "DISPLAY_1_1_PARAMETER_SET_NUMBER:1|PARAMETER_GAME_NUMBER:7",
            },
          ],
        },
        {
          key: "d9",
          marketKey: "display_DEUSE_POINT",
          label: "1-й сет, 9-й гейм",
          outcomes: [
            {
              name: "Да",
              price: 2.2,
              outcomeKey: "DISPLAY_1_1_PARAMETER_SET_NUMBER:1|PARAMETER_GAME_NUMBER:9",
            },
          ],
        },
      ],
    }, tennisLive);

    expect(grouped["Следующее очко в гейме"]).toHaveLength(1);
    expect(grouped["Следующее очко в гейме"]![0]!.label).toBe("1-й сет, 9-й гейм, 4-е очко");
    expect(grouped["40:40"]).toHaveLength(1);
    expect(grouped["40:40"]![0]!.label).toBe("1-й сет, 9-й гейм");
  });
});
