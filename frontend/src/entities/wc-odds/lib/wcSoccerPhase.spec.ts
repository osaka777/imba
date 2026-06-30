import { describe, expect, it } from "vitest";

import { refineSoccerGamePhase } from "./wcSoccerPhase";

describe("refineSoccerGamePhase", () => {
  it("overrides stale break at 119 min to 2nd extra time", () => {
    expect(refineSoccerGamePhase("34", 119 * 60 + 30, "break")).toBe("extra_time_2");
  });
});
