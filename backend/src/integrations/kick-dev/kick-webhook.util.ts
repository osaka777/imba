import { createVerify } from 'crypto';

const KICK_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAq/+l1WnlRrGSolDMA+A8
6rAhMbQGmQ2SapVcGM3zq8ANXjnhDWocMqfWcTd95btDydITa10kDvHzw9WQOqp2
MZI7ZyrfzJuz5nhTPCiJwTwnEtWft7nV14BYRDHvlfqPUaZ+1KR4OCaO/wWIk/rQ
L/TjY0M70gse8rlBkbo2a8rKhu69RQTRsoaf4DVhDPEeSeI5jVrRDGAMGL3cGuyY
6CLKGdjVEM78g3JfYOvDU/RvfqD7L89TZ3iN94jrmWdGz34JNlEI5hqK8dd7C5EF
BEbZ5jgB8s8ReQV8H+MkuffjdAj3ajDDX3DOJMIut1lBrUVD1AaSrGCKHooWoL2e
twIDAQAB
-----END PUBLIC KEY-----`;

export type KickWebhookHeaders = {
  messageId?: string;
  timestamp?: string;
  signature?: string;
  eventType?: string;
  eventVersion?: string;
};

export function parseKickWebhookHeaders(headers: Record<string, string | string[] | undefined>): KickWebhookHeaders {
  const pick = (name: string) => {
    const raw = headers[name] ?? headers[name.toLowerCase()];
    return Array.isArray(raw) ? raw[0] : raw;
  };

  return {
    messageId: pick('kick-event-message-id'),
    timestamp: pick('kick-event-message-timestamp'),
    signature: pick('kick-event-signature'),
    eventType: pick('kick-event-type'),
    eventVersion: pick('kick-event-version'),
  };
}

export function verifyKickWebhookSignature(params: {
  messageId: string;
  timestamp: string;
  rawBody: string;
  signatureB64: string;
  publicKeyPem?: string;
}) {
  const payload = `${params.messageId}.${params.timestamp}.${params.rawBody}`;
  const verifier = createVerify('RSA-SHA256');
  verifier.update(payload);
  verifier.end();
  return verifier.verify(params.publicKeyPem || KICK_PUBLIC_KEY_PEM, params.signatureB64, 'base64');
}

const BRANDING_TAG_RE = /^(imba|imba_partner|imbabet)$/i;

export function hasImbaBranding(title?: string | null, tags?: string[] | null) {
  const normalizedTitle = (title || '').toLowerCase();
  if (normalizedTitle.includes('imba')) return true;
  return (tags || []).some((tag) => BRANDING_TAG_RE.test(tag.trim()));
}
