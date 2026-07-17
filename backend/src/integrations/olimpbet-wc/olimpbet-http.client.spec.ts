import { parseRetryAfterMs } from './olimpbet-http.client';

describe('parseRetryAfterMs', () => {
  it('parses seconds', () => {
    expect(parseRetryAfterMs('2')).toBe(2000);
  });

  it('returns undefined for empty header', () => {
    expect(parseRetryAfterMs(null)).toBeUndefined();
    expect(parseRetryAfterMs('')).toBeUndefined();
  });

  it('caps delay at 120s', () => {
    expect(parseRetryAfterMs('9999')).toBe(120_000);
  });
});

describe('Number env defaults (NaN regression)', () => {
  it('does not parse underscore numeric separators as numbers', () => {
    // Regression: Number('30_000') === NaN broke Olimpbet backoff/circuit.
    expect(Number('30_000')).toBeNaN();
    expect(Number('60_000')).toBeNaN();
    expect(Number('30000')).toBe(30_000);
    expect(Number('60000')).toBe(60_000);
  });
});
