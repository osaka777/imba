import { pickRicherStatList, resolvePeriodSportPeriod } from './wc-odds-statistics.util';

describe('pickRicherStatList', () => {
  it('keeps previous list when incoming is shorter', () => {
    const full = [
      { id: 'corners', name: 'Угловые', opp1: '3', opp2: '1' },
      { id: 'shots_on', name: 'Удары', opp1: '5', opp2: '2' },
      { id: 'fouls', name: 'Фолы', opp1: '8', opp2: '6' },
    ];
    const partial = [{ id: 'red_cards', name: 'Красные', opp1: '0', opp2: '1' }];
    expect(pickRicherStatList(full, partial)).toBe(full);
  });

  it('accepts richer incoming list', () => {
    const partial = [{ id: 'red_cards', name: 'Красные', opp1: '0', opp2: '1' }];
    const full = [
      { id: 'corners', name: 'Угловые', opp1: '3', opp2: '1' },
      { id: 'shots_on', name: 'Удары', opp1: '5', opp2: '2' },
    ];
    expect(pickRicherStatList(partial, full)).toBe(full);
  });
});

describe('resolvePeriodSportPeriod', () => {
  it('maps hockey break code 31 to current period from scoreboard columns', () => {
    expect(resolvePeriodSportPeriod('hockey', '31', 3)).toBe(3);
    expect(resolvePeriodSportPeriod('hockey', '31', 4)).toBe(4);
  });

  it('keeps active hockey period codes', () => {
    expect(resolvePeriodSportPeriod('hockey', '3', 3)).toBe(3);
  });

  it('maps break code 31 to period 1 when only one period is played', () => {
    expect(resolvePeriodSportPeriod('hockey', '31', 1)).toBe(1);
  });
});
