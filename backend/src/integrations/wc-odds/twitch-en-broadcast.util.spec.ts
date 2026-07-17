import {
  buildTwitchPlayerUrl,
  isBlockedTwitchChannel,
  isVerifiedTwitchEnChannel,
  twitchEsportsEnProbeSlugs,
} from './twitch-en-broadcast.util';

describe('twitch-en-broadcast.util', () => {
  it('blocks bookmaker twitch channels', () => {
    expect(isBlockedTwitchChannel('betboom_sb_cs')).toBe(true);
    expect(isBlockedTwitchChannel('1xbet_ru')).toBe(true);
  });

  it('allows english tournament channels', () => {
    expect(isVerifiedTwitchEnChannel('esl_csgo')).toBe(true);
    expect(isVerifiedTwitchEnChannel('blastpremier')).toBe(true);
    expect(isVerifiedTwitchEnChannel('betboom_sb_cs')).toBe(false);
  });

  it('builds twitch player url with parent domains', () => {
    const url = buildTwitchPlayerUrl('esl_csgo', 'https://imba.bet');
    expect(url).toContain('player.twitch.tv');
    expect(url).toContain('channel=esl_csgo');
    expect(url).toContain('parent=imba.bet');
  });

  it('lists cs2 twitch probe slugs', () => {
    const slugs = twitchEsportsEnProbeSlugs('olimp_1040');
    expect(slugs).toContain('esl_csgo');
    expect(slugs).not.toContain('betboom_sb_cs');
  });
});
