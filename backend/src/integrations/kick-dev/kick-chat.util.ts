export type KickChatCommand = 'imba' | 'match' | 'promo' | 'score';

const BOT_REPLY_MARKERS = [
  'ставки на imba.bet',
  'live-матчи cs',
  'imba.bet →',
  'промокод imba.bet',
  'эфир на imba.bet',
  'ставки на imba.bet в эфире',
  'записал ',
  'угадай счёт',
];

export function stripKickEmotes(content: string) {
  return content.replace(/\[emote:\d+:[^\]]+\]/gi, '').trim();
}

export function parseKickChatCommand(content: string): KickChatCommand | null {
  const plain = stripKickEmotes(content).toLowerCase();
  const token = plain.split(/\s+/)[0] ?? '';
  if (token === '!imba' || token === '!imbabet') return 'imba';
  if (token === '!match' || token === '!матч' || token === '!matч') return 'match';
  if (token === '!promo' || token === '!промо' || token === '!promок') return 'promo';
  if (token === '!score' || token === '!счёт' || token === '!счет') return 'score';
  return null;
}

/** !счёт 2-1 или !score 2:1 */
export function parseScoreGuess(content: string): { home: number; away: number } | null {
  const plain = stripKickEmotes(content).toLowerCase();
  const match = plain.match(/^!?(?:счёт|счет|score)\s+(\d{1,2})\s*[-:]\s*(\d{1,2})\b/);
  if (!match) return null;
  const home = Number(match[1]);
  const away = Number(match[2]);
  if (!Number.isFinite(home) || !Number.isFinite(away)) return null;
  if (home > 99 || away > 99) return null;
  return { home, away };
}

export function isScoreGuessMessage(content: string) {
  return parseScoreGuess(content) != null;
}

export function isLikelyBotReply(content: string) {
  const normalized = stripKickEmotes(content).toLowerCase();
  return BOT_REPLY_MARKERS.some((marker) => normalized.includes(marker));
}
