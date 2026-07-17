import { createHash, randomBytes } from 'crypto';

export const KICK_OAUTH_SCOPES = [
  'user:read',
  'channel:read',
  'chat:write',
  'events:subscribe',
] as const;

function base64UrlEncode(buffer: Buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export function createPkcePair() {
  const codeVerifier = base64UrlEncode(randomBytes(32));
  const codeChallenge = base64UrlEncode(
    createHash('sha256').update(codeVerifier).digest(),
  );
  return { codeVerifier, codeChallenge };
}

export function buildKickAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scopes?: readonly string[];
}) {
  const url = new URL('https://id.kick.com/oauth/authorize');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('scope', (params.scopes ?? KICK_OAUTH_SCOPES).join(' '));
  url.searchParams.set('state', params.state);
  url.searchParams.set('code_challenge', params.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}
