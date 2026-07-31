import {
  buildHomepageWidgets,
  isBigTennisTournament,
  isWorldCupLeague,
  sortHomepageCyberLive,
} from './wc-home-widgets.util';
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

  it('detects big tennis tournaments', () => {
    expect(isBigTennisTournament('Wimbledon')).toBe(true);
    expect(isBigTennisTournament('ATP Challenger')).toBe(false);
  });

  it('puts football tops first, then tennis/CS2 by priority', () => {
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
      base('soccer-extra', 'soccer', {
        leagueName: 'Premier League',
        phase: 'prematch',
        priorityLevel: 1,
        isPriority: true,
      }),
      base('tennis-slam', 'tennis', {
        leagueName: 'Wimbledon',
        phase: 'live',
        priorityLevel: 2,
        isPriority: true,
      }),
    ];

    const items = buildHomepageWidgets(pool, [
      {
        game: {
          eventId: 'cy-dota',
          eventName: 'A — B',
          team1: 'A',
          team2: 'B',
          team1Icon: 'https://logo/a.png',
          team2Icon: 'https://logo/b.png',
          sport: 'esports.dota2',
          leagueName: 'Dota',
          score: '',
          parsedScore: { currentScore: [0, 0], text: { currentScore: '0:0' } },
          status: 'PREMATCH' as never,
          createdAt: new Date(),
          updatedAt: new Date(),
          groupedMarkets: {},
          priority: 0,
        } as never,
        isLive: true,
      },
      {
        game: {
          eventId: 'cy-cs2',
          eventName: 'C — D',
          team1: 'C',
          team2: 'D',
          team1Icon: 'https://logo/c.png',
          team2Icon: 'https://logo/d.png',
          sport: 'esports.cs',
          leagueName: 'CS',
          score: '',
          parsedScore: { currentScore: [1, 0], text: { currentScore: '1:0' } },
          status: 'IN_PROGRESS' as never,
          createdAt: new Date(),
          updatedAt: new Date(),
          groupedMarkets: {},
          priority: 2,
        } as never,
        isLive: true,
      },
    ]);

    expect(items.length).toBeGreaterThanOrEqual(5);
    expect(items[0]?.kind).toBe('wc');
    if (items[0]?.kind === 'wc') {
      expect(items[0].event.sport).toBe('soccer');
      expect(items[0].event.phase).toBe('prematch');
    }

    const firstNonSoccer = items.findIndex(
      (item) => !(item.kind === 'wc' && item.event.sport === 'soccer'),
    );
    expect(firstNonSoccer).toBeGreaterThanOrEqual(3);

    const afterSoccer = items.slice(firstNonSoccer);
    const tennisOrCs = afterSoccer.filter(
      (item) =>
        (item.kind === 'wc' && item.event.sport === 'tennis') ||
        (item.kind === 'cyber' && String(item.event.sport).includes('cs')),
    );
    expect(tennisOrCs.length).toBeGreaterThan(0);

    const cyberIds = items
      .filter((item) => item.kind === 'cyber')
      .map((item) => (item.kind === 'cyber' ? item.event.eventId : ''));
    expect(cyberIds[0]).toBe('cy-cs2');
  });

  it('sorts homepage cyber: high-pri CS2 first', () => {
    const sorted = sortHomepageCyberLive([
      {
        game: { eventId: 'dota', sport: 'esports.dota2', priority: 2 } as never,
        isLive: true,
      },
      {
        game: { eventId: 'cs-low', sport: 'esports.cs', priority: 0 } as never,
        isLive: true,
      },
      {
        game: { eventId: 'cs-high', sport: 'esports.cs', priority: 2 } as never,
        isLive: true,
      },
    ]);
    expect(sorted.map((x) => x.game.eventId)).toEqual(['cs-high', 'dota', 'cs-low']);
  });
});
