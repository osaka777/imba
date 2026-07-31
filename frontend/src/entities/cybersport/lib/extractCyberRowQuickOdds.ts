import type { WcEventDetail, WcMarketGroup, WcMarketOutcome } from "~/entities/wc-odds/api/client";
import {
  deriveCyberOddsSectionId,
  resolveActiveCyberMapNumber,
} from "~/entities/wc-odds/lib/wcCyberOddsLayout";

export type CyberRowQuickOdds =
  | {
      kind: "h2h";
      home: number;
      away: number;
      draw: number | null;
    }
  | {
      kind: "map";
      mapNum: number;
      home: number;
      away: number;
      category: string;
      group: WcMarketGroup;
      homeOutcome: WcMarketOutcome;
      awayOutcome: WcMarketOutcome;
    };

function parseMapFromCategory(category: string): number | null {
  const cardWord = category.match(/карта\s*(\d+)/i);
  if (cardWord) return Number(cardWord[1]);
  const ordinal = category.match(/(\d+)\s*[-–]?\s*[яЙ]\s*карт/i);
  if (ordinal) return Number(ordinal[1]);
  const compact = category.match(/(?:^|[\s·])К(\d+)/i);
  if (compact) return Number(compact[1]);
  return null;
}

function isWinnerMapGroup(group: WcMarketGroup): boolean {
  const key = group.marketKey ?? "";
  return (
    key === "h2h"
    || /map_\d+_winner/i.test(key)
    || /WINNER_MAP/i.test(key)
    || /MATCH_WINNER/i.test(key)
  );
}

function pickP1P2Outcomes(group: WcMarketGroup): {
  home: WcMarketOutcome;
  away: WcMarketOutcome;
} | null {
  const tradable = group.outcomes.filter(
    (o) => !o.suspended && Number.isFinite(o.price) && o.price > 1,
  );
  if (tradable.length < 2) return null;

  const byName = (pattern: RegExp) =>
    tradable.find((o) => pattern.test(o.name.trim()));

  const p1 =
    tradable.find((o) => o.outcomeKey === "HOME")
    ?? byName(/^П1$/i)
    ?? byName(/^1$/);
  const p2 =
    tradable.find((o) => o.outcomeKey === "AWAY")
    ?? byName(/^П2$/i)
    ?? byName(/^2$/);

  if (!p1 || !p2 || p1.outcomeKey === p2.outcomeKey) return null;
  return { home: p1, away: p2 };
}

function mapWinnerFromCategory(
  category: string,
  groups: WcMarketGroup[],
  mapNum: number,
): CyberRowQuickOdds | null {
  if (parseMapFromCategory(category) !== mapNum) return null;

  for (const group of groups) {
    if (!isWinnerMapGroup(group)) continue;
    const pair = pickP1P2Outcomes(group);
    if (!pair) continue;

    return {
      kind: "map",
      mapNum,
      home: pair.home.price,
      away: pair.away.price,
      category,
      group,
      homeOutcome: pair.home,
      awayOutcome: pair.away,
    };
  }

  return null;
}

/** Best-effort quick odds for cyber list rows (match winner or active map winner). */
export function extractCyberRowQuickOdds(detail: WcEventDetail): CyberRowQuickOdds | null {
  if ((detail.oddsHome ?? 0) > 1 && (detail.oddsAway ?? 0) > 1) {
    return {
      kind: "h2h",
      home: detail.oddsHome!,
      away: detail.oddsAway!,
      draw: detail.oddsDraw ?? null,
    };
  }

  const grouped = detail.groupedMarkets ?? {};

  for (const [category, groups] of Object.entries(grouped)) {
    const section = deriveCyberOddsSectionId(category);
    if (section !== "match" && category.trim() !== "1X2") continue;

    for (const group of groups) {
      if (group.marketKey !== "h2h") continue;
      const pair = pickP1P2Outcomes(group);
      if (!pair) continue;
      return {
        kind: "h2h",
        home: pair.home.price,
        away: pair.away.price,
        draw: null,
      };
    }
  }

  const activeMap = resolveActiveCyberMapNumber(detail);
  if (activeMap != null) {
    for (const [category, groups] of Object.entries(grouped)) {
      const hit = mapWinnerFromCategory(category, groups, activeMap);
      if (hit) return hit;
    }
  }

  return null;
}
