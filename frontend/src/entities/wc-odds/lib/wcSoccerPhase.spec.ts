import { describe, expect, it } from "vitest";

import { refineSoccerGamePhase } from "./wcSoccerPhase";

describe("refineSoccerGamePhase", () => {
  it("overrides stale break at 119 min to 2nd extra time", () => {
    expect(refineSoccerGamePhase("34", 119 * 60 + 30, "break")).toBe("extra_time_2");
  });

  it("clears stale halftime when clock is in 2nd half", () => {
    expect(refineSoccerGamePhase("31", 52 * 60, "break")).toBeNull();
  });

  it("clears break when feed reports active second half", () => {
    expect(refineSoccerGamePhase("7", 55 * 60, "break")).toBeNull();
  });
});
