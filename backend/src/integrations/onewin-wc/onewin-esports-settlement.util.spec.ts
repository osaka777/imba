import {
  isOneWinEsportsFinishedStatus,
  resolveOneWinEsportsResult,
} from './onewin-esports-settlement.util';

describe('onewin-esports-settlement.util', () => {
  it('treats 1win «Закончен» as finished', () => {
    expect(isOneWinEsportsFinishedStatus('Закончен')).toBe(true);
    expect(isOneWinEsportsFinishedStatus('Окончен')).toBe(true);
    expect(isOneWinEsportsFinishedStatus('Завершён')).toBe(true);
  });

  it('does not treat mid-map «Итог» / market labels as finished', () => {
    expect(isOneWinEsportsFinishedStatus('Итог 1 карты')).toBe(false);
    expect(isOneWinEsportsFinishedStatus('Итог')).toBe(false);
    expect(isOneWinEsportsFinishedStatus('Карта 2')).toBe(false);
  });

  it('does not complete on empty status + closed odds mid-series', () => {
    const result = resolveOneWinEsportsResult({
      hasOpenOdds: false,
      matchScore: { t1: '1', t2: '0' },
      periodsScore: [{ t1: '13', t2: '11' }],
      status: '',
    });
    expect(result.completed).toBe(false);
  });

  it('completes on Закончен even when map markets still open', () => {
    const result = resolveOneWinEsportsResult({
      hasOpenOdds: true,
      matchScore: { t1: '2', t2: '1' },
      periodsScore: [
        { t1: '13', t2: '11' },
        { t1: '7', t2: '13' },
        { t1: '13', t2: '4' },
      ],
      status: 'Закончен',
    });
    expect(result.completed).toBe(true);
    expect(result.homeScore).toBe(2);
    expect(result.awayScore).toBe(1);
  });

  it('does not clinch a 2-0 series without bestOf — could be BO5', () => {
    // No caller passes bestOf today, so a bare "2 wins" heuristic would
    // wrongly settle a live BO5 sitting at 2-0. Must wait for real status.
    const result = resolveOneWinEsportsResult({
      hasOpenOdds: true,
      matchScore: { t1: '2', t2: '0' },
      periodsScore: [
        { t1: '13', t2: '10' },
        { t1: '13', t2: '8' },
      ],
      status: 'Карта 3',
    });
    expect(result.completed).toBe(false);
  });

  it('completes when bestOf is explicitly known and clinched', () => {
    const result = resolveOneWinEsportsResult(
      {
        hasOpenOdds: true,
        matchScore: { t1: '2', t2: '0' },
        periodsScore: [
          { t1: '13', t2: '10' },
          { t1: '13', t2: '8' },
        ],
        status: 'Карта 2',
      },
      { bestOf: 3 },
    );
    expect(result.completed).toBe(true);
  });

  it('does not complete 1-0 mid-series without finished status', () => {
    const result = resolveOneWinEsportsResult({
      hasOpenOdds: true,
      matchScore: { t1: '1', t2: '0' },
      periodsScore: [{ t1: '13', t2: '11' }],
      status: 'Карта 2',
    });
    expect(result.completed).toBe(false);
  });
});
