import type { WcEvent, WcEventDetail, WcGroupedMarkets, WcMarketGroup } from "~/entities/wc-odds/api/client";

export type MarketScope =
  | { kind: "quarter"; index: number }
  | { kind: "half"; index: number }
  | { kind: "set"; index: number };

const PURE_SCOPE_CATEGORY = /^\d+-[йи]\s+(?:сет|тайм)$|^\d+-я\s+четверть$/i;

export function parseMarketScopeFromText(text: string): MarketScope | null {
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
