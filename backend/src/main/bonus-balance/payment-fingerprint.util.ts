export function buildPaymentFingerprint(input: {
  paymentSystem: string;
  externalId?: string;
  meta?: unknown;
}): string | null {
  const meta = input.meta && typeof input.meta === 'object'
    ? (input.meta as Record<string, unknown>)
    : {};

  const parts: string[] = [String(input.paymentSystem || '').toLowerCase()];

  for (const key of ['walletAddress', 'txHash', 'cardLast4', 'payerPhone', 'payerCard']) {
    if (meta[key]) {
      parts.push(String(meta[key]).toLowerCase().trim());
    }
  }

  if (parts.length === 1 && input.externalId) {
    parts.push(String(input.externalId).toLowerCase());
  }

  if (parts.length <= 1) {
    return null;
  }

  return parts.join('|');
}
