import {
  buildOneWinEsportsTeamIconUrl,
  pickOneWinTeamLogoUrl,
  resolveOneWinEsportsTeamIcon,
} from './onewin-esports-logos.util';

describe('onewin-esports-logos.util', () => {
  it('reads logo from team or competitors', () => {
    expect(
      pickOneWinTeamLogoUrl(
        { id: 1, logo: { url: 'https://bstatic.live/icons/a.png' } },
        [{ id: 2, logo: { url: 'https://bstatic.live/icons/b.png' } }],
      ),
    ).toBe('https://bstatic.live/icons/a.png');

    expect(
      pickOneWinTeamLogoUrl(
        { id: 1 },
        [{ id: 1, logo: { url: 'https://bstatic.live/team-icons/12-1.webp' } }],
      ),
    ).toBe('https://bstatic.live/team-icons/12-1.webp');
  });

  it('prefers API logo over CDN fallback', () => {
    expect(
      resolveOneWinEsportsTeamIcon({
        id: 54239,
        logoUrl: 'https://bstatic.live/icons/custom.png',
      }),
    ).toBe('https://bstatic.live/icons/custom.png');
  });

  it('builds esports CDN fallback for positive ids', () => {
    expect(buildOneWinEsportsTeamIconUrl(54239)).toBe(
      'https://bstatic.live/team-icons/12-54239.webp',
    );
    expect(buildOneWinEsportsTeamIconUrl(-1)).toBeNull();
    expect(buildOneWinEsportsTeamIconUrl(0)).toBeNull();
  });

  it('falls back to CDN when API logo missing', () => {
    expect(resolveOneWinEsportsTeamIcon({ id: 16770 })).toBe(
      'https://bstatic.live/team-icons/12-16770.webp',
    );
  });
});
