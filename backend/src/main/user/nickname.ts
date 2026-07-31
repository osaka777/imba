export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 7;

/** Letters (latin/cyrillic) and digits only — no dots, underscores, links. */
const NICK_RE = /^[a-zA-Zа-яА-ЯёЁ0-9]+$/;

const LINKISH =
  /https?:\/\/|www\.|\.(com|net|org|ru|kz|io|bet|xyz|me|info|co|gg|tv)\b/i;

export type NicknameValidation =
  | { ok: true; value: string | null }
  | { ok: false; code: 'too_short' | 'too_long' | 'link' | 'invalid_chars' };

export function validateNickname(raw: string | null | undefined): NicknameValidation {
  if (raw == null) return { ok: true, value: null };
  const value = String(raw).trim();
  if (!value) return { ok: true, value: null };

  if (value.length < NICKNAME_MIN) return { ok: false, code: 'too_short' };
  if (value.length > NICKNAME_MAX) return { ok: false, code: 'too_long' };
  if (LINKISH.test(value) || /[./]/.test(value)) {
    return { ok: false, code: 'link' };
  }
  if (/[_\-@\s]/.test(value) || !NICK_RE.test(value)) {
    return { ok: false, code: 'invalid_chars' };
  }
  return { ok: true, value };
}

/** Safe public label: prefer nickname, else cleaned/truncated source, max 7. No *** masking. */
export function displayPublicName(params: {
  id: number;
  email: string;
  telegramUsername?: string | null;
  nickname?: string | null;
}): string {
  const nick = params.nickname?.trim();
  if (nick) return nick.slice(0, NICKNAME_MAX);

  const tg = (params.telegramUsername || '').trim().replace(/^@+/, '');
  if (tg) {
    const cleaned = tg.replace(/[^a-zA-Zа-яА-ЯёЁ0-9]/g, '').slice(0, NICKNAME_MAX);
    if (cleaned.length >= 1) return cleaned;
  }

  const local = (params.email.split('@')[0] || '').trim();
  const cleanedLocal = local.replace(/[^a-zA-Zа-яА-ЯёЁ0-9]/g, '').slice(0, NICKNAME_MAX);
  if (cleanedLocal.length >= 1) return cleanedLocal;
  return `P${params.id}`.slice(0, NICKNAME_MAX);
}
