export type ManualDepositCurrency = 'KZT' | 'RUB';

export interface ManualDepositConfigItem {
  cardNumber: string;
  holderName: string;
  bankName: string;
  qrImageUrl?: string;
  minAmount: number;
}
