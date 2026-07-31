import type { WcEvent, WcEventDetail, WcGroupedMarkets, WcMarketGroup } from "~/entities/wc-odds/api/client";

export type MarketScope =
  | { kind: "quarter"; index: number }
  | { kind: "half"; index: number }
  | { kind: "set"; index: number }
  | { kind: "game"; setIndex: number; gameIndex: number }
  | { kind: "point"; setIndex: number; gameIndex: number; pointIndex: number };

const PURE_SCOPE_CATEGORY = /^\d+-[йи]\s+(?:сет|тайм)$|^\d+-я\s+четверть$/i;

const TENNIS_POINT_RANK: Record<number, number> = {
  0: 0,
  15: 1,
  30: 2,
  40: 3,
  50: 4,
};

/**
 * Prefer the most specific scope (point > game > set) so "1-й сет, 7-й гейм"
 * does not collapse to set-only.
 */
export function parseMarketScopeFromText(text: string): MarketScope | null {
  const point = text.match(
    /(\d+)\s*[-–—]?\s*[йи]\s+сет[\s\S]*?(\d+)\s*[-–—]?\s*[йи]\s+гейм[\s\S]*?(\d+)\s*[-–—]?\s*(?:[еейя]-?\s*)?очк/i,
  );
  if (point) {
    const setIndex = Number(point[1]);
    const gameIndex = Number(point[2]);
    const pointIndex = Number(point[3]);
    if (
      Number.isFinite(setIndex) && setIndex >= 1
      && Number.isFinite(gameIndex) && gameIndex >= 1
      && Number.isFinite(pointIndex) && pointIndex >= 1
    ) {
      return { kind: "point", setIndex, gameIndex, pointIndex };
    }
  }

  const game = text.match(
    /(\d+)\s*[-–—]?\s*[йи]\s+сет[\s\S]*?(\d+)\s*[-–—]?\s*[йи]\s+гейм/i,
  );
  if (game) {
    const setIndex = Number(game[1]);
    const gameIndex = Number(game[2]);
    if (
      Number.isFinite(setIndex) && setIndex >= 1
      && Number.isFinite(gameIndex) && gameIndex >= 1
    ) {
      return { kind: "game", setIndex, gameIndex };
    }
  }

  const set = text.match(/(\d+)-[йи]\s+сет/i);
  if (set) {
    const index = Number(set[1]);
    if (index >= 1 && index <= 5) return { kind: "set", index };
  }

  const quarter = text.match(/(\d+)-я\s+четверть/i);
  if (quarter) {
    const index = Number(quarter[1]);
    if (index >= 1 && index <= 4) return { kind: "quarter", index };
  }

  const half = text.match(/(\d+)-й\s+тайм/i);
  if (half) {
    const index = Number(half[1]);
    if (index >= 1 && index <= 2) return { kind: "half", index };
  }

  return null;
}

function parseScopeFromParamTail(tail: string): MarketScope | null {
  const params: Record<string, string> = {};
  for (const chunk of tail.split("|")) {
    const colon = chunk.indexOf(":");
    if (colon <= 0) continue;
    params[chunk.slice(0, colon)] = chunk.slice(colon + 1);
  }

  const setNum = Number(params.PARAMETER_SET_NUMBER);
  const gameNum = Number(params.PARAMETER_GAME_NUMBER);
  const pointNum = Number(params.PARAMETER_POINT_NUMBER);

  if (
    Number.isFinite(setNum) && setNum >= 1
    && Number.isFinite(gameNum) && gameNum >= 1
    && Number.isFinite(pointNum) && pointNum >= 1
  ) {
    return { kind: "point", setIndex: setNum, gameIndex: gameNum, pointIndex: pointNum };
  }

  if (Number.isFinite(setNum) && setNum >= 1 && Number.isFinite(gameNum) && gameNum >= 1) {
    return { kind: "game", setIndex: setNum, gameIndex: gameNum };
  }

  if (Number.isFinite(setNum) && setNum >= 1) return { kind: "set", index: setNum };

  const half = params.PARAMETER_HALF_NUMBER;
  if (half === "1") return { kind: "half", index: 1 };
  if (half === "2") return { kind: "half", index: 2 };

  const quarter = Number(params.PARAMETER_QUARTER_NUMBER);
  if (Number.isFinite(quarter) && quarter >= 1 && quarter <= 4) {
    return { kind: "quarter", index: quarter };
  }

  return null;
}

function parseScopeFromGroupKey(key: string): MarketScope | null {
  const tail = key.includes("__") ? key.split("__").slice(1).join("__") : key;
  return parseScopeFromParamTail(tail);
}

function parseScopeFromOutcomeKey(outcomeKey: string): MarketScope | null {
  const normalized = outcomeKey.replace(/_base$/i, "");
  return parseScopeFromParamTail(
    /^DISPLAY_\d+_\d+_?(.*)$/.exec(normalized)?.[1]?.trim() ?? "",
  );
}

export function resolveMarketGroupScope(category: string, group: WcMarketGroup): MarketScope | null {
  const trimmedCategory = category.trim();
  if (PURE_SCOPE_CATEGORY.test(trimmedCategory)) {
    const categoryScope = parseMarketScopeFromText(trimmedCategory);
    if (categoryScope) return categoryScope;
  }

  const sources = [
    group.label,
    trimmedCategory,
    group.key,
    ...group.outcomes.map((outcome) => outcome.outcomeKey),
    ...group.outcomes.map((outcome) => outcome.name),
  ];

  for (const source of sources) {
    if (!source) continue;
    const fromText = parseMarketScopeFromText(source);
    if (fromText) return fromText;
    const fromKey = parseScopeFromGroupKey(source);
    if (fromKey) return fromKey;
    const fromOutcome = parseScopeFromOutcomeKey(source);
    if (fromOutcome) return fromOutcome;
  }

  return null;
}

function periodRowsFromEvent(event: WcEvent): Array<[number, number]> {
  const details = event.parsedScore?.details;
  if (!details?.length) return [];

  return details
    .map(([home, away]) => [Number(home), Number(away)] as const)
    .filter(([home, away]) => Number.isFinite(home) && Number.isFinite(away));
}

function estimateTennisPointsPlayed(gameScoreRaw: string | null | undefined): number | null {
  if (!gameScoreRaw?.trim()) return null;
  const parts = gameScoreRaw.trim().split(":");
  if (parts.length !== 2) return null;

  const parseToken = (raw: string): number | null => {
    const core = raw.replace(/\*/g, "").trim();
    if (!core) return null;
    if (core === "A" || core === "50") return 50;
    const n = Number(core);
    return Number.isFinite(n) ? n : null;
  };

  const home = parseToken(parts[0]!);
  const away = parseToken(parts[1]!);
  if (home == null || away == null) return null;

  const homeRank = TENNIS_POINT_RANK[home];
  const awayRank = TENNIS_POINT_RANK[away];
  if (homeRank == null || awayRank == null) return null;
  return homeRank + awayRank;
}

function resolveTennisLiveGameCursor(event: WcEvent): {
  setIndex: number;
  currentGameIndex: number;
  pointsPlayed: number | null;
} | null {
  const periods = periodRowsFromEvent(event);
  if (!periods.length) return null;

  const setIndex = periods.length;
  const current = periods[setIndex - 1]!;
  const gamesCompleted = current[0] + current[1];
  const liveScore =
    event.parsedScore?.text?.liveScore
    ?? (typeof event.parsedScore?.liveScore === "string" ? event.parsedScore.liveScore : null);

  return {
    setIndex,
    currentGameIndex: gamesCompleted + 1,
    pointsPlayed: estimateTennisPointsPlayed(liveScore),
  };
}

function isTennisGameOrPointScopeFinalized(
  event: WcEvent,
  scope: Extract<MarketScope, { kind: "game" | "point" }>,
): boolean {
  if (event.completed) return true;

  const cursor = resolveTennisLiveGameCursor(event);
  if (!cursor) return false;

  if (scope.setIndex < cursor.setIndex) return true;
  if (scope.setIndex > cursor.setIndex) return false;

  if (scope.gameIndex < cursor.currentGameIndex) return true;
  if (scope.gameIndex > cursor.currentGameIndex) return false;

  if (scope.kind === "game") return false;

  if (cursor.pointsPlayed == null) return false;
  return scope.pointIndex <= cursor.pointsPlayed;
}

export function isScopeFinalizedForEvent(event: WcEvent, scope: MarketScope): boolean {
  if (event.phase !== "live" || event.completed) return false;

  const periods = periodRowsFromEvent(event);

  if (scope.kind === "set" || scope.kind === "quarter") {
    return periods.length > scope.index;
  }

  if (scope.kind === "half") {
    if (scope.index === 1) {
      if (periods.length >= 2) return true;
      const period = event.parsedScore?.period;
      if (typeof period === "number" && period >= 2) return true;
      if (typeof period === "string" && /(^|\s)2($|\s)|перерыв|половин|2-?й\s+тайм/i.test(period)) {
        return true;
      }
      return false;
    }
    return event.completed;
  }

  if (scope.kind === "game" || scope.kind === "point") {
    return isTennisGameOrPointScopeFinalized(event, scope);
  }

  return false;
}

function isScopedMarketGroupFinalized(
  category: string,
  group: WcMarketGroup,
  event: WcEvent,
): boolean {
  const scope = resolveMarketGroupScope(category, group);
  if (!scope) return false;
  return isScopeFinalizedForEvent(event, scope);
}

export function filterFinalizedScopeMarketEntries(
  entries: Array<[string, WcMarketGroup[]]>,
  event: WcEvent,
): Array<[string, WcMarketGroup[]]> {
  if (event.phase !== "live" || event.completed) return entries;

  return entries
    .map(([category, groups]) => {
      const trimmedCategory = category.trim();
      if (PURE_SCOPE_CATEGORY.test(trimmedCategory)) {
        const categoryScope = parseMarketScopeFromText(trimmedCategory);
        if (categoryScope && isScopeFinalizedForEvent(event, categoryScope)) {
          return null;
        }
      }

      const kept = groups.filter((group) => !isScopedMarketGroupFinalized(category, group, event));
      return kept.length > 0 ? [trimmedCategory, kept] as [string, WcMarketGroup[]] : null;
    })
    .filter((entry): entry is [string, WcMarketGroup[]] => entry != null);
}

export function filterFinalizedScopeGroupedMarkets(
  grouped: WcGroupedMarkets,
  event: WcEvent,
): WcGroupedMarkets {
  return Object.fromEntries(filterFinalizedScopeMarketEntries(Object.entries(grouped), event));
}

export function filterFinalizedScopeEventMarkets(event: WcEventDetail): WcEventDetail {
  if (event.phase !== "live" || event.completed) return event;
  return {
    ...event,
    groupedMarkets: filterFinalizedScopeGroupedMarkets(event.groupedMarkets ?? {}, event),
  };
}
