import { resolveOneWinBroadcastUrl } from './onewin-broadcast-resolve.util';

describe('resolveOneWinBroadcastUrl nested players', () => {
  it('detects Kick iframe in sportplayer shell (no HLS)', async () => {
    const html =
      '<!DOCTYPE html><html><body><iframe src="https://player.kick.com/pisodeportivo"></iframe></body></html>';
    const http = {
      fetchText: async () => html,
    };
    const topParser =
      'https://video-translations.top-parser.com/sm/iframe?ref=' +
      Buffer.from(
        'https://smd.sportplayer.io/embed.php/?match_id=1&sk=a&type=s',
      ).toString('base64url');
    const result = await resolveOneWinBroadcastUrl(http as never, topParser);
    expect(result.available).toBe(true);
    expect(result.streamType).toBe('iframe');
    expect(result.streamUrl).toContain('player.kick.com/pisodeportivo');
  });

  it('prefers HLS over nested Kick when both present', async () => {
    const html =
      '<video data-source="https://cdn.smytdryt.live/x.m3u8"></video>' +
      '<iframe src="https://player.kick.com/other"></iframe>';
    const http = { fetchText: async () => html };
    const topParser =
      'https://video-translations.top-parser.com/sm/iframe?ref=' +
      Buffer.from('https://smd.sportplayer.io/embed.php/?m=1').toString(
        'base64url',
      );
    const result = await resolveOneWinBroadcastUrl(http as never, topParser);
    expect(result.streamType).toBe('hls');
    expect(result.streamUrl).toContain('.m3u8');
  });

  it('serves maxline as iframe when sign is unavailable (no bare soft4game)', async () => {
    const http = { fetchText: async () => null };
    const m3u8 = 'https://w1.soft4game.com/o18/stream237/playlist.m3u8';
    const topParser =
      'https://video-translations.top-parser.com/maxline/iframe?ref=' +
      encodeURIComponent(m3u8);
    const result = await resolveOneWinBroadcastUrl(http as never, topParser);
    expect(result.available).toBe(true);
    expect(result.streamType).toBe('iframe');
    expect(result.streamUrl).toBe(topParser);
  });

  it('uses signed soft4game HLS when maxline/sign returns a token', async () => {
    const http = {
      fetchText: async (url: string) => {
        if (url.includes('/maxline/sign')) {
          return JSON.stringify({ wmsAuthSign: 'abc123' });
        }
        return null;
      },
    };
    const m3u8 = 'https://w1.soft4game.com/o18/stream237/playlist.m3u8';
    const topParser =
      'https://video-translations.top-parser.com/maxline/iframe?ref=' +
      encodeURIComponent(m3u8);
    const result = await resolveOneWinBroadcastUrl(http as never, topParser);
    expect(result.streamType).toBe('hls');
    expect(result.streamUrl).toContain('wmsAuthSign=abc123');
  });
});
