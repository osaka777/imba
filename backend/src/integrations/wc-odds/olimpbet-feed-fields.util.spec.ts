import {
  parseAnnouncedAddedMinutes,
  parseOlimpbetDurationSeconds,
  parseOlimpbetMinutes,
  parseOlimpbetPenaltyRisk,
  parseOlimpbetVarLabel,
} from './olimpbet-feed-fields.util';

describe('olimpbet-feed-fields.util', () => {
  it('parses announced minutes from inline and structured sources', () => {
    expect(parseAnnouncedAddedMinutes([{ code: 'add_minutes', value: '4' }], null)).toBe(4);
    expect(parseAnnouncedAddedMinutes([{ code: 'add_minutes', value: '+10' }], null)).toBe(10);
    expect(parseAnnouncedAddedMinutes([], { additionalMinutes: 7 })).toBe(7);
    expect(parseAnnouncedAddedMinutes([{ code: 'add_minutes', value: '' }], { additionalMinutes: 3 })).toBe(3);
  });

  it('parses Olimpbet millisecond durations into seconds', () => {
    expect(parseOlimpbetDurationSeconds(270_000)).toBe(270);
    expect(parseOlimpbetDurationSeconds(90)).toBe(90);
  });

  it('parses minute strings', () => {
    expect(parseOlimpbetMinutes("5'")).toBe(5);
    expect(parseOlimpbetMinutes('+12')).toBe(12);
  });

  it('detects VAR and penalty risk states', () => {
    expect(parseOlimpbetVarLabel('IN_PROGRESS')).toBe('VAR');
    expect(parseOlimpbetVarLabel('NONE')).toBeNull();
    expect(parseOlimpbetPenaltyRisk('PENALTY')).toBe(true);
    expect(parseOlimpbetPenaltyRisk('NONE')).toBe(false);
  });
});
