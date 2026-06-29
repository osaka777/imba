import type { OlimpbetEventDetail } from './olimpbet-wc.types';
import {
  isOlimpbetEventCompleted,
  isOlimpbetFeedBettingOpen,
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
});
