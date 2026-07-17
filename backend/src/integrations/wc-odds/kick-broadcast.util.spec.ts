import {
  buildKickPlayerUrl,
  hasKickEsportsBroadcast,
  resolveKickBroadcastChannel,
} from './kick-broadcast.util';

describe('kick-broadcast.util', () => {
  it('maps XSE Pro League to xsecsb without Olimpbet broadcast flag', () => {
    expect(
      resolveKickBroadcastChannel({
        sportKey: 'olimp_1040',
        leagueName: 'XSE Pro League',
        tournamentId: 30111,
        homeTeam: 'BIG',
        awayTeam: 'Ninjas In Pyjamas',
        olimpbetBroadcastAvailable: false,
      }),
    ).toBe('xsecsb');
  });

  it('maps XSE Pro League to xsecsb', () => {
    expect(
      resolveKickBroadcastChannel({
        sportKey: 'olimp_1040',
        leagueName: 'XSE Pro League',
        tournamentId: 30111,
        homeTeam: 'BIG',
        awayTeam: 'Ninjas In Pyjamas',
        olimpbetBroadcastAvailable: true,
      }),
    ).toBe('xsecsb');
  });

  it('maps European Pro League to eplcs_en', () => {
    expect(
      resolveKickBroadcastChannel({
        sportKey: 'olimp_1040',
        leagueName: 'European Pro League',
        homeTeam: 'ENJOY',
        awayTeam: 'Endless Journey',
        olimpbetBroadcastAvailable: true,
      }),
    ).toBe('eplcs_en');
  });

  it('maps United 21 to united21_en', () => {
    expect(
      resolveKickBroadcastChannel({
        sportKey: 'olimp_1040',
        leagueName: 'United 21',
        olimpbetBroadcastAvailable: true,
      }),
    ).toBe('united21_en');
  });

  it('prefers Kick mirror when Olimpbet returns Twitch fissure_cs_a', () => {
    expect(
      resolveKickBroadcastChannel({
        sportKey: 'olimp_1040',
        leagueName: 'Unknown League',
        olimpbetStreamUrl:
          'https://player.twitch.tv/?channel=fissure_cs_a&parent=olimpbet.kz',
      }),
    ).toBe('fissure_cs_a');
  });

  it('does not mirror betboom_sb_cs Twitch to Kick', () => {
    expect(
      resolveKickBroadcastChannel({
        sportKey: 'olimp_1040',
        leagueName: 'BB Streamers Battle',
        olimpbetBroadcastAvailable: true,
        olimpbetStreamUrl:
          'https://player.twitch.tv/?channel=betboom_sb_cs&parent=olimpbet.kz',
      }),
    ).toBeNull();
  });

  it('shows broadcast when Olimpbet marks stream available for prematch', () => {
    expect(
      hasKickEsportsBroadcast({
        sportKey: 'olimp_1040',
        leagueName: 'CCT EU',
        olimpbetBroadcastAvailable: true,
        isLive: false,
      }),
    ).toBe(true);
  });

  it('shows broadcast for live when Olimpbet marks stream available', () => {
    expect(
      hasKickEsportsBroadcast({
        sportKey: 'olimp_1040',
        leagueName: 'CCT EU',
        olimpbetBroadcastAvailable: true,
        isLive: true,
      }),
    ).toBe(true);
  });

  it('shows broadcast for mapped league without Olimpbet broadcast flag', () => {
    expect(
      hasKickEsportsBroadcast({
        sportKey: 'olimp_1040',
        leagueName: 'XSE Pro League',
        tournamentId: 30111,
        olimpbetBroadcastAvailable: false,
      }),
    ).toBe(true);
  });

  it('does not show broadcast for live esports without mapped league', () => {
    expect(
      hasKickEsportsBroadcast({
        sportKey: 'olimp_1040',
        leagueName: 'Eternity League',
        olimpbetBroadcastAvailable: false,
        isLive: true,
      }),
    ).toBe(false);
  });

  it('does not show broadcast for prematch without mapped league', () => {
    expect(
      hasKickEsportsBroadcast({
        sportKey: 'olimp_1040',
        leagueName: 'Eternity League',
        olimpbetBroadcastAvailable: false,
        isLive: false,
      }),
    ).toBe(false);
  });

  it('returns null for non-esports', () => {
    expect(
      resolveKickBroadcastChannel({
        sportKey: 'olimp_100',
        leagueName: 'XSE Pro League',
      }),
    ).toBeNull();
    expect(
      hasKickEsportsBroadcast({
        sportKey: 'olimp_100',
        leagueName: 'XSE Pro League',
      }),
    ).toBe(false);
  });

  it('builds Kick player URL with parent domains', () => {
    const url = buildKickPlayerUrl('xsecsb', 'https://imba.bet');
    expect(url).toContain('player.kick.com/xsecsb');
    expect(url).toContain('parent=imba.bet');
    expect(url).toContain('autoplay=true');
  });
});
