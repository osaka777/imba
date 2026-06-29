import { describe, expect, it } from "vitest";

import type { WcEventDetail } from "~/entities/wc-odds/api/client";

import { isWcMatchEffectivelyFinished } from "./wcLiveClock";

function liveEvent(overrides: Partial<WcEventDetail> = {}): WcEventDetail {
  return {
    id: "ol-1",
    slug: "test",
    sport: "cyber-football",
    leagueName: "Test",
    tournamentId: null,
    homeTeam: "Home",
    awayTeam: "Away",
    commenceTime: "2026-06-29T07:00:00.000Z",
    oddsHome: 2,
    oddsDraw: 3,
    oddsAway: 4,
    totalLine: 2.5,
    oddsOver: 1.9,
    oddsUnder: 1.9,
    bookmaker: "wc",
    completed: false,
    homeScore: 0,
    awayScore: 1,
    bettingOpen: true,
    phase: "live",
    oddsUpdatedAt: null,
    marketsCount: 1,
    odds1X: null,
    odds12: null,
    oddsX2: null,
    groupedMarkets: {},
    feedStatus: "EVENT_TRADING",
    parsedScore: { seconds: 2400, text: { time: "40:00" }, period: 1 },
    ...overrides,
  };
}

describe("isWcMatchEffectivelyFinished", () => {
  it("does not treat live cyber-football without markets as finished", () => {
    expect(isWcMatchEffectivelyFinished(liveEvent({ groupedMarkets: {} }))).toBe(false);
  });

  it("marks finished when backend says completed", () => {
    expect(isWcMatchEffectivelyFinished(liveEvent({ completed: true, phase: "finished" }))).toBe(true);
  });

  it("marks finished when feed status is EVENT_FINISHED", () => {
    expect(
      isWcMatchEffectivelyFinished(liveEvent({ feedStatus: "EVENT_FINISHED" })),
    ).toBe(true);
  });
});
