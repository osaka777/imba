import {
  coalesceBestOf,
  collectBestOfSignalsFromOddsGroups,
  inferOneWinBestOf,
} from './onewin-esports-bestof.util';

describe('onewin-esports-bestof.util', () => {
  it('reads explicit BO from league name', () => {
    expect(inferOneWinBestOf({ leagueName: 'ESL Challenger BO3' })).toBe(3);
    expect(inferOneWinBestOf({ leagueName: 'Major best of 5' })).toBe(5);
    expect(inferOneWinBestOf({ leagueName: 'Финал до 3 побед' })).toBe(5);
  });

  it('infers BO3 from match correct-score outcomes', () => {
    expect(
      inferOneWinBestOf({
        seriesScoreLabels: ['2:0', '2:1', '1:2', '0:2'],
      }),
    ).toBe(3);
  });

  it('infers BO5 from 3-x correct-score outcomes', () => {
    expect(
      inferOneWinBestOf({
        seriesScoreLabels: ['3:0', '3:1', '3:2', '2:3'],
      }),
    ).toBe(5);
  });

  it('does not guess BO3 from map-3 markets alone', () => {
    expect(
      inferOneWinBestOf({
        groupNames: ['Карта 1. Победитель', 'Карта 2. Победитель', 'Карта 3. Победитель'],
      }),
    ).toBeNull();
  });

  it('infers at least BO5 when map-4/5 books exist', () => {
    expect(
      inferOneWinBestOf({
        groupNames: ['Карта 4. Победитель', 'Карта 5. Тотал'],
      }),
    ).toBe(5);
  });

  it('prefers larger BO when signals conflict (safer vs premature clinch)', () => {
    expect(
      coalesceBestOf(
        3,
        inferOneWinBestOf({
          groupNames: ['Карта 5. Победитель'],
          leagueName: 'Some Cup BO3',
        }),
      ),
    ).toBe(5);
  });

  it('collects series score labels from match correct-score groups only', () => {
    const signals = collectBestOfSignalsFromOddsGroups([
      {
        id: '1',
        name: 'Точный счет',
        oddsList: [
          { cf: 2.1, id: 'a', name: '2:0', status: 1 },
          { cf: 3.4, id: 'b', name: '2:1', status: 1, vars: { v1: 2 } as never },
        ],
      },
      {
        id: '2',
        name: 'Карта 1. Точный счет',
        oddsList: [{ cf: 5, id: 'c', name: '13:7', status: 1 }],
      },
    ]);
    expect(signals.seriesScoreLabels).toEqual(['2:0', '2:1', '2']);
    expect(signals.groupNames).toContain('Карта 1. Точный счет');
  });
});
