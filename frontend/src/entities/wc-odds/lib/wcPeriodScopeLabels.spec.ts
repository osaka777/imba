import { describe, expect, it } from "vitest";

import {
  applySportPeriodScopeLabels,
  formatPeriodTabLabel,
} from "~/entities/wc-odds/lib/wcPeriodScopeLabels";

describe("wcPeriodScopeLabels", () => {
  it("renames half scopes for basketball tabs with quarter hint", () => {
    expect(formatPeriodTabLabel("1-й тайм", "basketball")).toBe("1-я половина (1–2 ч.)");
    expect(formatPeriodTabLabel("2-й тайм", "cyber-basketball")).toBe("2-я половина (3–4 ч.)");
    expect(formatPeriodTabLabel("1-я четверть", "basketball")).toBe("1-я четверть");
  });

  it("keeps football half labels unchanged", () => {
    expect(formatPeriodTabLabel("1-й тайм", "soccer")).toBe("1-й тайм");
    expect(applySportPeriodScopeLabels("1-й тайм · Тотал", "soccer")).toBe(
      "1-й тайм · Тотал",
    );
  });

  it("renames half scopes in category and group labels for basketball", () => {
    expect(applySportPeriodScopeLabels("1-й тайм · Тотал очков", "basketball")).toBe(
      "1-я половина · Тотал очков",
    );
    expect(applySportPeriodScopeLabels("Мемфис · 2-й тайм · инд. тотал", "basketball")).toBe(
      "Мемфис · 2-я половина · инд. тотал",
    );
  });
});
