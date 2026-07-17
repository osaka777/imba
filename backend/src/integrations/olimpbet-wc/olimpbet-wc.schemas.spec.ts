import {
  parseOlimpbetCyberEventDetail,
  parseOlimpbetEventDetail,
  parseOlimpbetStatistics,
  parseOlimpbetV2EventListResponse,
} from './olimpbet-wc.schemas';

describe('olimpbet-wc.schemas', () => {
  describe('parseOlimpbetV2EventListResponse', () => {
    it('accepts valid list envelope and filters bad items', () => {
      const result = parseOlimpbetV2EventListResponse({
        items: [
          {
            id: 1,
            eventDate: '2026-07-05T12:00:00Z',
            competitors: [{ id: 10, name: 'A' }, { id: 20, name: 'B' }],
          },
          { id: 'bad', eventDate: null },
        ],
        paginationKeyForward: 'next',
      });

      expect(result?.items).toHaveLength(1);
      expect(result?.items[0].id).toBe(1);
      expect(result?.paginationKeyForward).toBe('next');
    });

    it('returns null for non-object payload', () => {
      expect(parseOlimpbetV2EventListResponse(null)).toBeNull();
      expect(parseOlimpbetV2EventListResponse('x')).toBeNull();
    });
  });

  describe('parseOlimpbetEventDetail', () => {
    it('coerces string odds and preserves extra fields', () => {
      const result = parseOlimpbetEventDetail({
        id: 99,
        eventDate: '2026-07-05T12:00:00Z',
        competitors: [{ id: 1, name: 'Home' }, { id: 2, name: 'Away' }],
        linkedEvents: [{ eventId: 100 }],
        probabilities: {
          markets: [{
            marketId: 1,
            probabilities: [{ outcomeTypeId: 1, odd: '2.05' }],
          }],
        },
      });

      expect(result?.id).toBe(99);
      expect(result?.linkedEvents).toEqual([{ eventId: 100 }]);
    });

    it('rejects detail without two competitors', () => {
      expect(parseOlimpbetEventDetail({
        id: 1,
        eventDate: '2026-07-05T12:00:00Z',
        competitors: [{ id: 1, name: 'Solo' }],
      })).toBeNull();
    });
  });

  describe('parseOlimpbetCyberEventDetail', () => {
    it('allows single competitor for sparse cyber payloads', () => {
      const result = parseOlimpbetCyberEventDetail({
        id: 5,
        eventDate: '2026-07-05T12:00:00Z',
        competitors: [{ id: 1, name: 'Team' }],
      });
      expect(result?.id).toBe(5);
    });
  });

  describe('parseOlimpbetStatistics', () => {
    it('rejects error payloads', () => {
      expect(parseOlimpbetStatistics({ errors: [{ code: 'X' }] })).toBeNull();
    });

    it('passes through valid stats object', () => {
      const stats = { periods: [] };
      expect(parseOlimpbetStatistics(stats)).toBe(stats);
    });
  });
});
