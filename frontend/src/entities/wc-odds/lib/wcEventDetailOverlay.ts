import type { WcEvent, WcEventDetail, WcGroupedMarkets, WcMarketOutcome } from "~/entities/wc-odds/api/client";

export function wcOddsTimestampMs(value: string | null | undefined): number {
  if (!value) return 0;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

export function isWcOddsFresher(
  candidate: string | null | undefined,
  baseline: string | null | undefined,
): boolean {
  return wcOddsTimestampMs(candidate) > wcOddsTimestampMs(baseline);
}

function normalizeMarketKey(marketKey: string): string {
  const key = marketKey.trim().toLowerCase();
  if (key === "h2h" || key.includes("match_winner") || key === "1x2") return "h2h";
  if (key.includes("double_chance") || key === "dc") return "double_chance";
  if (key === "totals" || key.startsWith("totals")) return key.startsWith("totals_") ? key : "totals";
  return key;
}

function patchOutcomePrice(
  outcomes: WcMarketOutcome[],
  outcomeKey: string,
  price: number | null | undefined,
): WcMarketOutcome[] {
  if (price == null || !Number.isFinite(price) || price <= 1) return outcomes;
  let changed = false;
  const next = outcomes.map((outcome) => {
    if (outcome.outcomeKey !== outcomeKey || outcome.price === price) return outcome;
    changed = true;
    return { ...outcome, price };
  });
  return changed ? next : outcomes;
}

function isMainMatchTotalsCategory(category: string, label: string): boolean {
  if (category !== "Тотал" && category !== "Тотал (с ОТ)" && category !== "Total" && category !== "Total (incl. OT)") {
    return false;
  }
  return !/тайм|половин|сет|карта|четверть|период|угл|фол|карт|азиат|3\s*исход|индивид|half|quarter|period|set\b|map\b|corner|card|asian|3-?way|individual|team\s*total/i.test(
    `${category} ${label}`,
  );
}

export function patchGroupedMarketsFromListScalars(
  grouped: WcGroupedMarkets,
  list: Pick<
    WcEvent,
    | "oddsHome"
    | "oddsDraw"
    | "oddsAway"
    | "oddsOver"
    | "oddsUnder"
    | "totalLine"
    | "odds1X"
    | "odds12"
    | "oddsX2"
  >,
): WcGroupedMarkets {
  if (!grouped || Object.keys(grouped).length === 0) return grouped;

  let changed = false;
  const next: WcGroupedMarkets = {};

  for (const [category, groups] of Object.entries(grouped)) {
    next[category] = groups.map((group) => {
      const mk = normalizeMarketKey(group.marketKey);
      let outcomes = group.outcomes;

      if (mk === "h2h") {
        const before = outcomes;
        outcomes = patchOutcomePrice(outcomes, "HOME", list.oddsHome);
        outcomes = patchOutcomePrice(outcomes, "DRAW", list.oddsDraw);
        outcomes = patchOutcomePrice(outcomes, "AWAY", list.oddsAway);
        if (outcomes !== before) changed = true;
      } else if (mk === "double_chance") {
        const before = outcomes;
        outcomes = patchOutcomePrice(outcomes, "1X", list.odds1X);
        outcomes = patchOutcomePrice(outcomes, "12", list.odds12);
        outcomes = patchOutcomePrice(outcomes, "X2", list.oddsX2);
        if (outcomes !== before) changed = true;
      } else if (
        mk === "totals"
        && list.totalLine != null
        && isMainMatchTotalsCategory(category, group.label)
      ) {
        const line = String(list.totalLine);
        const before = outcomes;
        let patched = outcomes;
        for (const outcome of outcomes) {
          if (outcome.point == null || String(outcome.point) !== line) continue;
          if (outcome.outcomeKey.startsWith("OVER") && list.oddsOver != null) {
            patched = patchOutcomePrice(patched, outcome.outcomeKey, list.oddsOver);
          } else if (outcome.outcomeKey.startsWith("UNDER") && list.oddsUnder != null) {
            patched = patchOutcomePrice(patched, outcome.outcomeKey, list.oddsUnder);
          }
        }
        outcomes = patched;
        if (outcomes !== before) changed = true;
      }

      return outcomes === group.outcomes ? group : { ...group, outcomes };
    });
  }

  return changed ? next : grouped;
}

function scoresConflict(
  detail: Pick<WcEvent, "homeScore" | "awayScore">,
  list: Pick<WcEvent, "homeScore" | "awayScore">,
): boolean {
  return (
    detail.homeScore != null
    && detail.awayScore != null
    && list.homeScore != null
    && list.awayScore != null
    && (detail.homeScore !== list.homeScore || detail.awayScore !== list.awayScore)
  );
}

/**
 * Prefer live/line card scalars only when they are genuinely fresher and agree
 * on the score. Never let a stale list stamp overwrite detail 1X2 / scoreboard.
 */
export function overlayEventDetailFromList(
  detail: WcEventDetail,
  list: WcEvent | null | undefined,
): WcEventDetail {
  if (!list) return detail;

  const listFresher = isWcOddsFresher(list.oddsUpdatedAt, detail.oddsUpdatedAt);
  const detailMissingClock = !detail.parsedScore && !(detail.statList?.length);
  const detailMissingOdds = detail.oddsHome == null && detail.oddsAway == null;
  const conflict = scoresConflict(detail, list);

  if (conflict) {
    if (!detailMissingClock && !detailMissingOdds) return detail;
  }

  if (!listFresher && !detailMissingClock && !detailMissingOdds) return detail;

  const next: WcEventDetail = { ...detail };
  const applyOdds = (listFresher && !conflict) || detailMissingOdds;
  const applyScore = (listFresher && !conflict)
    || detail.homeScore == null
    || detail.awayScore == null;

  if (applyOdds) {
    if (listFresher || detail.oddsHome == null) next.oddsHome = list.oddsHome ?? detail.oddsHome;
    if (listFresher || detail.oddsDraw == null) next.oddsDraw = list.oddsDraw ?? detail.oddsDraw;
    if (listFresher || detail.oddsAway == null) next.oddsAway = list.oddsAway ?? detail.oddsAway;
    if (listFresher || detail.oddsOver == null) next.oddsOver = list.oddsOver ?? detail.oddsOver;
    if (listFresher || detail.oddsUnder == null) next.oddsUnder = list.oddsUnder ?? detail.oddsUnder;
    if (listFresher || detail.totalLine == null) next.totalLine = list.totalLine ?? detail.totalLine;
    if (listFresher || detail.odds1X == null) next.odds1X = list.odds1X ?? detail.odds1X;
    if (listFresher || detail.odds12 == null) next.odds12 = list.odds12 ?? detail.odds12;
    if (listFresher || detail.oddsX2 == null) next.oddsX2 = list.oddsX2 ?? detail.oddsX2;
    if (listFresher && list.oddsUpdatedAt) next.oddsUpdatedAt = list.oddsUpdatedAt;
    if (listFresher && list.marketsCount > 0) next.marketsCount = list.marketsCount;
    if (listFresher) {
      next.groupedMarkets = patchGroupedMarketsFromListScalars(detail.groupedMarkets, list);
    }
  }

  if (applyScore) {
    if (list.homeScore != null && (listFresher || detail.homeScore == null)) {
      next.homeScore = list.homeScore;
    }
    if (list.awayScore != null && (listFresher || detail.awayScore == null)) {
      next.awayScore = list.awayScore;
    }
    if (list.phase && (listFresher || !detail.phase)) next.phase = list.phase;
    if (list.bettingOpen != null && (listFresher || detail.bettingOpen == null)) {
      next.bettingOpen = list.bettingOpen;
    }
    if (list.feedStatus != null && (listFresher || detail.feedStatus == null)) {
      next.feedStatus = list.feedStatus;
    }
    if (list.parsedScore && (listFresher || detailMissingClock || !detail.parsedScore)) {
      next.parsedScore = list.parsedScore;
    }
    if (list.statList?.length && (listFresher || detailMissingClock || !detail.statList?.length)) {
      next.statList = list.statList;
    }
  }

  return next;
}
