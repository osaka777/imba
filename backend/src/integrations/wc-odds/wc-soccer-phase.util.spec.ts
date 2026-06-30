import { refineSoccerGamePhase } from './wc-soccer-phase.util';

describe('refineSoccerGamePhase', () => {
  it('overrides stale break at 117 min to 2nd extra time', () => {
    expect(
      refineSoccerGamePhase('34', 117 * 60 + 48, 'break'),
    ).toBe('extra_time_2');
  });

  it('keeps OT halftime break near 105:00', () => {
    expect(
      refineSoccerGamePhase('33', 105 * 60, 'break'),
    ).toBe('break');
  });

  it('keeps penalties when shootout started', () => {
    expect(
      refineSoccerGamePhase('50', 121 * 60, 'penalties'),
    ).toBe('penalties');
  });
});
