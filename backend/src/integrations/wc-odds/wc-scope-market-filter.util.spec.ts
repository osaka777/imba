import type { OlimpbetEventDetail } from '../olimpbet-wc/olimpbet-wc.types';

import {
  filterFinalizedScopeMarkets,
  resolveBetPlacementScope,
  resolveMarketGroupScope,
} from './wc-scope-market-filter.util';
import type { WcMarketGroup } from './wc-odds-markets.util';

describe('wc-scope-market-filter', () => {
  const liveDetail = {
    id: 8284166,
    competitors: [],
    eventDate: '',
    status: 'EVENT_TRADING',
    live: true,
    score: { home: 0, away: 2 },
    statistics: [{ code: 'scores_by_periods', value: '6:11,8:11,6:3' }],
  } as OlimpbetEventDetail;

  const comboGroup: WcMarketGroup = {
    key: '1297__PARAMETER_SET_NUMBER:1|PARAMETER_VALUE:18.5',
    marketKey: 'display_WIN1_AND_TOTAL_SET',
    label: 'Результат + тотал 18.5 1-й сет',
    outcomes: [{
      name: 'ТМ',
      price: 12,
      outcomeKey: 'DISPLAY_1297_1729_PARAMETER_SET_NUMBER:1|PARAMETER_VALUE:18.5',
    }],
  };

  it('detects set scope from combo group label', () => {
    expect(resolveMarketGroupScope('Результат + тотал', comboGroup)).toEqual({
      kind: 'set',
      index: 1,
    });
  });

  it('removes finalized set combo markets while keeping current set', () => {
    const grouped = filterFinalizedScopeMarkets({
      'Результат + тотал': [
        comboGroup,
        {
          ...comboGroup,
          key: '1297__PARAMETER_SET_NUMBER:3|PARAMETER_VALUE:18.5',
          label: 'Результат + тотал 18.5 3-й сет',
          outcomes: [{
            ...comboGroup.outcomes[0]!,
            outcomeKey: 'DISPLAY_1297_1729_PARAMETER_SET_NUMBER:3|PARAMETER_VALUE:18.5',
          }],
        },
      ],
      '1-й сет': [{
        key: 'totals-1',
        marketKey: 'totals',
        label: 'Тотал 18.5',
        outcomes: [{ name: 'ТМ', price: 1.9, outcomeKey: 'UNDER_18.5', point: 18.5 }],
      }],
    }, liveDetail);

    expect(grouped['Результат + тотал']).toHaveLength(1);
    expect(grouped['Результат + тотал']![0]!.label).toContain('3-й сет');
    expect(grouped['1-й сет']).toBeUndefined();
  });

  it('blocks bet placement scope for finished first set', () => {
    const scope = resolveBetPlacementScope({
      marketKey: 'display_WIN1_AND_TOTAL_SET',
      outcomeKey: 'DISPLAY_1297_1729_PARAMETER_SET_NUMBER:1|PARAMETER_VALUE:18.5',
      outcomeName: 'Результат + тотал 18.5 1-й сет: ТМ',
      groupKey: comboGroup.key,
    });

    expect(scope).toEqual({ kind: 'set', index: 1 });
  });
});
