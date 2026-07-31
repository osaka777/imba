import { tOutside } from "~/shared/i18n";

export type PublicPromoModalSettings = {
  enabled: boolean;
  showInHeader: boolean;
  showOnHome: boolean;
  showOnLive: boolean;
  showOnLine: boolean;
  bannerTitle: string;
  bannerSubtitle: string;
  modalTitle: string;
  modalSubtitle: string;
  stepRegisterText: string;
  stepDepositText: string;
  bonusHighlight: string;
  ctaDeposit: string;
  ctaClaim: string;
  ctaGoToWc: string;
  successTitle: string;
  successSubtitle: string;
  heroImageUrl: string;
  bannerImageUrl: string;
  gradientFrom: string;
  gradientTo: string;
  accentColor: string;
  promoCode: string;
  promoType: 'DEPOSIT_BONUS' | 'DIRECT_BONUS';
  minDepositAmount: number;
  minDepositCurrency: string;
  bonusCurrency: string;
  presetAmounts: number[];
  wcRedirectPath: string;
  minDepositLabel: string;
};

export type PromoModalUserStatus = {
  enabled: boolean;
  promoType?: 'DEPOSIT_BONUS' | 'DIRECT_BONUS';
  minDepositMet?: boolean;
  promoUsed?: boolean;
  bonusReceived?: boolean;
  bonusPending?: boolean;
  canClaimDirect?: boolean;
  pendingDeposit?: {
    id: number;
    amount: number;
    currency: string;
    status: string;
  } | null;
  balance?: number;
  currency?: string;
  wcRedirectPath?: string;
};

const apiBase = () =>
  typeof window !== 'undefined'
    ? ''
    : process.env.NEXT_PUBLIC_API_URL || 'https://imba.bet';

export async function fetchPromoModalSettings(): Promise<PublicPromoModalSettings | null> {
  try {
    const res = await fetch(`${apiBase()}/api/promo-modal/settings`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function fetchPromoModalStatus(token: string): Promise<PromoModalUserStatus | null> {
  try {
    const res = await fetch(`${apiBase()}/api/promo-modal/status`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function claimPromoModalBonus(token: string) {
  const res = await fetch(`${apiBase()}/api/promo-modal/claim`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    let message = tOutside("common.errGetBonus");
    try {
      const data = await res.json();
      message = data?.message || data?.detail || message;
    } catch {
      message = (await res.text().catch(() => '')) || message;
    }
    throw new Error(message);
  }
  return res.json();
}
