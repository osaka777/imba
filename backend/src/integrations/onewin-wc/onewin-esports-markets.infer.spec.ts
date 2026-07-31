import { mapOneWinOddsToGroupedMarkets } from './onewin-esports-markets.util';

describe('mapOneWinOddsToGroupedMarkets id inference', () => {
  it('infers HOME/AWAY from 1win id when name/outcome missing', () => {
    const mapped = mapOneWinOddsToGroupedMarkets(
      [
        {
          id: 'w',
          name: 'Победитель',
          oddsList: [
            { cf: 2.1, id: '12:L:1:[1,[],[0],1,0,[]]', status: 1 },
            { cf: 1.7, id: '12:L:1:[1,[],[0],1,3,[]]', status: 1 },
          ],
        },
      ],
      'Larens',
      '-kevinG',
    );
    expect(mapped.oddsHome).toBe(2.1);
    expect(mapped.oddsAway).toBe(1.7);
    const outs = mapped.groupedMarkets['Основные'][0].outcomes;
    expect(outs.map((o) => o.outcomeKey)).toEqual(['HOME', 'AWAY']);
    expect(outs.map((o) => o.name)).toEqual(['Larens', '-kevinG']);
  });
});
