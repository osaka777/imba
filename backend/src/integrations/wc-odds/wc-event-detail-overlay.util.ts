import { patchGroupedMarketsFromListScalars } from './wc-odds-markets.util';
import type { WcOddsEventDetailDto, WcOddsEventDto } from './wc-odds.types';

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

type ListOverlaySource = Pick<
  WcOddsEventDto,
  | 'oddsHome'
  | 'oddsDraw'
  | 'oddsAway'
  | 'oddsOver'
  | 'oddsUnder'
  | 'totalLine'
  | 'odds1X'
  | 'odds12'
  | 'oddsX2'
  | 'oddsUpdatedAt'
  | 'homeScore'
  | 'awayScore'
  | 'phase'
  | 'bettingOpen'
  | 'parsedScore'
  | 'statList'
  | 'marketsCount'
  | 'feedStatus'
>;

function scoresConflict(
  detail: Pick<WcOddsEventDto, 'homeScore' | 'awayScore'>,
  list: Pick<WcOddsEventDto, 'homeScore' | 'awayScore'>,
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
 * When opening a match detail page, list live/line caches are often fresher than
 * a cold full-markets `eventCache`. Overlay carefully:
 * - never overwrite detail score/1X2 when list score disagrees (stale list can have
 *   a bumped oddsUpdatedAt from oddsOnly TTL hits);
 * - only fill missing clock/odds when detail is empty.
 */
export function overlayEventDetailFromList(
  detail: WcOddsEventDetailDto,
  list: ListOverlaySource | null | undefined,
): WcOddsEventDetailDto {
  if (!list) return detail;

  const listFresher = isWcOddsFresher(list.oddsUpdatedAt, detail.oddsUpdatedAt);
  const detailMissingClock = !detail.parsedScore && !(detail.statList?.length);
  const detailMissingOdds = detail.oddsHome == null && detail.oddsAway == null;
  const conflict = scoresConflict(detail, list);

  // Stale list with a newer stamp but wrong score must not poison 1X2 / scoreboard.
  if (conflict) {
    if (!detailMissingClock && !detailMissingOdds) return detail;
  }

  if (!listFresher && !detailMissingClock && !detailMissingOdds) return detail;

  const next: WcOddsEventDetailDto = { ...detail };
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
