import type { OlimpbetEventDetail } from '../../olimpbet-wc/olimpbet-wc.types';
import type { WcParsedScore } from '../wc-odds-statistics.types';
import type { WcBetProbeEventDetail } from './types';

function detailsToScoresByPeriods(details?: WcParsedScore['details']): string | null {
  if (!details?.length) return null;
  return details.map(([home, away]) => `${home}:${away}`).join(',');
}

/** Reconstruct minimal Olimpbet detail from public feed DTO for settlement checks. */
export function buildOlimpbetDetailFromPublicEvent(event: WcBetProbeEventDetail): OlimpbetEventDetail {
  const statistics: Array<{ code: string; value: string }> = [];

  const scoresByPeriods =
    detailsToScoresByPeriods(event.parsedScore?.details)
    ?? null;
  if (scoresByPeriods) {
    statistics.push({ code: 'scores_by_periods', value: scoresByPeriods });
  }

  if (event.homeScore != null && event.awayScore != null) {
    statistics.push({ code: 'score', value: `${event.homeScore}:${event.awayScore}` });
  }

  if (event.parsedScore?.period != null && event.parsedScore.period !== '') {
    statistics.push({ code: 'match_phase', value: String(event.parsedScore.period) });
  }

  if (event.parsedScore?.text?.liveScore) {
    statistics.push({ code: 'game_score', value: String(event.parsedScore.text.liveScore) });
  }

  if (event.parsedScore?.liveScore?.active === 1 || event.parsedScore?.liveScore?.active === 2) {
    statistics.push({
      code: 'current_server',
      value: String(event.parsedScore.liveScore.active),
    });
  }

  const live = event.phase === 'live';
  const completed = event.completed === true;
  let status = event.feedStatus ?? 'EVENT_TRADING';
  if (completed && !event.feedStatus) status = 'EVENT_FINISHED';

  return {
    id: event.olimpbetEventId ?? 0,
    competitors: [],
    eventDate: event.commenceTime,
    live,
    status,
    score:
      event.homeScore != null && event.awayScore != null
        ? { home: event.homeScore, away: event.awayScore }
        : undefined,
    statistics,
  } as OlimpbetEventDetail;
}
