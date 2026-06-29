import { describe, expect, it } from "vitest";

import { resolveWcDisplayPeriod } from "./wcLiveScore";

describe("resolveWcDisplayPeriod", () => {
  it("does not show Sportradar break code 31 as period 31", () => {
    expect(resolveWcDisplayPeriod("hockey", "31", 3)).toBe(3);
    expect(resolveWcDisplayPeriod("hockey", "31", 4)).toBe(4);
  });

  it("keeps plain active period numbers", () => {
    expect(resolveWcDisplayPeriod("hockey", "3", 3)).toBe(3);
    expect(resolveWcDisplayPeriod("hockey", 3, 3)).toBe(3);
  });
});
