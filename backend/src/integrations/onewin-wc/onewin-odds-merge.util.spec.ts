import { mergeOneWinOddsGroups } from './onewin-odds-merge.util';
import type { OneWinOddsGroup } from './onewin-esports-markets.util';

function group(
  id: string,
  name: string,
  odds: Array<{ cf: number; id: string; name?: string; outcome?: string; status: number }>,
): OneWinOddsGroup {
  return { id, name, oddsList: odds };
}

describe('mergeOneWinOddsGroups', () => {
  const fullBook: OneWinOddsGroup[] = [
    group('w', 'Победитель', [
      { cf: 1.9, id: '1', name: 'A', outcome: '1', status: 1 },
      { cf: 1.9, id: '2', name: 'B', outcome: '2', status: 1 },
    ]),
    group('m1', 'Карта 1. Победитель', [
      { cf: 1.8, id: '3', name: 'A', outcome: '1', status: 1 },
      { cf: 2.0, id: '4', name: 'B', outcome: '2', status: 1 },
    ]),
  ];

  it('keeps previous book when delta has no group names', () => {
    const merged = mergeOneWinOddsGroups({
      incoming: [
        { id: 'x', name: '', oddsList: [{ cf: 2, id: '9', name: '?', status: 0 }] },
      ],
      messageType: 'match-odds',
      previous: fullBook,
    });
    expect(merged).toEqual(fullBook);
  });

  it('preserves odd name/outcome when full snapshot strips labels', () => {
    const merged = mergeOneWinOddsGroups({
      incoming: [
        group('w', 'Победитель', [
          { cf: 2.2, id: '1', status: 1 },
          { cf: 1.6, id: '2', status: 1 },
        ]),
      ],
      messageType: 'match-odds-snapshot',
      previous: fullBook,
    });
    const win = merged.find((g) => g.id === 'w');
    expect(win?.oddsList).toEqual([
      { cf: 2.2, id: '1', name: 'A', outcome: '1', status: 1 },
      { cf: 1.6, id: '2', name: 'B', outcome: '2', status: 1 },
    ]);
    expect(merged.find((g) => g.id === 'm1')).toBeUndefined();
  });

  it('merges sparse named deltas into previous book', () => {
    const merged = mergeOneWinOddsGroups({
      incoming: [
        group('w', 'Победитель', [
          { cf: 2.1, id: '1', status: 1 },
          { cf: 1.7, id: '2', status: 1 },
        ]),
      ],
      messageType: 'match-odds',
      previous: fullBook,
    });
    expect(merged).toHaveLength(2);
    expect(merged.find((g) => g.id === 'w')?.oddsList[0]).toMatchObject({
      cf: 2.1,
      name: 'A',
      outcome: '1',
    });
    expect(merged.find((g) => g.id === 'm1')?.name).toBe('Карта 1. Победитель');
  });
});
