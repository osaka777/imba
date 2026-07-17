import { describe, expect, it } from "vitest";

import {
  resolveComboVariantGroupLabel,
  resolveHalfMatchHtFtLabel,
  shortTeamCode,
} from "./wcGroupSubLabel";

describe("soccer combo scope labels", () => {
  const teams = { homeTeam: "Аргентина", awayTeam: "Испания" };

  it("maps catalog stems to 1/X style labels without teams", () => {
    expect(resolveHalfMatchHtFtLabel("display_HALF_MATCH_W1W1_AND_TOTAL")).toBe("1/1");
    expect(resolveHalfMatchHtFtLabel("display_HALF_MATCH_W1X_AND_TOTAL")).toBe("1/X");
    expect(resolveHalfMatchHtFtLabel("display_HALF_MATCH_W2W2_AND_TOTAL_HALF")).toBe("2/2");
    expect(resolveHalfMatchHtFtLabel("display_HALF_MATCH_XW1_AND_TOTAL")).toBe("X/1");
    expect(resolveHalfMatchHtFtLabel("display_12_AND_TOTAL")).toBeNull();
  });

  it("uses short team codes when names are provided", () => {
    expect(shortTeamCode("Аргентина")).toBe("Арг");
    expect(shortTeamCode("Испания")).toBe("Исп");
    expect(resolveHalfMatchHtFtLabel("display_HALF_MATCH_W1W2_AND_TOTAL", teams)).toBe("Арг/Исп");
    expect(resolveHalfMatchHtFtLabel("display_HALF_MATCH_W2X_AND_TOTAL", teams)).toBe("Исп/X");
    expect(resolveComboVariantGroupLabel("display_HALF_MATCH_W1W2_AND_TOTAL", teams)).toBe(
      "Арг/Исп · тотал",
    );
  });

  it("builds readable labels for soccer specialty combos", () => {
    expect(resolveComboVariantGroupLabel("display_HALF_MATCH_W1W1_AND_TOTAL")).toBe("1/1 · тотал");
    expect(resolveComboVariantGroupLabel("display_HALF_MATCH_XX_AND_TOTAL_HALF")).toBe(
      "X/X · тотал 1-го тайма",
    );
    expect(
      resolveComboVariantGroupLabel("display_WIN_AND_TOTAL_UNDER_TEAM1_YES_NO", teams, "2.5"),
    ).toBe("Арг · тотал меньше 2.5");
    expect(
      resolveComboVariantGroupLabel("display_WILL_SCORE_GOAL_IN_1HALF_TEAM2_YES_NO", teams),
    ).toBe("Исп · 1-й тайм");
    expect(
      resolveComboVariantGroupLabel("display_FIRST_GOAL1_AND_WIN2_YES_NO", teams),
    ).toBe("Первый Арг · Исп");
    expect(
      resolveComboVariantGroupLabel("display_WIN1_OR_UNDER", teams, "Победа или Тотал 2.5"),
    ).toBe("Арг или тотал меньше 2.5");
    expect(resolveComboVariantGroupLabel("display_TEAM2_GOAL_RANGE", teams)).toBe("Исп · голы");
  });
});
