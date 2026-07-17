import { createHash, createHmac, timingSafeEqual } from 'crypto';

export type TelegramWidgetAuthData = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

export function verifyTelegramWidgetAuth(
  data: TelegramWidgetAuthData,
  botToken: string,
  maxAgeSec = 86_400,
): boolean {
  if (!botToken || !data.hash) return false;

  const authDate = Number(data.auth_date);
  if (!Number.isFinite(authDate)) return false;
  if (Math.floor(Date.now() / 1000) - authDate > maxAgeSec) return false;

  const fields: Record<string, string> = {
    auth_date: String(data.auth_date),
    first_name: data.first_name,
    id: String(data.id),
  };
  if (data.last_name) fields.last_name = data.last_name;
  if (data.username) fields.username = data.username;
  if (data.photo_url) fields.photo_url = data.photo_url;

  const checkString = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join('\n');

  const secretKey = createHash('sha256').update(botToken).digest();
  const computed = createHmac('sha256', secretKey)
    .update(checkString)
    .digest('hex');

  try {
    return timingSafeEqual(
      Buffer.from(computed, 'hex'),
      Buffer.from(data.hash, 'hex'),
    );
  } catch {
    return false;
  }
}

export function telegramAuthEmail(telegramUserId: string | number): string {
  return `tg${telegramUserId}@users.imba.bet`;
}
