import {
  extractOlimpbetHeadToHeadId,
  sportRadarMatchNumericId,
} from './olimpbet-head-to-head.util';

describe('extractOlimpbetHeadToHeadId', () => {
  it('returns headToHeadId from HeadToHeadIntegration', () => {
    expect(
      extractOlimpbetHeadToHeadId({
        id: 1,
        competitors: [],
        eventDate: '2026-06-26T12:00:00Z',
        integrations: [
          { type: 'HeadToHeadIntegration', headToHeadId: 'sr:match:53452545' },
        ],
      }),
    ).toBe('sr:match:53452545');
  });

  it('returns null when integrations are missing', () => {
    expect(
      extractOlimpbetHeadToHeadId({
        id: 1,
        competitors: [],
        eventDate: '2026-06-26T12:00:00Z',
      }),
    ).toBeNull();
  });
});

describe('sportRadarMatchNumericId', () => {
  it('extracts trailing digits', () => {
    expect(sportRadarMatchNumericId('sr:match:53452545')).toBe('53452545');
  });

  it('returns null for empty input', () => {
    expect(sportRadarMatchNumericId('sr:match:')).toBeNull();
  });
});
