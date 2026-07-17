import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

export type KickCredentialPayload = {
  accessToken: string;
  refreshToken?: string | null;
  scopes?: string | null;
};

export function resolveKickEncryptionKey(secret: string, explicitKey?: string | null) {
  const raw = explicitKey?.trim();
  if (raw) {
    const buf = Buffer.from(raw, raw.length === 64 ? 'hex' : 'base64');
    if (buf.length === 32) return buf;
  }
  return scryptSync(secret || 'kick-token-fallback', 'kick-partner-token-v1', 32);
}

export function encryptKickCredential(payload: KickCredentialPayload, key: Buffer) {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptKickCredential(blob: string, key: Buffer): KickCredentialPayload | null {
  try {
    const buf = Buffer.from(blob, 'base64');
    if (buf.length <= IV_LEN + TAG_LEN) return null;
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const enc = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const text = Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
    const parsed = JSON.parse(text) as KickCredentialPayload;
    if (!parsed?.accessToken || typeof parsed.accessToken !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}
