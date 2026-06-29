import { buildTotalsOutcomeName } from './wc-totals-outcome-name.util';

describe('buildTotalsOutcomeName', () => {
  it('preserves set scope from group label', () => {
    expect(
      buildTotalsOutcomeName('2-й сет 12.5 2-й сет', '12.5', 'OVER_12.5', 'Тотал 12.5 — Больше'),
    ).toBe('2-й сет — Тотал 12.5 — Больше');
  });

  it('keeps existing scoped outcome name', () => {
    expect(
      buildTotalsOutcomeName('2-й сет 12.5', '12.5', 'OVER_12.5', '1-й сет — Тотал 9.5 — Больше'),
    ).toBe('1-й сет — Тотал 9.5 — Больше');
  });

  it('preserves dotted scoped totals label from parser', () => {
    expect(
      buildTotalsOutcomeName('2-й сет · Тотал геймов · 12.5', '12.5', 'OVER_12.5', 'Тотал 12.5 — Больше'),
    ).toBe('2-й сет · Тотал геймов 12.5 — Больше');
  });
});
