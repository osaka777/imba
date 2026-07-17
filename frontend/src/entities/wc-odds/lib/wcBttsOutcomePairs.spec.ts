import { describe, expect, it } from "vitest";

import type { WcMarketGroup } from "~/entities/wc-odds/api/client";
import {
  buildBttsOutcomePairRows,
  parseBttsOutcomeLabel,
} from "~/entities/wc-odds/lib/wcBttsOutcomePairs";

describe("wcBttsOutcomePairs", () => {
  it("parses combined outcome labels", () => {
    expect(parseBttsOutcomeLabel("ОЗ·Да·П1")).toEqual({ yn: "Да", result: "П1" });
    expect(parseBttsOutcomeLabel("ОЗ·Нет·X2")).toEqual({ yn: "Нет", result: "X2" });
  });

  it("groups legacy double-chance btts outcomes into Да/Нет pairs", () => {
    const group: WcMarketGroup = {
      key: "legacy",
      marketKey: "display_DOUBLECHANCE_AND_GOALS_BOTH",
      label: "Обе забьют и Исход",
      outcomes: [
        { outcomeKey: "o1", name: "ОЗ·Нет·X", price: 5.86 },
        { outcomeKey: "o2", name: "ОЗ·Да·X", price: 5.62 },
        { outcomeKey: "o3", name: "ОЗ·Нет·П1", price: 5.37 },
        { outcomeKey: "o4", name: "ОЗ·Да·П1", price: 12 },
        { outcomeKey: "o5", name: "ОЗ·Нет·12", price: 2.01 },
        { outcomeKey: "o6", name: "ОЗ·Да·12", price: 4.4 },
      ],
    };

    const rows = buildBttsOutcomePairRows([group]);
    expect(rows.map((row) => row.result)).toEqual(["X", "П1", "12"]);
    expect(rows[0]?.yes?.name).toBe("ОЗ·Да·X");
    expect(rows[0]?.no?.name).toBe("ОЗ·Нет·X");
  });

  it("builds split yes/no groups with result pivot", () => {
    const group: WcMarketGroup = {
      key: "split",
      marketKey: "display_WIN1_AND_BOTH_TEAM_TO_SCORE_YES_NO",
      label: "П1",
      outcomes: [
        { outcomeKey: "YES", name: "ОЗ·Да·П1", price: 2.03 },
        { outcomeKey: "NO", name: "ОЗ·Нет·П1", price: 1.5 },
      ],
    };

    const rows = buildBttsOutcomePairRows([group]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.result).toBe("П1");
  });
});
