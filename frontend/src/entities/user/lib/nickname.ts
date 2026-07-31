export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 7;

const NICK_RE = /^[a-zA-Zа-яА-ЯёЁ0-9]+$/;
const LINKISH =
  /https?:\/\/|www\.|\.(com|net|org|ru|kz|io|bet|xyz|me|info|co|gg|tv)\b/i;

export type NicknameErrorCode =
  | "too_short"
  | "too_long"
  | "link"
  | "invalid_chars"
  | "taken";

export function validateNickname(
  raw: string | null | undefined,
): { ok: true; value: string | null } | { ok: false; code: NicknameErrorCode } {
  if (raw == null) return { ok: true, value: null };
  const value = String(raw).trim();
  if (!value) return { ok: true, value: null };
  if (value.length < NICKNAME_MIN) return { ok: false, code: "too_short" };
  if (value.length > NICKNAME_MAX) return { ok: false, code: "too_long" };
  if (LINKISH.test(value) || /[./]/.test(value)) {
    return { ok: false, code: "link" };
  }
  if (/[_\-@\s]/.test(value) || !NICK_RE.test(value)) {
    return { ok: false, code: "invalid_chars" };
  }
  return { ok: true, value };
}

export function displayNameMax6(name: string | null | undefined): string {
  if (!name) return "";
  return name.replace(/^@+/, "").slice(0, NICKNAME_MAX);
}

/** Profile URL slug: nickname if set, otherwise numeric id. */
export function traderProfileHref(params: {
  userId: number;
  nickname?: string | null;
  name?: string | null;
}): string {
  const nick = (params.nickname || "").trim();
  if (nick) return `/user/${encodeURIComponent(nick)}`;
  return `/user/${params.userId}`;
}
