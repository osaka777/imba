import { describe, expect, it } from "vitest";

import type { WcEventDetail, WcGroupedMarkets, WcMarketGroup } from "~/entities/wc-odds/api/client";

import { mergeWcEventDetail } from "./wcEventDetail";

function marketGroup(key: string, outcomes: WcMarketGroup["outcomes"]): WcMarketGroup {
  return {
    key,
    marketKey: "totals",
    label: "Тотал",
    outcomes,
  };
}

function baseEvent(groupedMarkets: WcGroupedMarkets): WcEventDetail {
  return {
    id: "ol-1",
    slug: "test-match",
    sport: "soccer",
    leagueName: "Test",
    tournamentId: null,
    homeTeam: "Home",
    awayTeam: "Away",
    commenceTime: "2026-06-28T12:00:00.000Z",
    oddsHome: 2,
    oddsDraw: 3,
    oddsAway: 4,
    totalLine: 2.5,
    oddsOver: 1.9,
    oddsUnder: 1.9,
    bookmaker: "wc",
    completed: false,
    homeScore: 0,
    awayScore: 0,
    bettingOpen: true,
    phase: "live",
    oddsUpdatedAt: null,
    marketsCount: 1,
    odds1X: null,
    odds12: null,
    oddsX2: null,
    groupedMarkets,
  };
}

describe("mergeWcEventDetail groupedMarkets", () => {
  it("drops categories removed from the feed snapshot", () => {
    const prev = baseEvent({
      "Основные": [marketGroup("g1", [{ outcomeKey: "OVER_2.5", name: "ТБ", price: 1.9, point: 2.5 }])],
      "Дополнительные": [marketGroup("g2", [{ outcomeKey: "YES", name: "Да", price: 2.1 }])],
    });
    const incoming = baseEvent({
      "Основные": [marketGroup("g1", [{ outcomeKey: "OVER_2.5", name: "ТБ", price: 1.85, point: 2.5 }])],
    });

    const merged = mergeWcEventDetail(prev, incoming);

    expect(Object.keys(merged.groupedMarkets)).toEqual(["Основные"]);
    expect(merged.groupedMarkets["Дополнительные"]).toBeUndefined();
  });

  it("drops market groups removed from a category", () => {
    const prev = baseEvent({
      "Основные": [
        marketGroup("g1", [{ outcomeKey: "OVER_2.5", name: "ТБ", price: 1.9, point: 2.5 }]),
        marketGroup("g2", [{ outcomeKey: "UNDER_2.5", name: "ТМ", price: 1.9, point: 2.5 }]),
      ],
    });
    const incoming = baseEvent({
      "Основные": [
        marketGroup("g1", [{ outcomeKey: "OVER_2.5", name: "ТБ", price: 1.85, point: 2.5 }]),
      ],
    });

    const merged = mergeWcEventDetail(prev, incoming);

    expect(merged.groupedMarkets["Основные"]).toHaveLength(1);
    expect(merged.groupedMarkets["Основные"][0]?.key).toBe("g1");
  });

  it("drops outcomes removed from a group", () => {
    const prev = baseEvent({
      "Основные": [
        marketGroup("g1", [
          { outcomeKey: "OVER_2.5", name: "ТБ", price: 1.9, point: 2.5 },
          { outcomeKey: "UNDER_2.5", name: "ТМ", price: 1.9, point: 2.5 },
        ]),
      ],
    });
    const incoming = baseEvent({
      "Основные": [
        marketGroup("g1", [{ outcomeKey: "OVER_2.5", name: "ТБ", price: 1.85, point: 2.5 }]),
      ],
    });

    const merged = mergeWcEventDetail(prev, incoming);

    expect(merged.groupedMarkets["Основные"][0]?.outcomes).toHaveLength(1);
    expect(merged.groupedMarkets["Основные"][0]?.outcomes[0]?.outcomeKey).toBe("OVER_2.5");
  });

  it("keeps markets when the feed sends an empty snapshot during live play", () => {
    const prev = baseEvent({
      "Основные": [marketGroup("g1", [{ outcomeKey: "OVER_2.5", name: "ТБ", price: 1.9, point: 2.5 }])],
    });
    const incoming = baseEvent({});

    const merged = mergeWcEventDetail(prev, incoming);

    expect(merged.groupedMarkets).toEqual(prev.groupedMarkets);
  });

  it("clears all markets when the feed sends an empty snapshot after the match ends", () => {
    const prev = baseEvent({
      "Основные": [marketGroup("g1", [{ outcomeKey: "OVER_2.5", name: "ТБ", price: 1.9, point: 2.5 }])],
    });
    const incoming = baseEvent({});
    incoming.completed = true;
    incoming.phase = "finished";
    incoming.feedStatus = "EVENT_FINISHED";

    const merged = mergeWcEventDetail(prev, incoming);

    expect(merged.groupedMarkets).toEqual({});
  });
});
