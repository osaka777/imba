import {
  isPointSetSportFeed,
  isTennisGameFeed,
  usesPointAggregateScore,
  usesSetsWonScore,
} from './point-set-sport-score.util';

describe('point-set-sport-score.util', () => {
  it('classifies market score modes', () => {
    expect(usesPointAggregateScore('totals')).toBe(true);
    expect(usesPointAggregateScore('totals_home')).toBe(true);
    expect(usesPointAggregateScore('h2h')).toBe(false);
    expect(usesSetsWonScore('h2h')).toBe(true);
    expect(usesSetsWonScore('double_chance')).toBe(true);
    expect(usesSetsWonScore('handicap')).toBe(false);
    expect(usesSetsWonScore('totals')).toBe(false);
  });

  it('detects volleyball feed from period scores', () => {
    const detail = {
      id: 1,
      competitors: [],
      eventDate: '',
      statistics: [{ code: 'scores_by_periods', value: '25:21,19:25,11:20' }],
    };
    expect(isPointSetSportFeed(detail)).toBe(true);
    expect(isTennisGameFeed(detail)).toBe(false);
  });

  it('detects tennis feed from period scores', () => {
    const detail = {
      id: 1,
      competitors: [],
      eventDate: '',
      statistics: [{ code: 'scores_by_periods', value: '4:6,0:4' }],
    };
    expect(isTennisGameFeed(detail)).toBe(true);
    expect(isPointSetSportFeed(detail)).toBe(false);
  });
});
