import type { OlimpbetEventDetail } from './olimpbet-wc.types';
import { mergeOlimpbetProbabilityDetails } from './olimpbet-settlement-detail.util';

describe('mergeOlimpbetProbabilityDetails', () => {
  it('merges probabilities from linked special-bets event', () => {
    const main: OlimpbetEventDetail = {
      id: 1,
      competitors: [],
      eventDate: '',
      probabilities: {
        eventId: 1,
        markets: [{ marketId: 10, probabilities: [{ outcomeTypeId: 1, odd: 2 }] }],
      },
    };

    const linked: OlimpbetEventDetail = {
      id: 2,
      competitors: [],
      eventDate: '',
      probabilities: {
        eventId: 2,
        markets: [{ marketId: 1565, probabilities: [{ outcomeTypeId: 2355, odd: 12, tradingStatus: 'LOST' }] }],
      },
    };

    const merged = mergeOlimpbetProbabilityDetails(main, [linked]);
    expect(merged.probabilities?.markets).toHaveLength(2);
    expect(merged.probabilities?.markets?.some((m) => m.marketId === 1565)).toBe(true);
  });
});
