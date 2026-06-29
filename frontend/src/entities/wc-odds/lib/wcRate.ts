import type { Rate } from "~/entities/bet/types";
import type { WcEvent, WcEventDetail, WcMarketOutcome } from "~/entities/wc-odds/api/client";
import { formatWcRowLiveTime } from "~/entities/wc-odds/lib/wcLiveScore";

export const WC_ODDS_SOURCE = "wc-odds" as const;

export type WcPick = "HOME" | "DRAW" | "AWAY";

export type WcBettingEvent = {
  completed: boolean;
  commenceTime: string;
  bettingOpen?: boolean;
};

/** Open while the feed accepts bets (prematch + live, until closed or finished). */
export function isWcEventBettingOpen(
  event: WcBettingEvent,
  _nowMs: number = Date.now(),
): boolean {
  if (event.completed) return false;
  if (event.bettingOpen === false) return false;
  return true;
}

export function isTotalsMarketKey(marketKey: string): boolean {
  const normalized = normalizeWcMarketKey(marketKey);
  return normalized === "totals" || normalized === "totals_home" || normalized === "totals_away";
}

export function isWcBettableMarketKey(marketKey: string): boolean {
  if (!marketKey) return false;
  if (marketKey.startsWith("display_")) return false;
  const normalized = normalizeWcMarketKey(marketKey);
  return (
    normalized === "h2h"
    || isTotalsMarketKey(marketKey)
    || normalized === "even_odd"
    || normalized === "btts"
    || normalized === "double_chance"
    || normalized === "handicap"
    || normalized === "goals_both_min"
    || normalized === "handicap_3way"
  );
}

/** Canonical + selected display markets that accept bets in the coupon. */
export function isWcMarketBettable(marketKey: string, outcomeKey?: string): boolean {
  if (isWcBettableMarketKey(marketKey)) return true;
  if (!marketKey.startsWith("display_") || !outcomeKey) return false;
  if (outcomeKey.startsWith("DISPLAY_")) return true;

  const normalized = normalizeWcMarketKey(marketKey);
  const canonicalKeys = new Set([
    "h2h", "totals", "totals_home", "totals_away", "even_odd",
    "btts", "double_chance", "handicap", "goals_both_min", "handicap_3way",
  ]);
  if (!canonicalKeys.has(normalized)) return false;

  return (
    outcomeKey.startsWith("OVER_")
    || outcomeKey.startsWith("UNDER_")
    || outcomeKey.startsWith("HOME")
    || outcomeKey.startsWith("AWAY")
    || outcomeKey === "DRAW"
    || outcomeKey.startsWith("DC_")
    || outcomeKey === "YES"
    || outcomeKey === "NO"
    || outcomeKey === "EVEN"
    || outcomeKey === "ODD"
  );
}

export function isWcVisibleMarketKey(marketKey: string): boolean {
  return isWcBettableMarketKey(marketKey) || isWcDisplayMarketKey(marketKey);
}

/** Combo / special display markets — not canonical totals/handicap rows. */
export function isWcDisplayComboMarketKey(marketKey: string): boolean {
  if (!marketKey.startsWith("display_")) return false;
  return /_(AND|OR)_|YES_NO|HALF_MATCH|WIN_AND_|DC_AND_|BOTHHALF|1HALF_2HALF|NEXT_GOAL|OR_CLEANSHEET|OR_OVER|OR_UNDER|AT_LEAST_ONE|CLEANSHEET|SCORE_TEAM|EXACT_|GOAL_RANGE|WINNER_\d+MIN/i.test(
    marketKey,
  );
}

export function isHandicap3WayMarketKey(marketKey: string): boolean {
  return /HANDICAP_3WAY/i.test(marketKey);
}

export function stripOvertimeMarketSuffix(marketKey: string): string {
  return marketKey.replace(/_ot$/i, "");
}

export function isOvertimeMarketKey(marketKey: string): boolean {
  return /_ot$/i.test(marketKey) || /WITH_?OT/i.test(marketKey);
}

export function normalizeWcMarketKey(marketKey: string): string {
  const baseKey = stripOvertimeMarketSuffix(marketKey);
  if (
    baseKey === "h2h"
    || baseKey === "totals"
    || baseKey === "totals_home"
    || baseKey === "totals_away"
    || baseKey === "even_odd"
    || baseKey === "btts"
    || baseKey === "double_chance"
    || baseKey === "handicap"
    || baseKey === "goals_both_min"
    || baseKey === "handicap_3way"
  ) {
    return baseKey;
  }
  if (isHandicap3WayMarketKey(baseKey)) return "handicap_3way";
  if (/^display_GOALS_TEAM1/i.test(baseKey)) return "btts";
  if (/^display_GOALS_TEAM2/i.test(baseKey)) return "btts";
  if (/^display_WINNER_/i.test(baseKey)) return baseKey;
  if (baseKey.startsWith("display_DOUBLE_CHANCE")) return "double_chance";
  if (/display_INDIVIDUAL_TOTAL_TEAM1/i.test(baseKey) || /display_TEAM_TOTAL_1/i.test(baseKey)) {
    return "totals_home";
  }
  if (/display_INDIVIDUAL_TOTAL_TEAM2/i.test(baseKey) || /display_TEAM_TOTAL_2/i.test(baseKey)) {
    return "totals_away";
  }
  if (baseKey.startsWith("display_TOTAL") || /display_INDIVIDUAL_TOTAL/i.test(baseKey)) {
    return "totals";
  }
  if (baseKey.startsWith("display_EVEN_ODD") || /display_EVEN_ODD/i.test(baseKey)) {
    return "even_odd";
  }
  if (baseKey === "display_GOALS_BOTH" || baseKey.startsWith("display_GOALS_BOTH_")) {
    if (/GOALS_BOTH_MIN/i.test(baseKey)) return "goals_both_min";
    return "btts";
  }
  if (baseKey.startsWith("display_GOALS_BOTHHALF")) return "btts";
  if (baseKey.startsWith("display_HANDICAP")) return "handicap";
  return baseKey;
}

export const WC_MARKET: Record<WcPick, string> = {
  HOME: "WC__h2h__HOME",
  DRAW: "WC__h2h__DRAW",
  AWAY: "WC__h2h__AWAY",
};

export const WC_PICK_LABEL: Record<WcPick, string> = {
  HOME: "П1",
  DRAW: "X",
  AWAY: "П2",
};

const LEGACY_WC_MARKET_PREFIXES = [
  "h2h",
  "totals",
  "totals_home",
  "totals_away",
  "even_odd",
  "btts",
  "double_chance",
  "handicap",
  "handicap_3way",
  "goals_both_min",
  "display_",
] as const;

function isLegacyWcMarketToken(token: string): boolean {
  return LEGACY_WC_MARKET_PREFIXES.some(
    (prefix) => token === prefix || token.startsWith(prefix),
  );
}

/** Unique coupon id; groupKey disambiguates repeated outcome keys (e.g. even_odd per set). */
export function wcMarketId(
  marketKey: string,
  outcomeKey: string,
  groupKey?: string,
): string {
  if (groupKey) {
    return `WC__${groupKey}__${outcomeKey}`;
  }
  return `WC__${marketKey}__${outcomeKey}`;
}

export function parseWcMarketId(market: string): {
  marketKey?: string;
  groupKey?: string;
  outcomeKey?: string;
} | null {
  if (!market.startsWith("WC__")) return null;

  const parts = market.split("__");
  if (parts.length < 3) return null;

  const tail = parts.slice(1);
  if (/^\d+$/.test(tail[0] ?? "")) {
    return {
      groupKey: tail.slice(0, -1).join("__"),
      outcomeKey: tail[tail.length - 1],
    };
  }

  if (isLegacyWcMarketToken(tail[0] ?? "")) {
    return {
      marketKey: tail[0],
      outcomeKey: tail.slice(1).join("__"),
    };
  }

  return {
    marketKey: tail[0],
    outcomeKey: tail.slice(1).join("__"),
  };
}

export function isWcDisplayMarketKey(marketKey: string): boolean {
  return marketKey.startsWith("display_");
}

export function isWcOddsRate(rate: Rate): boolean {
  return (
    rate.source === WC_ODDS_SOURCE
    || (typeof rate.market === "string" && rate.market.startsWith("WC__"))
  );
}

export function getWcPickFromRate(rate: Rate): WcPick | null {
  if (rate.wcPick) return rate.wcPick;
  if (rate.wcOutcomeKey && ["HOME", "DRAW", "AWAY"].includes(rate.wcOutcomeKey)) {
    return rate.wcOutcomeKey as WcPick;
  }
  if (rate.market === WC_MARKET.HOME || rate.market === "WC__HOME") return "HOME";
  if (rate.market === WC_MARKET.DRAW || rate.market === "WC__DRAW") return "DRAW";
  if (rate.market === WC_MARKET.AWAY || rate.market === "WC__AWAY") return "AWAY";
  return null;
}

export function getWcMarketKeyFromRate(rate: Rate): string {
  if (rate.wcMarketKey) return rate.wcMarketKey;
  const parsed = typeof rate.market === "string" ? parseWcMarketId(rate.market) : null;
  if (parsed?.marketKey) return parsed.marketKey;
  return "h2h";
}

export function getWcGroupKeyFromRate(rate: Rate): string | null {
  if (rate.wcGroupKey) return rate.wcGroupKey;
  const parsed = typeof rate.market === "string" ? parseWcMarketId(rate.market) : null;
  return parsed?.groupKey ?? null;
}

export function getWcOutcomeKeyFromRate(rate: Rate): string | null {
  if (rate.wcOutcomeKey) return rate.wcOutcomeKey;
  const pick = getWcPickFromRate(rate);
  if (pick) return pick;
  const parsed = typeof rate.market === "string" ? parseWcMarketId(rate.market) : null;
  return parsed?.outcomeKey ?? null;
}

export function hasWcOddsRates(rates: Rate[]): boolean {
  return rates.some(isWcOddsRate);
}

export function getWcOddForPick(event: WcEvent, pick: WcPick): number | null {
  if (pick === "HOME") return event.oddsHome;
  if (pick === "DRAW") return event.oddsDraw;
  return event.oddsAway;
}

export function findWcOutcomeOdd(
  event: WcEventDetail,
  marketKey: string,
  outcomeKey: string,
  line?: string | null,
): number | null {
  const normalized = normalizeWcMarketKey(marketKey);
  const keys = marketKey === normalized ? [marketKey] : [marketKey, normalized];

  for (const key of keys) {
    for (const groups of Object.values(event.groupedMarkets)) {
      for (const group of groups) {
        const groupKey = normalizeWcMarketKey(group.marketKey);
        if (groupKey !== key && group.marketKey !== key) continue;
        const hit = group.outcomes.find((o) => {
          if (o.outcomeKey !== outcomeKey) return false;
          if (isTotalsMarketKey(key) && line != null) {
            return String(o.point) === String(line);
          }
          return true;
        });
        if (hit) return hit.price;
      }
    }
  }

  for (const groups of Object.values(event.groupedMarkets)) {
    for (const group of groups) {
      const hit = group.outcomes.find((o) => o.outcomeKey === outcomeKey);
      if (hit) return hit.price;
    }
  }

  return null;
}

export function buildWcDcRate(
  event: WcEvent,
  label: "1X" | "12" | "X2",
  odd: number,
): Rate {
  const outcomeKey =
    label === "1X" ? "DC_1X" : label === "12" ? "DC_12" : "DC_X2";
  return buildWcMarketRate(
    event,
    { outcomeKey, name: label, price: odd },
    "double_chance",
    "Двойной шанс",
  );
}

export function wcEventContextFields(event: WcEvent | WcEventDetail): Partial<Rate> {
  const isLive = event.phase === "live";
  return {
    sport: event.sport,
    leagueName: event.leagueName,
    wcPhase: event.phase,
    homeTeam: event.homeTeam,
    awayTeam: event.awayTeam,
    homeScore: event.homeScore,
    awayScore: event.awayScore,
    isLive,
    wcCommenceTime: event.commenceTime,
    wcCompleted: event.completed,
    wcLiveTimeLabel: isLive
      ? formatWcRowLiveTime(event.parsedScore, event.sport) ?? undefined
      : undefined,
  };
}

export function mergeWcEventIntoRate(rate: Rate, event: WcEvent | WcEventDetail): Rate {
  return { ...rate, ...wcEventContextFields(event) };
}

export function buildWcRate(event: WcEvent, pick: WcPick, odd: number): Rate {
  const bettingOpen = isWcEventBettingOpen(event);
  return {
    source: WC_ODDS_SOURCE,
    wcPick: pick,
    wcMarketKey: "h2h",
    wcOutcomeKey: pick,
    coef: odd.toFixed(2),
    eventId: event.id,
    eventName: `${event.homeTeam} — ${event.awayTeam}`,
    market: WC_MARKET[pick],
    title: WC_PICK_LABEL[pick],
    isOpen: bettingOpen,
    isAvailable: bettingOpen,
    ...wcEventContextFields(event),
  };
}

function extractTotalsLine(outcome: WcMarketOutcome, groupLabel: string): string | null {
  if (outcome.point != null) return String(outcome.point);
  const fromKey = outcome.outcomeKey.match(/^(OVER|UNDER)_(.+)$/);
  if (fromKey) return fromKey[2];
  const fromLabel = groupLabel.match(/([\d]+(?:[.,]\d+)?)/);
  return fromLabel ? fromLabel[1].replace(",", ".") : null;
}

function totalsSideLabel(outcome: WcMarketOutcome): string {
  if (outcome.outcomeKey.startsWith("UNDER")) return "Меньше";
  if (outcome.outcomeKey.startsWith("OVER")) return "Больше";
  const name = outcome.name.trim();
  if (/^тм$|^м$|меньше/i.test(name)) return "Меньше";
  if (/^тб$|^б$|больше/i.test(name)) return "Больше";
  return outcome.name;
}

function dedupeScopeTokens(label: string): string {
  return label.replace(
    /(\d+-[йи]\s+(?:сет|гейм|тайм|четверть))(?:\s+\1)+/gi,
    "$1",
  );
}

function lineAlreadyInLabel(label: string, line: string): boolean {
  const pattern = line.replace(".", "[.,]");
  return new RegExp(`\\b${pattern}\\b`).test(label);
}

/** Normalize stored or generated bet labels for display. */
export function sanitizeWcBetLabel(raw: string | null | undefined): string {
  if (!raw?.trim()) return "Ставка";
  let label = dedupeScopeTokens(raw.trim());
  label = label.replace(
    /(тотал[^—]*?\b[\d.,]+)\s+\1\s*(—)/i,
    "$1 $2",
  );
  return label.replace(/\s+/g, " ").trim();
}

/** Human-readable coupon title for WC market outcomes. */
export function buildWcMarketRateTitle(
  marketKey: string,
  groupLabel: string,
  outcome: WcMarketOutcome,
): string {
  const key = normalizeWcMarketKey(marketKey);

  if (key === "totals" || key === "totals_home" || key === "totals_away") {
    const line = extractTotalsLine(outcome, groupLabel);
    const side = totalsSideLabel(outcome);
    const otSuffix = isOvertimeMarketKey(marketKey) ? " (с ОТ)" : "";
    const setScope = groupLabel.match(/(\d+-[йи]\s+сет)/i)?.[1];
    const gameScope = groupLabel.match(/(\d+-[йи]\s+гейм)/i)?.[1];
    let base = /тотал/i.test(groupLabel)
      ? groupLabel.replace(/\s*[\d.,]+\s*$/, "").trim() || groupLabel
      : setScope
        ? gameScope
          ? `${setScope}, ${gameScope} — Тотал`
          : `${setScope} — Тотал`
        : gameScope
          ? `${gameScope} — Тотал`
          : key === "totals_home"
            ? "Инд. тотал хозяев"
            : key === "totals_away"
              ? "Инд. тотал гостей"
              : "Тотал";
    if (!/с\s*ОТ/i.test(base)) base = `${base}${otSuffix}`;
    base = dedupeScopeTokens(base);
    if (line) {
      return lineAlreadyInLabel(base, line)
        ? `${base} — ${side}`
        : `${base} ${line} — ${side}`;
    }
    return `${groupLabel} — ${side}`;
  }

  if (key === "even_odd") {
    const side =
      outcome.outcomeKey === "EVEN" ? "Чет" : outcome.outcomeKey === "ODD" ? "Нечет" : outcome.name;
    const base = /чет/i.test(groupLabel) && /нечет/i.test(groupLabel) ? groupLabel : "Тотал (Чет/Нечет)";
    return `${base} — ${side}`;
  }

  if (key === "handicap" && /ф[12]/i.test(outcome.name)) {
    if (/\d+-[яй]\s+(?:четверть|тайм)/i.test(groupLabel)) {
      return `${groupLabel}: ${outcome.name}`;
    }
    return outcome.name;
  }

  const scoreOnly = outcome.name.trim().match(/^(\d+:\d+)/);
  if (
    scoreOnly
    && (/гейм|сч[её]t/i.test(groupLabel) || /SCORE_SET|EXACT_POINT/i.test(marketKey))
  ) {
    const gamePart = groupLabel.match(/(\d+-й\s*гейм)/i);
    if (gamePart) return `${gamePart[1]} — ${scoreOnly[1]}`;
    return scoreOnly[1]!;
  }

  if (/WINNER_SET/i.test(marketKey) && /^[ПP][12]$/i.test(outcome.name.trim())) {
    const scope = groupLabel.match(/(\d+-й\s*гейм)/i);
    if (scope) return `${scope[1]} — ${outcome.name.trim().replace(/^P/i, "П")}`;
    return outcome.name.trim().replace(/^P/i, "П");
  }

  if (/MULTISCORE/i.test(marketKey) && /^\d+:\d+(,\s*\d+:\d+)*$/.test(outcome.name.trim())) {
    return outcome.name.trim();
  }

  return `${groupLabel}: ${outcome.name}`;
}

export function buildWcMarketRate(
  event: WcEvent,
  outcome: WcMarketOutcome,
  marketKey: string,
  groupLabel: string,
  groupKey?: string,
): Rate {
  const line = outcome.point != null ? String(outcome.point) : undefined;
  const bettingOpen = isWcEventBettingOpen(event);
  return {
    source: WC_ODDS_SOURCE,
    wcMarketKey: marketKey,
    wcGroupKey: groupKey,
    wcOutcomeKey: outcome.outcomeKey,
    wcLine: line,
    coef: outcome.price.toFixed(2),
    eventId: event.id,
    eventName: `${event.homeTeam} — ${event.awayTeam}`,
    market: wcMarketId(marketKey, outcome.outcomeKey, groupKey),
    title: buildWcMarketRateTitle(marketKey, groupLabel, outcome),
    isOpen: bettingOpen,
    isAvailable: bettingOpen,
    ...wcEventContextFields(event),
  };
}

export function getWcBetLabel(bet: {
  pick?: WcPick | null;
  outcomeName?: string | null;
  marketKey?: string;
}): string {
  if (bet.outcomeName) return sanitizeWcBetLabel(bet.outcomeName);
  if (bet.pick && WC_PICK_LABEL[bet.pick]) return WC_PICK_LABEL[bet.pick];
  if (bet.marketKey === "totals") return "Тотал";
  if (bet.marketKey === "btts") return "Обе забьют";
  if (bet.marketKey === "handicap") return "Фора";
  return "Ставка";
}
