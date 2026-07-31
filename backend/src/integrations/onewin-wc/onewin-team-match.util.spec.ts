import {
  oneWinTeamMatchScore,
  oneWinTeamMatches,
  tokenSimilarity,
  normalizeRuName,
} from './onewin-team-match.util';

describe('onewin-team-match.util', () => {
  describe('normalizeRuName', () => {
    it('maps э→е and strips commas', () => {
      expect(normalizeRuName('Такахаси, Юсукэ')).toBe('такахаси юсуке');
    });
  });

  describe('tokenSimilarity', () => {
    it('tolerates one-char surname typos', () => {
      expect(
        tokenSimilarity(
          normalizeRuName('босаравонгсе'),
          normalizeRuName('бусаравонгсе'),
        ),
      ).toBeGreaterThanOrEqual(0.9);
    });

    it('treats юсукэ and юсуке as equal after normalize', () => {
      expect(
        tokenSimilarity(
          normalizeRuName('юсукэ'),
          normalizeRuName('юсуке'),
        ),
      ).toBe(1);
    });
  });

  describe('oneWinTeamMatchScore', () => {
    it('matches tennis First/Last order flip with spelling variant', () => {
      const score = oneWinTeamMatchScore('Босаравонгсе Танапхат', {
        name: 'Танапхат Бусаравонгсе',
        slug: 'tanaphat-busarawongse',
      });
      expect(score).toBeGreaterThanOrEqual(0.75);
      expect(
        oneWinTeamMatches('Босаравонгсе Танапхат', {
          name: 'Танапхат Бусаравонгсе',
          slug: 'tanaphat-busarawongse',
        }),
      ).toBe(true);
    });

    it('matches э/е and comma-separated tennis names', () => {
      expect(
        oneWinTeamMatchScore('Такахаси Юсукэ', {
          name: 'Такахаси, Юсуке',
          slug: 'takahashi-yusuke',
        }),
      ).toBeGreaterThanOrEqual(0.95);
    });

    it('does not latch onto a shared short token alone', () => {
      const score = oneWinTeamMatchScore('Смит', {
        name: 'Манчестер Юнайтед',
        slug: 'manchester-united',
      });
      expect(score).toBeLessThan(0.55);
    });

    it('does not match tennis doubles to unrelated pairs via country codes', () => {
      expect(
        oneWinTeamMatchScore('Герберт П.-Х./Кравиц К.', {
          name: 'Вуджин Джанг (Кор) / Патрик Франциска (Гер)',
          slug: 'wujin-jang-patrick-franziska',
        }),
      ).toBeLessThan(0.5);
    });

    it('does not match via 2-letter substring inside another token', () => {
      expect(
        oneWinTeamMatchScore('Арендс С./Пел Д.', {
          name: 'Эн.Си. Динос',
          slug: 'nc-dinos',
        }),
      ).toBeLessThan(0.5);
    });

    it('matches doubles across partner order', () => {
      const score = oneWinTeamMatchScore('Иванов / Петров', {
        name: 'Петров / Иванов',
        slug: 'petrov-ivanov',
      });
      expect(score).toBeGreaterThanOrEqual(0.75);
    });

    it('still matches short club names against full titles', () => {
      expect(
        oneWinTeamMatchScore('Акрон', {
          name: 'Акрон Тольятти',
          slug: 'akron-tolyatti',
        }),
      ).toBeGreaterThanOrEqual(0.7);
    });
  });
});
