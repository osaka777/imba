export type ManualDepositCurrency =
  | 'KZT'
  | 'KZT_KASPI'
  | 'RUB'
  | 'RUB_SBERBANK'
  | 'RUB_YANDEX_BANK'
  | 'USDT';

export type ManualForeignCardPaymentSystem =
  | 'KZT_FOREIGN_CARD'
  | 'KZT_KASPI'
  | 'RUB_FOREIGN_CARD'
  | 'RUB_SBERBANK'
  | 'RUB_YANDEX_BANK';

export const MANUAL_FOREIGN_CARD_METHODS: ManualForeignCardPaymentSystem[] = [
  'KZT_FOREIGN_CARD',
  'KZT_KASPI',
  'RUB_FOREIGN_CARD',
  'RUB_SBERBANK',
  'RUB_YANDEX_BANK',
];

export function getManualDepositKeyForMethod(
  method: ManualForeignCardPaymentSystem,
): ManualDepositCurrency {
  if (method === 'RUB_FOREIGN_CARD') return 'RUB';
  if (method === 'RUB_SBERBANK') return 'RUB_SBERBANK';
  if (method === 'RUB_YANDEX_BANK') return 'RUB_YANDEX_BANK';
  if (method === 'KZT_KASPI') return 'KZT_KASPI';
  return 'KZT';
}

export function isRubRfTransferMethod(method: string): boolean {
  return method === 'RUB_SBERBANK';
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
