import {
  overlayEventDetailFromList,
  isWcOddsFresher,
} from './wc-event-detail-overlay.util';
import { patchGroupedMarketsFromListScalars } from './wc-odds-markets.util';
import type { WcOddsEventDetailDto } from './wc-odds.types';

function baseDetail(overrides: Partial<WcOddsEventDetailDto> = {}): WcOddsEventDetailDto {
  return {
    id: 'ol-1',
    slug: 'test-match',
    sport: 'soccer',
    leagueName: 'Test',
    tournamentId: null,
    homeTeam: 'Home',
    awayTeam: 'Away',
    commenceTime: '2026-06-28T12:00:00.000Z',
    oddsHome: 2.1,
    oddsDraw: 3.2,
    oddsAway: 3.5,
    totalLine: 2.5,
    oddsOver: 1.9,
    oddsUnder: 1.9,
    bookmaker: 'wc',
    completed: false,
    homeScore: 0,
    awayScore: 0,
    bettingOpen: true,
    phase: 'live',
    oddsUpdatedAt: '2026-06-28T12:00:00.000Z',
    marketsCount: 1,
    odds1X: 1.4,
    odds12: 1.5,
    oddsX2: 1.6,
    groupedMarkets: {
      '1X2': [
        {
          key: 'h2h-main',
          marketKey: 'h2h',
          label: '1X2',
          outcomes: [
            { name: 'П1', price: 2.1, outcomeKey: 'HOME' },
            { name: 'X', price: 3.2, outcomeKey: 'DRAW' },
            { name: 'П2', price: 3.5, outcomeKey: 'AWAY' },
          ],
        },
      ],
    },
    ...overrides,
  };
}

describe('overlayEventDetailFromList', () => {
  it('prefers fresher list odds and patches main 1X2 markets', () => {
    const detail = baseDetail();
    const next = overlayEventDetailFromList(detail, {
      oddsHome: 1.95,
      oddsDraw: 3.4,
      oddsAway: 3.8,
      oddsOver: null,
      oddsUnder: null,
      totalLine: null,
      odds1X: 1.35,
      odds12: 1.45,
      oddsX2: 1.55,
      oddsUpdatedAt: '2026-06-28T12:00:10.000Z',
      homeScore: 0,
      awayScore: 0,
      phase: 'live',
      bettingOpen: true,
      parsedScore: null,
      marketsCount: 12,
    });

    expect(next.oddsHome).toBe(1.95);
    expect(next.groupedMarkets['1X2'][0].outcomes[0].price).toBe(1.95);
    expect(isWcOddsFresher(next.oddsUpdatedAt, detail.oddsUpdatedAt)).toBe(true);
  });

  it('does not regress fresher detail when list is older', () => {
    const detail = baseDetail({ oddsUpdatedAt: '2026-06-28T12:00:20.000Z', oddsHome: 1.8 });
    const next = overlayEventDetailFromList(detail, {
      oddsHome: 2.5,
      oddsDraw: 3.2,
      oddsAway: 3.5,
      oddsUpdatedAt: '2026-06-28T12:00:00.000Z',
      homeScore: 0,
      awayScore: 0,
      phase: 'live',
      bettingOpen: true,
      marketsCount: 1,
    });

    expect(next.oddsHome).toBe(1.8);
  });

  it('does not poison 1X2/score when list score conflicts (even with newer stamp)', () => {
    const detail = baseDetail({
      homeScore: 1,
      awayScore: 0,
      oddsHome: 1.41,
      oddsDraw: 3.64,
      oddsAway: 14,
      oddsUpdatedAt: '2026-06-28T12:00:05.000Z',
      groupedMarkets: {
        '1X2': [
          {
            key: 'h2h-main',
            marketKey: 'h2h',
            label: '1X2',
            outcomes: [
              { name: 'П1', price: 1.41, outcomeKey: 'HOME' },
              { name: 'X', price: 3.64, outcomeKey: 'DRAW' },
              { name: 'П2', price: 14, outcomeKey: 'AWAY' },
            ],
          },
        ],
      },
    });

    const next = overlayEventDetailFromList(detail, {
      oddsHome: 9.75,
      oddsDraw: 1.17,
      oddsAway: 8.75,
      oddsUpdatedAt: '2026-06-28T12:00:30.000Z',
      homeScore: 1,
      awayScore: 1,
      phase: 'live',
      bettingOpen: true,
      marketsCount: 12,
      parsedScore: null,
    });

    expect(next.homeScore).toBe(1);
    expect(next.awayScore).toBe(0);
    expect(next.oddsHome).toBe(1.41);
    expect(next.groupedMarkets['1X2'][0].outcomes[0].price).toBe(1.41);
  });
});

describe('patchGroupedMarketsFromListScalars', () => {
  it('updates matching totals line', () => {
    const grouped = {
      Тотал: [
        {
          key: 't',
          marketKey: 'totals',
          label: 'Тотал 2.5',
          outcomes: [
            { name: 'ТБ', price: 1.9, point: 2.5, outcomeKey: 'OVER_2.5' },
            { name: 'ТМ', price: 1.9, point: 2.5, outcomeKey: 'UNDER_2.5' },
          ],
        },
      ],
    };

    const next = patchGroupedMarketsFromListScalars(grouped, {
      oddsOver: 1.75,
      oddsUnder: 2.05,
      totalLine: 2.5,
    });

    expect(next.Тотал[0].outcomes[0].price).toBe(1.75);
    expect(next.Тотал[0].outcomes[1].price).toBe(2.05);
  });
});
