import { describe, expect, it } from "vitest";

import type { WcMarketGroup } from "~/entities/wc-odds/api/client";
import {
  buildGoalsTeamPairRows,
  expandGoalsTeamCategories,
  resolveGoalsTeamPivotLabel,
} from "~/entities/wc-odds/lib/wcGoalsTeamScope";

function goalsTeamGroup(team: 1 | 2): WcMarketGroup {
  return {
    key: `gt${team}`,
    marketKey: `display_GOALS_TEAM${team}`,
    label: `Забьёт команда ${team}`,
    outcomes: [
      { outcomeKey: "YES", name: "Да", price: 1.74 },
      { outcomeKey: "NO", name: "Нет", price: 2.1 },
    ],
  };
}

describe("wcGoalsTeamScope", () => {
  it("merges team score categories into one accordion", () => {
    const expanded = expandGoalsTeamCategories([
      ["Забьёт команда 1", [goalsTeamGroup(1)]],
      ["Забьёт команда 2", [goalsTeamGroup(2)]],
    ]);

    expect(expanded).toEqual([
      ["Забьёт", [goalsTeamGroup(1), goalsTeamGroup(2)]],
    ]);
  });

  it("uses team names as pivot labels", () => {
    const rows = buildGoalsTeamPairRows([goalsTeamGroup(1), goalsTeamGroup(2)], {
      homeTeam: "Portugal",
      awayTeam: "Spain",
    });

    expect(rows.map((row) => row.teamLabel)).toEqual(["Portugal", "Spain"]);
    expect(resolveGoalsTeamPivotLabel(goalsTeamGroup(2), { homeTeam: "Portugal", awayTeam: "Spain" })).toBe("Spain");
  });
});
