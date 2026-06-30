import {
  filterVisibleWcLiveListEvents,
  isWcEventVisibleInLiveList,
  wcEventHasActiveListBets,
} from './wc-live-visibility.util';
import type { WcOddsEventDto } from './wc-odds.types';

function baseEvent(overrides: Partial<WcOddsEventDto> = {}): WcOddsEventDto {
  return {
    id: 'ol-1',
    slug: 'test-match',
    sport: 'soccer',
    leagueName: 'Test',
    tournamentId: null,
    homeTeam: 'A',
    awayTeam: 'B',
    commenceTime: new Date(Date.now() - 60_000).toISOString(),
    oddsHome: null,
    oddsDraw: null,
    oddsAway: null,
    totalLine: null,
    oddsOver: null,
    oddsUnder: null,
    bookmaker: '',
    completed: false,
    homeScore: null,
    awayScore: null,
    bettingOpen: true,
    phase: 'live',
    oddsUpdatedAt: null,
    marketsCount: 0,
    odds1X: null,
    odds12: null,
    oddsX2: null,
    ...overrides,
  };
}

describe('wc-live-visibility', () => {
  it('hides finished events', () => {
    expect(isWcEventVisibleInLiveList(baseEvent({ completed: true }))).toBe(false);
    expect(isWcEventVisibleInLiveList(baseEvent({ phase: 'finished' }))).toBe(false);
  });

  it('shows within kickoff grace even when markets are briefly suspended', () => {
    expect(isWcEventVisibleInLiveList(baseEvent())).toBe(true);
  });

  it('shows events with list odds or extra markets', () => {
    expect(isWcEventVisibleInLiveList(baseEvent({ oddsHome: 1.85 }))).toBe(true);
    expect(isWcEventVisibleInLiveList(baseEvent({ marketsCount: 3 }))).toBe(true);
    expect(wcEventHasActiveListBets(baseEvent({ oddsOver: 2.05, totalLine: 2.5 }))).toBe(true);
  });

  it('keeps 0:0 matches with list odds visible after kickoff grace', () => {
    expect(isWcEventVisibleInLiveList(baseEvent({
      oddsHome: 4.6,
      oddsDraw: 1.65,
      oddsAway: 4.5,
      homeScore: 0,
      awayScore: 0,
      commenceTime: new Date(Date.now() - 95 * 60_000).toISOString(),
    }))).toBe(true);
  });

  it('hides stale past kickoffs without live feed', () => {
    expect(isWcEventVisibleInLiveList(baseEvent({
      oddsHome: 1.85,
      commenceTime: new Date(Date.now() - 4 * 86_400_000).toISOString(),
    }))).toBe(false);
  });

  it('filters arrays', () => {
    const events = [
      baseEvent({ id: 'ol-1' }),
      baseEvent({ id: 'ol-2', oddsHome: 2.1 }),
      baseEvent({
        id: 'ol-3',
        commenceTime: new Date(Date.now() - 4 * 86_400_000).toISOString(),
        oddsHome: 2.1,
      }),
    ];
    const visible = filterVisibleWcLiveListEvents(events);
    expect(visible).toHaveLength(2);
    expect(visible.map((event) => event.id)).toEqual(['ol-1', 'ol-2']);
  });
});
