import { buildHomepageWidgets } from './wc-home-widgets.util';
import type { WcOddsEventDto } from './wc-odds.types';

describe('buildHomepageWidgets', () => {
  const base = (id: string, sport: string, priorityLevel = 0): WcOddsEventDto => ({
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
    priorityLevel,
    isPriority: priorityLevel > 0,
  });

  it('picks 2 soccer, 1 tennis and optional cs2', () => {
    const pool = [
      base('s1', 'soccer', 2),
      base('s2', 'soccer', 1),
      base('s3', 'soccer'),
      base('t1', 'tennis', 2),
      base('t2', 'tennis'),
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
    expect(items.filter((item) => item.kind === 'wc' && item.event.sport === 'soccer')).toHaveLength(2);
    expect(items.filter((item) => item.kind === 'wc' && item.event.sport === 'tennis')).toHaveLength(1);
    expect(items[3]?.kind).toBe('cyber');
  });
});
