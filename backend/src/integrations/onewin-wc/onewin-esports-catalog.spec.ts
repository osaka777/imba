import { ONEWIN_ESPORTS_CATALOG } from './onewin-esports-catalog';

describe('ONEWIN_ESPORTS_CATALOG', () => {
  it('lists only live 1win esports titles used by cyber filter', () => {
    const apis = ONEWIN_ESPORTS_CATALOG.map((e) => e.apiSport);
    expect(apis).toEqual([
      'esports.cs',
      'esports.dota2',
      'esports.lol',
      'esports.valorant',
      'esports.r6',
      'esports.mobile-legends',
      'esports.kog',
      'esports.overwatch2',
      'esports.pubg-mobile',
    ]);
    expect(apis).not.toContain('esports.cod');
    expect(apis).not.toContain('esports.csgo');
    expect(apis).not.toContain('esports.pubg');
    expect(apis).not.toContain('esports.crossfire');
    expect(apis).not.toContain('esports.aov');
  });
});
