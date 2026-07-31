import type { OlimpbetEventDetail } from './olimpbet-wc.types';
import {
  isOlimpbetEventCancelled,
  isOlimpbetEventCompleted,
  isOlimpbetFeedBettingOpen,
  resolveOlimpbetEventResult,
} from './olimpbet-event-result.util';

function detail(partial: Partial<OlimpbetEventDetail>): OlimpbetEventDetail {
  return {
    id: 1,
    competitors: [],
    eventDate: new Date(Date.now() - 2 * 3_600_000).toISOString(),
    ...partial,
  } as OlimpbetEventDetail;
}

describe('isOlimpbetFeedBettingOpen', () => {
  it('closes when status is EVENT_ENDED', () => {
    expect(isOlimpbetFeedBettingOpen(detail({ status: 'EVENT_ENDED', live: false }))).toBe(false);
  });

  it('closes when kickoff passed and no trading markets remain', () => {
    expect(isOlimpbetFeedBettingOpen(detail({
      status: 'EVENT_SUSPENDED',
      live: true,
      probabilities: { eventId: 1, markets: [] },
    }))).toBe(false);
  });

  it('stays open while main markets trade', () => {
    expect(isOlimpbetFeedBettingOpen(detail({
      status: 'EVENT_TRADING',
      live: true,
      probabilities: {
        eventId: 1,
        markets: [{
          marketId: 1,
          probabilities: [{ outcomeTypeId: 1, odd: 2.1, tradingStatus: 'PROBABILITY_TRADING' }],
        }],
      },
    }))).toBe(true);
  });

  it('closes prematch when all outcomes are suspended', () => {
    expect(isOlimpbetFeedBettingOpen(detail({
      status: 'EVENT_OPEN',
      live: false,
      eventDate: new Date(Date.now() + 3_600_000).toISOString(),
      probabilities: {
        eventId: 1,
        markets: [{
          marketId: 1,
          probabilities: [{
            outcomeTypeId: 1,
            odd: 2.1,
            tradingStatus: 'PROBABILITY_SUSPENDED',
          }],
        }],
      },
    }))).toBe(false);
  });
});

describe('isOlimpbetEventCompleted', () => {
  it('completes when dropped from live feed without markets', () => {
    expect(isOlimpbetEventCompleted(detail({
      status: 'EVENT_SUSPENDED',
      live: false,
      statistics: [{ code: 'score', value: '1:1' }],
      probabilities: { eventId: 1, markets: [] },
    }))).toBe(true);
  });

  it('does not complete live feed when outcomes stripped during play (VAR pause)', () => {
    expect(isOlimpbetEventCompleted(detail({
      status: 'EVENT_TRADING',
      live: true,
      eventDate: new Date(Date.now() - 70 * 60_000).toISOString(),
      statistics: [
        { code: 'score', value: '2:0' },
        { code: 'match_phase', value: '4' },
        { code: 'current_time', value: '84:28' },
      ],
      probabilities: {
        eventId: 8267962,
        markets: [{ marketId: 1, probabilities: [] }, { marketId: 2, probabilities: [] }],
      },
    }))).toBe(false);
  });

  it('completes live zombie feed when match_phase is finished and outcomes were stripped', () => {
    expect(isOlimpbetEventCompleted(detail({
      status: 'EVENT_TRADING',
      live: true,
      eventDate: new Date(Date.now() - 70 * 60_000).toISOString(),
      statistics: [
        { code: 'score', value: '2:0' },
        { code: 'match_phase', value: '100' },
      ],
      probabilities: {
        eventId: 8267962,
        markets: [{ marketId: 1, probabilities: [] }, { marketId: 2, probabilities: [] }],
      },
    }))).toBe(true);
  });

  it('completes on tennis retirement match_phase', () => {
    expect(isOlimpbetEventCompleted(detail({
      status: 'EVENT_ENDED',
      live: false,
      statistics: [
        { code: 'score', value: '1:1' },
        { code: 'match_phase', value: '95' },
      ],
    }))).toBe(true);
  });

  it('does not complete premature EVENT_ENDED while still live in 2nd half', () => {
    expect(isOlimpbetEventCompleted(detail({
      status: 'EVENT_ENDED',
      live: true,
      eventDate: new Date(Date.now() - 95 * 60_000).toISOString(),
      statistics: [
        { code: 'score', value: '1:1' },
        { code: 'match_phase', value: '4' },
        { code: 'current_time', value: '90:00' },
      ],
      probabilities: {
        eventId: 1,
        markets: [{ marketId: 1, probabilities: [{ outcomeTypeId: 1, odd: 1.5, tradingStatus: 'PROBABILITY_TRADING' }] }],
      },
    }))).toBe(false);
  });

  it('does not complete premature EVENT_ENDED while still live in extra time', () => {
    expect(isOlimpbetEventCompleted(detail({
      status: 'EVENT_ENDED',
      live: true,
      eventDate: new Date(Date.now() - 100 * 60_000).toISOString(),
      statistics: [
        { code: 'score', value: '1:1' },
        { code: 'match_phase', value: '41' },
        { code: 'current_time', value: '91:00' },
      ],
      probabilities: {
        eventId: 1,
        markets: [{ marketId: 1, probabilities: [{ outcomeTypeId: 1, odd: 1.5, tradingStatus: 'PROBABILITY_TRADING' }] }],
      },
    }))).toBe(false);
  });

  it('completes EVENT_ENDED when feed left live', () => {
    expect(isOlimpbetEventCompleted(detail({
      status: 'EVENT_ENDED',
      live: false,
      statistics: [
        { code: 'score', value: '3:2' },
        { code: 'match_phase', value: '4' },
      ],
    }))).toBe(true);
  });

  it('completes EVENT_ENDED while live when match_phase is finished', () => {
    expect(isOlimpbetEventCompleted(detail({
      status: 'EVENT_ENDED',
      live: true,
      statistics: [
        { code: 'score', value: '2:0' },
        { code: 'match_phase', value: '100' },
      ],
    }))).toBe(true);
  });
});

describe('isOlimpbetEventCancelled / resolveOlimpbetEventResult', () => {
  it('treats CANCEL status as cancelled refund', () => {
    expect(isOlimpbetEventCancelled(detail({ status: 'EVENT_CANCELLED' }))).toBe(true);
    expect(resolveOlimpbetEventResult(detail({
      status: 'EVENT_CANCELLED',
      live: false,
      statistics: [{ code: 'score', value: '0:0' }],
    }))).toEqual({ homeScore: 0, awayScore: 0, cancelled: true });
  });

  it('refunds tennis walkover (match_phase 93/94)', () => {
    expect(isOlimpbetEventCancelled(detail({
      status: 'EVENT_ENDED',
      statistics: [{ code: 'match_phase', value: '93' }],
    }))).toBe(true);

    expect(resolveOlimpbetEventResult(detail({
      status: 'EVENT_ENDED',
      live: false,
      statistics: [
        { code: 'score', value: '0:0' },
        { code: 'match_phase', value: '94' },
      ],
    }))).toEqual({ homeScore: 0, awayScore: 0, cancelled: true });
  });

  it('refunds tennis retirement / default (match_phase 95–98)', () => {
    for (const phase of ['95', '96', '97', '98']) {
      expect(isOlimpbetEventCancelled(detail({
        status: 'EVENT_ENDED',
        statistics: [{ code: 'match_phase', value: phase }],
      }))).toBe(true);
    }
  });

  it('does not cancel normal finished match (phase 100)', () => {
    expect(isOlimpbetEventCancelled(detail({
      status: 'EVENT_ENDED',
      statistics: [
        { code: 'score', value: '2:1' },
        { code: 'match_phase', value: '100' },
      ],
    }))).toBe(false);

    expect(resolveOlimpbetEventResult(detail({
      status: 'EVENT_ENDED',
      live: false,
      statistics: [
        { code: 'score', value: '2:1' },
        { code: 'match_phase', value: '100' },
      ],
    }))).toEqual({ homeScore: 2, awayScore: 1, cancelled: false });
  });
});
