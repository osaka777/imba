import {
  extractLinkedEventStatRow,
  mergeLinkedStatsIntoList,
} from './olimpbet-linked-stats.util';

describe('olimpbet-linked-stats.util', () => {
  it('extracts score from linked event inline stats', () => {
    const row = extractLinkedEventStatRow(
      { eventType: { code: 'Expected_goals', name: 'xG' } },
      { statistics: [{ code: 'score', value: '1.24:0.87' }], score: null },
    );
    expect(row).toEqual({
      id: 'expected_goals',
      name: 'xG',
      opp1: '1.24',
      opp2: '0.87',
    });
  });

  it('merges linked rows without dropping richer base stats', () => {
    const merged = mergeLinkedStatsIntoList(
      [{ id: 'corners', name: 'Угловые', opp1: '5', opp2: '3' }],
      [{ id: 'corners', name: 'Угловые', opp1: '4', opp2: '2' }, {
        id: 'expected_goals',
        name: 'xG',
        opp1: '1.1',
        opp2: '0.9',
      }],
    );
    expect(merged).toEqual([
      { id: 'corners', name: 'Угловые', opp1: '5', opp2: '3' },
      { id: 'expected_goals', name: 'xG', opp1: '1.1', opp2: '0.9' },
    ]);
  });
});
