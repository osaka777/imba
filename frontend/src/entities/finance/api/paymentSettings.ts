const apiBase = () =>
  process.env.NEXT_PUBLIC_HOST || "http://localhost:3000";

export type PublicPaymentSettings = {
  manualDeposit: {
    KZT: { enabled: boolean; minAmount: number };
    KZT_KASPI: { enabled: boolean; minAmount: number };
    RUB: { enabled: boolean; minAmount: number };
    RUB_SBERBANK: { enabled: boolean; minAmount: number };
    USDT: { enabled: boolean; minAmount: number };
  };
  paymentMethods: Record<string, { enabled: boolean; label: string }>;
};

export async function getPublicPaymentSettings(): Promise<PublicPaymentSettings | null> {
  try {
    const res = await fetch(`${apiBase()}/api/deposit/payment-settings`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as PublicPaymentSettings;
  } catch {
    return null;
  }
}

export function isManualMethodEnabled(
  settings: PublicPaymentSettings | null | undefined,
  manualKey: keyof PublicPaymentSettings["manualDeposit"],
): boolean {
  if (!settings) return true;
  return settings.manualDeposit[manualKey]?.enabled !== false;
}
