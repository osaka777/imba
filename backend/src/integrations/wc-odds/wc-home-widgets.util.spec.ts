import { buildHomepageWidgets, isWorldCupLeague } from './wc-home-widgets.util';
import type { WcOddsEventDto } from './wc-odds.types';

describe('buildHomepageWidgets', () => {
  const base = (
    id: string,
    sport: string,
    opts: Partial<WcOddsEventDto> = {},
  ): WcOddsEventDto => ({
    id,
    slug: id,
    sport,
    leagueName: 'League',
    tournamentId: null,
    homeTeam: 'A',
    awayTeam: 'B',
    commenceTime: new Date().toISOString(),
    oddsHome: 1.9,
    oddsDraw: 3.2,
    oddsAway: 2.1,
    totalLine: null,
    oddsOver: null,
    oddsUnder: null,
    bookmaker: 'olimp',
    completed: false,
    homeScore: null,
    awayScore: null,
    bettingOpen: true,
    phase: 'prematch',
    oddsUpdatedAt: null,
    marketsCount: 3,
    odds1X: null,
    odds12: null,
    oddsX2: null,
    priorityLevel: 0,
    isPriority: false,
    ...opts,
  });

  it('detects world cup leagues', () => {
    expect(isWorldCupLeague('Чемпионат мира 2026. США-Канада-Мексика. 1/8 финала')).toBe(true);
    expect(isWorldCupLeague('Wimbledon')).toBe(false);
  });

  it('puts prematch line first, then mixed wc soccer and cs2', () => {
    const pool = [
      base('wc-live', 'soccer', {
        leagueName: 'Чемпионат мира 2026',
        phase: 'live',
        priorityLevel: 2,
        isPriority: true,
      }),
      base('wc-line', 'soccer', {
        leagueName: 'Чемпионат мира 2026. 1/8 финала',
        phase: 'prematch',
        priorityLevel: 2,
        isPriority: true,
      }),
      base('wc-next', 'soccer', {
        leagueName: 'Чемпионат мира 2026. 1/4 финала',
        phase: 'prematch',
        priorityLevel: 1,
        isPriority: true,
      }),
      base('tennis', 'tennis', { phase: 'prematch', priorityLevel: 2, isPriority: true }),
    ];

    const items = buildHomepageWidgets(pool, {
      game: {
        eventId: 'cy-1',
        eventName: 'A — B',
        team1: 'A',
        team2: 'B',
        team1Icon: 'https://logo/a.png',
        team2Icon: 'https://logo/b.png',
        sport: 'esports.cs',
        leagueName: 'CS',
        score: '',
        parsedScore: { currentScore: [0, 0], text: { currentScore: '0:0' } },
        status: 'PREMATCH' as never,
        createdAt: new Date(),
        updatedAt: new Date(),
        groupedMarkets: {},
      },
      isLive: false,
    });

    expect(items).toHaveLength(4);
    expect(items[0]?.kind).toBe('wc');
    if (items[0]?.kind === 'wc') {
      expect(items[0].event.id).toBe('wc-line');
      expect(items[0].event.phase).toBe('prematch');
    }
    expect(items.filter((item) => item.kind === 'wc' && item.event.sport === 'tennis')).toHaveLength(0);
    expect(items[3]?.kind).toBe('cyber');
  });
});
