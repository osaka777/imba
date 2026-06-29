export type ManualDepositCurrency = 'KZT' | 'KZT_KASPI' | 'RUB' | 'RUB_SBERBANK' | 'USDT';

export type ManualForeignCardPaymentSystem =
  | 'KZT_FOREIGN_CARD'
  | 'KZT_KASPI'
  | 'RUB_FOREIGN_CARD'
  | 'RUB_SBERBANK';

export const MANUAL_FOREIGN_CARD_METHODS: ManualForeignCardPaymentSystem[] = [
  'KZT_FOREIGN_CARD',
  'KZT_KASPI',
  'RUB_FOREIGN_CARD',
  'RUB_SBERBANK',
];

export function getManualDepositKeyForMethod(
  method: ManualForeignCardPaymentSystem,
): ManualDepositCurrency {
  if (method === 'RUB_FOREIGN_CARD') return 'RUB';
  if (method === 'RUB_SBERBANK') return 'RUB_SBERBANK';
  if (method === 'KZT_KASPI') return 'KZT_KASPI';
  return 'KZT';
}

export interface ManualDepositConfigItem {
  cardNumber: string;
  holderName: string;
  bankName: string;
  qrImageUrl?: string;
  minAmount: number;
  /** TRC-20 deposit wallet */
  walletAddress?: string;
  /** RUB per 1 BRL — used for «Перевод из РФ» */
  rubPerBrl?: number;
}
