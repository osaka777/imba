import {
  catalogNameFromMarketKey,
  isPlainNextGoalMarket,
  resolveSettlementProfile,
  type SettlementProfile,
} from './wc-settlement-profile.util';

describe('resolveSettlementProfile', () => {
  it('classifies classic markets as SCORE', () => {
    expect(resolveSettlementProfile('h2h')).toBe('SCORE');
    expect(resolveSettlementProfile('totals')).toBe('SCORE');
    expect(resolveSettlementProfile('handicap')).toBe('SCORE');
  });

  it('classifies timing goal markets as TIME_WINDOW', () => {
    expect(resolveSettlementProfile('display_NEXT_GOAL_TIME_10MIN')).toBe('TIME_WINDOW');
    expect(resolveSettlementProfile('display_NEXT_GOAL_TIME_15MIN')).toBe('TIME_WINDOW');
    expect(resolveSettlementProfile('display_NEXT_GOAL_TIME_TEAM1_10MIN')).toBe('TIME_WINDOW');
    expect(resolveSettlementProfile('display_WINNER_10MIN')).toBe('TIME_WINDOW');
    expect(resolveSettlementProfile('display_GOAL15MIN_YES_NO')).toBe('TIME_WINDOW');
  });

  it('classifies sequence markets', () => {
    expect(resolveSettlementProfile('display_NEXT_GOAL')).toBe('SEQUENCE');
    expect(resolveSettlementProfile('display_DEUSE_POINT')).toBe('SEQUENCE');
    expect(resolveSettlementProfile('display_NEXT_POINTS_GAME')).toBe('SEQUENCE');
    expect(resolveSettlementProfile('display_GOALS_TEAM1')).toBe('SEQUENCE');
  });

  it('classifies exotic props as OLIMPBET_ONLY', () => {
    expect(resolveSettlementProfile('display_HOW_WILL_GOAL_BE_SCORED')).toBe('OLIMPBET_ONLY');
  });

  it('falls back to DISPLAY for unknown display_* keys', () => {
    expect(resolveSettlementProfile('display_SOME_RANDOM_PROP')).toBe('DISPLAY');
  });
});

describe('isPlainNextGoalMarket', () => {
  it('matches plain next goal only', () => {
    expect(isPlainNextGoalMarket('display_NEXT_GOAL')).toBe(true);
    expect(isPlainNextGoalMarket('display_NEXT_GOAL_HALF')).toBe(false);
    expect(isPlainNextGoalMarket('display_NEXT_GOAL_TIME_10MIN')).toBe(false);
    expect(isPlainNextGoalMarket('display_HOW_WILL_GOAL_BE_SCORED')).toBe(false);
  });
});

describe('catalogNameFromMarketKey', () => {
  it('strips display_ prefix', () => {
    expect(catalogNameFromMarketKey('display_NEXT_GOAL')).toBe('NEXT_GOAL');
    expect(catalogNameFromMarketKey('h2h')).toBeNull();
  });
});
