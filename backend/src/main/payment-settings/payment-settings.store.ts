import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import {
  ManualDepositCurrency,
  ManualDepositConfigItem,
} from '../deposit/manual-deposit.types';

export type PaymentMethodKey =
  | 'KZT_FOREIGN_CARD'
  | 'RUB_FOREIGN_CARD'
  | 'NirvanaPay'
  | 'Aaio'
  | 'Greengo'
  | 'Crocopay';

export interface PaymentSettingsFile {
  manualDeposit: Record<ManualDepositCurrency, ManualDepositConfigItem & { enabled: boolean }>;
  paymentMethods: Record<
    PaymentMethodKey,
    { enabled: boolean; label: string }
  >;
  notifications: {
    telegramDepositNotify: boolean;
    telegramWithdrawNotify: boolean;
  };
}

const SETTINGS_PATH =
  process.env.PAYMENT_SETTINGS_PATH || '/data/payment-settings.json';

const DEFAULT_CARD = '5351 7737 9598 4711';
const DEFAULT_HOLDER = 'Ali Kaliyev';

export function getDefaultPaymentSettings(): PaymentSettingsFile {
  return {
    manualDeposit: {
      KZT: {
        cardNumber: DEFAULT_CARD,
        holderName: DEFAULT_HOLDER,
        bankName: 'Kaspi Bank',
        qrImageUrl:
          process.env.MANUAL_DEPOSIT_KZT_QR_URL || '/uploads/qr/kaspi-kzt.png',
        minAmount: 3000,
        enabled: true,
      },
      RUB: {
        cardNumber: DEFAULT_CARD,
        holderName: DEFAULT_HOLDER,
        bankName: process.env.MANUAL_DEPOSIT_RUB_BANK || 'Kaspi',
        qrImageUrl:
          process.env.MANUAL_DEPOSIT_RUB_QR_URL || '/uploads/qr/kaspi-rub.png',
        minAmount: 2000,
        enabled: true,
      },
    },
    paymentMethods: {
      KZT_FOREIGN_CARD: { enabled: true, label: 'Visa/Mastercard KZT' },
      RUB_FOREIGN_CARD: { enabled: true, label: 'Visa/Mastercard RUB' },
      NirvanaPay: { enabled: true, label: 'NirvanaPay' },
      Aaio: { enabled: true, label: 'Aaio / Карты' },
      Greengo: { enabled: false, label: 'Greengo' },
      Crocopay: { enabled: false, label: 'Crocopay' },
    },
    notifications: {
      telegramDepositNotify: true,
      telegramWithdrawNotify: true,
    },
  };
}

export function loadPaymentSettings(): PaymentSettingsFile {
  try {
    if (!existsSync(SETTINGS_PATH)) {
      const defaults = getDefaultPaymentSettings();
      savePaymentSettings(defaults);
      return defaults;
    }
    const raw = readFileSync(SETTINGS_PATH, 'utf8');
    const parsed = JSON.parse(raw) as PaymentSettingsFile;
    return {
      ...getDefaultPaymentSettings(),
      ...parsed,
      manualDeposit: {
        ...getDefaultPaymentSettings().manualDeposit,
        ...parsed.manualDeposit,
      },
      paymentMethods: {
        ...getDefaultPaymentSettings().paymentMethods,
        ...parsed.paymentMethods,
      },
      notifications: {
        ...getDefaultPaymentSettings().notifications,
        ...parsed.notifications,
      },
    };
  } catch {
    return getDefaultPaymentSettings();
  }
}

export function savePaymentSettings(settings: PaymentSettingsFile): void {
  const dir = dirname(SETTINGS_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf8');
}

export function getManualDepositFromSettings(
  currency: ManualDepositCurrency,
): ManualDepositConfigItem {
  const settings = loadPaymentSettings();
  const item = settings.manualDeposit[currency];
  return {
    cardNumber: item.cardNumber,
    holderName: item.holderName,
    bankName: item.bankName,
    qrImageUrl: item.qrImageUrl,
    minAmount: item.minAmount,
  };
}

export function isManualDepositEnabled(currency: ManualDepositCurrency): boolean {
  const settings = loadPaymentSettings();
  return settings.manualDeposit[currency]?.enabled !== false;
}

export function isPaymentMethodEnabled(key: PaymentMethodKey): boolean {
  const settings = loadPaymentSettings();
  return settings.paymentMethods[key]?.enabled !== false;
}
