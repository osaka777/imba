import { isLikelyBotReply, parseKickChatCommand, stripKickEmotes } from './kick-chat.util';

describe('kick-chat.util', () => {
  it('parses !imba, !match and !promo commands', () => {
    expect(parseKickChatCommand('!imba')).toBe('imba');
    expect(parseKickChatCommand('!IMBA hello')).toBe('imba');
    expect(parseKickChatCommand('!match')).toBe('match');
    expect(parseKickChatCommand('!матч')).toBe('match');
    expect(parseKickChatCommand('!promo')).toBe('promo');
    expect(parseKickChatCommand('!промо')).toBe('promo');
    expect(parseKickChatCommand('hello')).toBeNull();
  });

  it('strips kick emotes before parsing', () => {
    const raw = '!imba [emote:4148074:HYPERCLAP]';
    expect(parseKickChatCommand(raw)).toBe('imba');
    expect(stripKickEmotes(raw)).toBe('!imba');
  });

  it('detects bot replies', () => {
    expect(isLikelyBotReply('Ставки на imba.bet → https://imba.bet')).toBe(true);
    expect(isLikelyBotReply('!imba')).toBe(false);
  });
});
