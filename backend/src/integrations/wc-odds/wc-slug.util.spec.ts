import {
  baseWcSlug,
  isBrokenWcSlug,
  olimpbetIdFromSlugHint,
  slugifyTeam,
} from './wc-slug.util';

describe('wc-slug.util', () => {
  it('transliterates Cyrillic team names', () => {
    expect(slugifyTeam('Свирепые Ежи')).toBe('svirepye-ezhi');
    expect(slugifyTeam('Хитрые Лисы')).toBe('hitrye-lisy');
    expect(slugifyTeam('Лос-Анджелес 2')).toBe('los-andzheles-2');
  });

  it('builds readable match slugs', () => {
    expect(baseWcSlug('Свирепые Ежи', 'Хитрые Лисы')).toBe(
      'svirepye-ezhi-vs-hitrye-lisy',
    );
  });

  it('detects broken legacy slugs', () => {
    expect(isBrokenWcSlug('-vs--8277133')).toBe(true);
    expect(isBrokenWcSlug('2-vs-2-29-06')).toBe(true);
    expect(isBrokenWcSlug('svirepye-ezhi-vs-hitrye-lisy-8277133')).toBe(false);
  });

  it('extracts olimpbet id from slug refs', () => {
    expect(olimpbetIdFromSlugHint('-vs--8277133')).toBe('ol-8277133');
    expect(olimpbetIdFromSlugHint('los-andzheles-2-vs-khouston-dinamo-2-8269790')).toBe('ol-8269790');
  });
});
