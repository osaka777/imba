import {
  resolveWcMarketKey,
  stripOvertimeCatalogSuffix,
} from './olimpbet-wc-market-keys.util';

describe('stripOvertimeCatalogSuffix', () => {
  it('strips _WITH_OT suffix', () => {
    expect(stripOvertimeCatalogSuffix('TOTAL_WITH_OT')).toBe('TOTAL');
    expect(stripOvertimeCatalogSuffix('HANDICAP_WITH_OT')).toBe('HANDICAP');
    expect(stripOvertimeCatalogSuffix('MATCH_WINNER_X2_WITH_OT')).toBe('MATCH_WINNER_X2');
  });

  it('strips _WITHOT suffix', () => {
    expect(stripOvertimeCatalogSuffix('INDIVIDUAL_TOTAL_TEAM1_WITHOT')).toBe('INDIVIDUAL_TOTAL_TEAM1');
    expect(stripOvertimeCatalogSuffix('INDIVIDUAL_TOTAL_TEAM2_WITHOT')).toBe('INDIVIDUAL_TOTAL_TEAM2');
  });

  it('leaves base catalog names unchanged', () => {
    expect(stripOvertimeCatalogSuffix('TOTAL')).toBe('TOTAL');
    expect(stripOvertimeCatalogSuffix('HANDICAP_ASIAN')).toBe('HANDICAP_ASIAN');
  });
});

describe('resolveWcMarketKey', () => {
  it('maps overtime totals to totals', () => {
    expect(resolveWcMarketKey('TOTAL_WITH_OT')).toEqual({ marketKey: 'totals', bettable: true });
    expect(resolveWcMarketKey('INDIVIDUAL_TOTAL_TEAM1_WITHOT')).toEqual({
      marketKey: 'totals_home',
      bettable: true,
    });
    expect(resolveWcMarketKey('INDIVIDUAL_TOTAL_TEAM2_WITHOT')).toEqual({
      marketKey: 'totals_away',
      bettable: true,
    });
  });

  it('maps overtime handicaps to handicap', () => {
    expect(resolveWcMarketKey('HANDICAP_WITH_OT')).toEqual({ marketKey: 'handicap', bettable: true });
  });

  it('maps overtime match winner to h2h', () => {
    expect(resolveWcMarketKey('MATCH_WINNER_X2_WITH_OT')).toEqual({ marketKey: 'h2h', bettable: true });
    expect(resolveWcMarketKey('MATCH_WINNER_X3_WITH_OT')).toEqual({ marketKey: 'h2h', bettable: true });
  });

  it('maps standard catalog names', () => {
    expect(resolveWcMarketKey('TOTAL')).toEqual({ marketKey: 'totals', bettable: true });
    expect(resolveWcMarketKey('HANDICAP')).toEqual({ marketKey: 'handicap', bettable: true });
    expect(resolveWcMarketKey('MATCH_WINNER_X3')).toEqual({ marketKey: 'h2h', bettable: true });
    expect(resolveWcMarketKey('DOUBLE_CHANCE')).toEqual({ marketKey: 'double_chance', bettable: true });
    expect(resolveWcMarketKey('GOALS_BOTH')).toEqual({ marketKey: 'btts', bettable: true });
  });

  it('maps pattern-based variants not in the explicit list', () => {
    expect(resolveWcMarketKey('TOTAL_CUSTOM_NEW')).toEqual({ marketKey: 'totals', bettable: true });
    expect(resolveWcMarketKey('INDIVIDUAL_TOTAL_TEAM1')).toEqual({ marketKey: 'totals_home', bettable: true });
    expect(resolveWcMarketKey('INDIVIDUAL_TOTAL_TEAM2')).toEqual({ marketKey: 'totals_away', bettable: true });
    expect(resolveWcMarketKey('INDIVIDUAL_TOTAL_TEAM3')).toEqual({ marketKey: 'totals', bettable: true });
    expect(resolveWcMarketKey('HANDICAP_CUSTOM')).toEqual({ marketKey: 'handicap', bettable: true });
    expect(resolveWcMarketKey('MATCH_WINNER_SPECIAL')).toEqual({ marketKey: 'h2h', bettable: true });
  });

  it('maps handicap 3-way separately from 2-way handicap', () => {
    expect(resolveWcMarketKey('HANDICAP_3WAY')).toEqual({ marketKey: 'handicap_3way', bettable: true });
    expect(resolveWcMarketKey('HANDICAP_3WAY_HALF')).toEqual({ marketKey: 'handicap_3way', bettable: true });
  });

  it('maps even/odd catalog to even_odd', () => {
    expect(resolveWcMarketKey('EVEN_ODD')).toEqual({ marketKey: 'even_odd', bettable: true });
    expect(resolveWcMarketKey('EVEN_ODD_WITH_OT')).toEqual({ marketKey: 'even_odd', bettable: true });
  });

  it('falls back to display_* for unknown markets', () => {
    expect(resolveWcMarketKey('CORRECT_SCORE_SPECIAL')).toEqual({
      marketKey: 'display_CORRECT_SCORE_SPECIAL',
      bettable: true,
    });
  });
});
