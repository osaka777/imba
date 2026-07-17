import {
  isBlockedCatalogStem,
  isWcBetPlacementBlockedMarket,
  isWcBetPlacementBlockedOutcome,
} from './wc-bet-placement-blocklist.util';

describe('isWcBetPlacementBlockedMarket', () => {
  it('blocks OR combination props', () => {
    expect(isWcBetPlacementBlockedMarket('display_WIN1_OR_OVER')).toBe(true);
    expect(isWcBetPlacementBlockedMarket('display_DRAW_OR_UNDER')).toBe(true);
    expect(isWcBetPlacementBlockedMarket('display_WIN2_OR_CLEANSHEET')).toBe(true);
  });

  it('blocks HOW_WILL and goal-and-winner combos without resolver', () => {
    expect(isWcBetPlacementBlockedMarket('display_HOW_WILL_GOAL_BE_SCORED')).toBe(true);
    expect(isWcBetPlacementBlockedMarket('display_FIRST_GOAL_AND_WINNER')).toBe(true);
    expect(isWcBetPlacementBlockedMarket('display_LAST_GOAL_AND_WINNER')).toBe(true);
  });

  it('blocks penalty series and special props', () => {
    expect(isWcBetPlacementBlockedMarket('display_SERIESPENALTY_YES_NO')).toBe(true);
    expect(isWcBetPlacementBlockedMarket('display_MARGIN_PENALTY')).toBe(true);
    expect(isWcBetPlacementBlockedMarket('display_STRONG_WILLED_TEAM1')).toBe(true);
    expect(isWcBetPlacementBlockedMarket('display_OWNGOAL_YES_NO')).toBe(true);
    expect(isWcBetPlacementBlockedMarket('display_WHICHS_EARLIER_GOAL_SUB')).toBe(true);
    expect(isWcBetPlacementBlockedMarket('display_WINNER_YES_NO')).toBe(true);
  });

  it('blocks stat subgame markets', () => {
    expect(isBlockedCatalogStem('CORNERS_TOTAL')).toBe(true);
    expect(isWcBetPlacementBlockedMarket('display_YELLOW_CARD_GOALKEEPER_YES_NO')).toBe(true);
    expect(isWcBetPlacementBlockedMarket('display_TOTAL_ACES')).toBe(true);
    expect(isWcBetPlacementBlockedMarket('display_FOULS_TOTAL')).toBe(true);
  });

  it('allows markets with native settlement', () => {
    expect(isWcBetPlacementBlockedMarket('h2h')).toBe(false);
    expect(isWcBetPlacementBlockedMarket('totals')).toBe(false);
    expect(isWcBetPlacementBlockedMarket('display_WIN1_AND_TOTAL')).toBe(false);
    expect(isWcBetPlacementBlockedMarket('display_NEXT_GOAL')).toBe(false);
    expect(isWcBetPlacementBlockedMarket('display_DOUBLE_CHANCE_QUARTER')).toBe(false);
    expect(isWcBetPlacementBlockedMarket('display_GOALS_BOTH_HALF')).toBe(false);
  });
});

describe('isWcBetPlacementBlockedOutcome', () => {
  it('blocks handicap parser fallback keys', () => {
    expect(isWcBetPlacementBlockedOutcome('handicap', 'HCP_12_-1.5')).toBe(true);
    expect(isWcBetPlacementBlockedOutcome('handicap', 'HOME_HCP_-1.5')).toBe(false);
  });

  it('blocks handicap_3way fallback keys', () => {
    expect(isWcBetPlacementBlockedOutcome('handicap_3way', 'H3W_99')).toBe(true);
    expect(isWcBetPlacementBlockedOutcome('handicap_3way', 'HOME')).toBe(false);
  });
});
