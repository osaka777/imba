/**
 * Moderation for prediction event comments.
 * Goals: block links/ads, filter strong profanity, keep short readable text.
 * GIFs are allowed only from Tenor/Giphy allowlisted HTTPS URLs.
 */

export const COMMENT_MIN_LEN = 2;
export const COMMENT_MAX_LEN = 280;

export type CommentModerationCode =
  | 'empty'
  | 'too_short'
  | 'too_long'
  | 'link'
  | 'ads'
  | 'profanity'
  | 'spam'
  | 'gif';

export type CommentModerationResult =
  | { ok: true; body: string; gifUrl: string | null }
  | { ok: false; code: CommentModerationCode };

/** URLs, domains, messengers, invites. */
const LINKISH =
  /https?:\/\/|www\.|t\.me\/|telegram\.me\/|wa\.me\/|bit\.ly\/|tinyurl\.|goo\.gl\/|[\w.-]+\.(com|net|org|ru|kz|io|bet|xyz|me|info|co|gg|tv|app|shop|online|site|club|pro|vip|top|cc|su|pw|link|click)\b/i;

const MENTION_HANDLE = /(^|[\s(,])@[a-zA-Z0-9_]{3,}/;
const PHONEISH =
  /(?:\+?\d[\d\-\s()]{8,}\d)|(?:\b\d{3}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}\b)/;

/** Promo / casino / deposit funnel language. */
const AD_PATTERNS: RegExp[] = [
  /\b(промокод|промо[\s-]?код|promo[\s-]?code|реферал|referral|бонус\s*код)\b/i,
  /\b(казино|casino|букмекер|букц|1xbet|melbet|pin[\s-]?up|mostbet|vavada|pokerdom)\b/i,
  /\b(бесплатн(ый|ая|ое)\s*(бонус|спин|деньги)|free\s*(spin|bonus|money))\b/i,
  /\b(подписывай(тесь|ся)|subscribe|вступай(те)?\s*в\s*(канал|группу|чат))\b/i,
  /\b(пиши(те)?\s*(в|мне)|напиши(те)?\s*(в|мне)|пиши\s*л[сc]|direct\s*message|в\s*л[сc])\b/i,
  /\b(крипт[ао]|usdt\s*кошел[её]к|выведу\s*на|обмен\s*валют)\b/i,
  /\b(заработок|пассивный\s*доход|гарантия\s*\d+%|удвоение\s*депозита)\b/i,
];

/**
 * Strong RU/EN swear stems. Deliberately short list of clear obscenities;
 * mild slang is allowed. Matching uses stripped/leet-normalized text.
 */
const PROFANITY_STEMS = [
  'хуй',
  'хуе',
  'хуё',
  'хуи',
  'хуя',
  'бляд',
  'блят',
  'ебан',
  'ебал',
  'ебат',
  'ёбан',
  'ёбал',
  'пизд',
  'мудил',
  'мудак',
  'сука',
  'суки',
  'сучк',
  'гандон',
  'залуп',
  'fuck',
  'fuk',
  'shit',
  'bitch',
  'cunt',
  'asshole',
  'nigger',
  'nigga',
];

/** Only Tenor / Giphy / OtakuGIFs CDN hosts — never arbitrary remote images. */
const GIF_URL_RE =
  /^https:\/\/(media\d*\.tenor\.com|c\.tenor\.com|media\d*\.giphy\.com|i\.giphy\.com|media\.giphy\.com|cdn\.otakugifs\.xyz)\/[^\s<>"']{8,480}$/i;

export function isAllowedPredictionGifUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const trimmed = String(url).trim();
  if (trimmed.length > 512) return false;
  return GIF_URL_RE.test(trimmed);
}

function normalizeForScan(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/0/g, 'o')
    .replace(/[@*]+/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function hasProfanity(raw: string): boolean {
  const compact = normalizeForScan(raw);
  if (!compact) return false;
  return PROFANITY_STEMS.some((stem) => compact.includes(stem));
}

function looksLikeSpam(body: string): boolean {
  const letters = body.replace(/\s+/g, '');
  if (letters.length >= 12) {
    const unique = new Set(letters.toLowerCase()).size;
    if (unique <= 3) return true; // "аааааааааааа"
  }
  const sameChar = /(.)\1{7,}/u;
  if (sameChar.test(body)) return true;
  const upper = body.replace(/[^A-Za-zА-ЯЁа-яё]/g, '');
  if (upper.length >= 12 && upper === upper.toUpperCase()) return true;
  return false;
}

export function moderatePredictionComment(
  raw: string | null | undefined,
  gifUrlRaw?: string | null,
): CommentModerationResult {
  const gifUrl =
    gifUrlRaw != null && String(gifUrlRaw).trim()
      ? String(gifUrlRaw).trim()
      : null;

  if (gifUrl && !isAllowedPredictionGifUrl(gifUrl)) {
    return { ok: false, code: 'gif' };
  }

  const body = String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!body && !gifUrl) return { ok: false, code: 'empty' };

  if (body) {
    if (!gifUrl && body.length < COMMENT_MIN_LEN) {
      return { ok: false, code: 'too_short' };
    }
    if (body.length > COMMENT_MAX_LEN) return { ok: false, code: 'too_long' };

    if (LINKISH.test(body) || MENTION_HANDLE.test(body)) {
      return { ok: false, code: 'link' };
    }
    if (PHONEISH.test(body)) return { ok: false, code: 'ads' };
    if (AD_PATTERNS.some((re) => re.test(body))) return { ok: false, code: 'ads' };
    if (hasProfanity(body)) return { ok: false, code: 'profanity' };
    if (looksLikeSpam(body)) return { ok: false, code: 'spam' };
  }

  return { ok: true, body, gifUrl };
}

export function commentModerationMessage(code: CommentModerationCode): string {
  switch (code) {
    case 'empty':
      return 'Напишите комментарий или выберите GIF';
    case 'too_short':
      return 'Слишком короткий комментарий';
    case 'too_long':
      return `Максимум ${COMMENT_MAX_LEN} символов`;
    case 'link':
      return 'Ссылки и адреса сайтов запрещены';
    case 'ads':
      return 'Реклама, промокоды и контакты запрещены';
    case 'profanity':
      return 'Уберите нецензурную лексику';
    case 'spam':
      return 'Похоже на спам — переформулируйте';
    case 'gif':
      return 'Этот GIF нельзя отправить';
    default:
      return 'Комментарий не принят';
  }
}
