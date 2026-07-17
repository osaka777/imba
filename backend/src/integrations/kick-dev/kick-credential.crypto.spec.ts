import {
  decryptKickCredential,
  encryptKickCredential,
  resolveKickEncryptionKey,
} from './kick-credential.crypto';

describe('kick-credential.crypto', () => {
  const key = resolveKickEncryptionKey('test-secret', null);

  it('encrypts and decrypts credential payload', () => {
    const payload = {
      accessToken: 'access-123',
      refreshToken: 'refresh-456',
      scopes: 'chat:write',
    };
    const enc = encryptKickCredential(payload, key);
    expect(decryptKickCredential(enc, key)).toEqual(payload);
  });

  it('returns null for invalid blob', () => {
    expect(decryptKickCredential('invalid', key)).toBeNull();
  });
});
