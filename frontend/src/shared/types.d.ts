export type SearchParams = {
  [key: string]: string | string[] | undefined;
};

export interface Balance {
  id: number;
  userId: number;
  currencyCode: string;
  amount: string;
  createdAt: string;
  updatedAt: string;
}

export interface BonusBalance {
  id: number;
  userId: number;
  currencyCode: string;
  amount: string;
  totalBonusReceived: string;
  totalWagered: string;
  requiredWager: string;
  minOdds: string;
  consecutiveWins: number;
  requiredConsecutiveWins: number;
  currentBetAmount: string;
  isActive: boolean;
  promoId: number | null;
  // Новые поля для жетонной системы
  totalTokens: number;
  remainingTokens: number;
  tokensPerBet: number;
  isTokenBased: boolean;
  requiresDeposit?: boolean;
  depositActivated?: boolean;
  maxCashout?: string | null;
  wagerMultiplier?: number;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: number;
  email: string;
  affiliatedById: number;
  balances?: Balance[];
  bonusBalances?: BonusBalance[];
  createdAt: string;
  updatedAt: string;
}

// Типы для промокодов
export type PromoType = 'DIRECT_BONUS' | 'DEPOSIT_BONUS' | 'VOUCHER';

export interface Promo {
  id: number;
  code: string;
  type: PromoType;
  value: {
    amount?: number;
    percentage?: number;
    minDeposit?: number;
    tokens?: number;
    wageringMultiplier?: number;
    minOdds?: number;
  };
  currencyCode: string;
  validFrom: string;
  validUntil: string;
  available: number;
  usedCount: number;
  partnerId?: string;
  createdAt: string;
  updatedAt: string;
}
