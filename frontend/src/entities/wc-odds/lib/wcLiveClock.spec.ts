import { describe, expect, it } from "vitest";

import type { WcEventDetail } from "~/entities/wc-odds/api/client";

import { isWcLiveClockRunning, isWcMatchEffectivelyFinished, resolveLiveClockSource } from "./wcLiveClock";

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

  it("marks finished when feed status is Закончен", () => {
    expect(
      isWcMatchEffectivelyFinished(liveEvent({ feedStatus: "Закончен" })),
    ).toBe(true);
  });

  it("does not treat EVENT_ENDED as finished during extra time", () => {
    expect(
      isWcMatchEffectivelyFinished(
        liveEvent({
          feedStatus: "EVENT_ENDED",
          parsedScore: {
            seconds: 91 * 60,
            text: { time: "91:00" },
            period: 3,
            gamePhase: "extra_time_1",
          },
        }),
      ),
    ).toBe(false);
  });

  it("does not treat lone EVENT_ENDED as finished while still live", () => {
    expect(
      isWcMatchEffectivelyFinished(liveEvent({ feedStatus: "EVENT_ENDED" })),
    ).toBe(false);
  });

  it("does not treat Итог labels as finished", () => {
    expect(
      isWcMatchEffectivelyFinished(liveEvent({ feedStatus: "Итог 1 карты" })),
    ).toBe(false);
  });

  it("does not treat extra-time break at 105 min as finished", () => {
    expect(
      isWcMatchEffectivelyFinished(
        liveEvent({
          sport: "soccer",
          parsedScore: {
            seconds: 105 * 60,
            text: { time: "105:00" },
            period: 5,
            gamePhase: "break",
          },
        }),
      ),
    ).toBe(false);
  });
});

describe("resolveLiveClockSource", () => {
  it("ignores corrupt remainingTime for cyber-basketball and uses elapsed clock", () => {
    const source = resolveLiveClockSource({
      sport: "cyber-basketball",
      parsedScore: {
        remainingTimeInPeriodSec: 16_999,
        text: { time: "04:19" },
        seconds: 16_999,
        period: 3,
      },
    });
    expect(source).toEqual({ baseSeconds: 259, countdown: false });
  });

  it("keeps hockey countdown when remaining time is plausible", () => {
    const source = resolveLiveClockSource({
      sport: "hockey",
      parsedScore: {
        remainingTimeInPeriodSec: 524,
        text: { time: "09:52" },
        seconds: 592,
        period: 3,
      },
    });
    expect(source).toEqual({ baseSeconds: 524, countdown: true });
  });

  it("keeps classic basketball countdown when remaining time is plausible", () => {
    const source = resolveLiveClockSource({
      sport: "basketball",
      parsedScore: {
        remainingTimeInPeriodSec: 312,
        text: { time: "03:12" },
        seconds: 192,
        period: 2,
      },
    });
    expect(source).toEqual({ baseSeconds: 312, countdown: true });
  });

  it("keeps soccer match elapsed time during the 2nd half", () => {
    const source = resolveLiveClockSource({
      sport: "soccer",
      parsedScore: {
        seconds: 57 * 60 + 23,
        text: { time: "57:23" },
        period: 2,
      },
    });
    expect(source).toEqual({ baseSeconds: 57 * 60 + 23, countdown: false });
  });

  it("converts 2nd-half period-relative feed time to match elapsed", () => {
    const source = resolveLiveClockSource({
      sport: "soccer",
      parsedScore: {
        seconds: 12 * 60 + 23,
        text: { time: "12:23" },
        period: 2,
      },
    });
    expect(source).toEqual({ baseSeconds: 57 * 60 + 23, countdown: false });
  });

  it("ticks soccer from kickoff of the 2nd half as 45:00 match time", () => {
    expect(
      isWcLiveClockRunning({
        sport: "soccer",
        phase: "live",
        completed: false,
        feedStatus: "EVENT_TRADING",
        parsedScore: { seconds: 0, period: 2, text: { time: "00:00" } },
      }),
    ).toBe(true);

    const source = resolveLiveClockSource({
      sport: "soccer",
      parsedScore: { seconds: 0, period: 2, text: { time: "00:00" } },
    });
    expect(source).toEqual({ baseSeconds: 45 * 60, countdown: false });
  });
});
