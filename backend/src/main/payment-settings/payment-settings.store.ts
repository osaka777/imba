import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import {
  ManualDepositCurrency,
  ManualDepositConfigItem,
} from '../deposit/manual-deposit.types';
import { USDT_TRC20_WALLET_DEFAULT } from '../deposit/usdt-trc20.constants';

export type PaymentMethodKey =
  | 'KZT_FOREIGN_CARD'
  | 'KZT_KASPI'
  | 'RUB_FOREIGN_CARD'
  | 'RUB_SBERBANK'
  | 'USDT_TRC20'
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
const KZT_INTL_CARD = '5351 7778 7093 5274';
const KZT_INTL_HOLDER = 'Ali Mertoglu';

function mergeManualDepositItem(
  _currency: ManualDepositCurrency,
  parsed: Partial<ManualDepositConfigItem & { enabled: boolean }> | undefined,
  defaults: ManualDepositConfigItem & { enabled: boolean },
): ManualDepositConfigItem & { enabled: boolean } {
  if (!parsed) return defaults;
  const merged = { ...defaults, ...parsed };
  if (Object.prototype.hasOwnProperty.call(parsed, 'qrImageUrl')) {
    merged.qrImageUrl = String(parsed.qrImageUrl ?? '').trim();
  }
  if (Object.prototype.hasOwnProperty.call(parsed, 'rubPerBrl')) {
    merged.rubPerBrl = Number(parsed.rubPerBrl) || defaults.rubPerBrl;
  } else if (defaults.rubPerBrl != null) {
    merged.rubPerBrl = defaults.rubPerBrl;
  }
  if (Object.prototype.hasOwnProperty.call(parsed, 'walletAddress')) {
    merged.walletAddress = String(parsed.walletAddress ?? '').trim();
  }
  return merged;
}

export function getDefaultPaymentSettings(): PaymentSettingsFile {
  return {
    manualDeposit: {
      KZT: {
        cardNumber: KZT_INTL_CARD,
        holderName: KZT_INTL_HOLDER,
        bankName: 'Международный перевод',
        qrImageUrl: '',
        minAmount: 3000,
        enabled: true,
      },
      KZT_KASPI: {
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
      RUB_SBERBANK: {
        cardNumber: '',
        holderName: DEFAULT_HOLDER,
        bankName: 'Inter',
        qrImageUrl: '',
        minAmount: 1000,
        rubPerBrl: 183,
        enabled: true,
      },
      USDT: {
        cardNumber: process.env.USDT_TRC20_WALLET || USDT_TRC20_WALLET_DEFAULT,
        walletAddress: process.env.USDT_TRC20_WALLET || USDT_TRC20_WALLET_DEFAULT,
        holderName: '',
        bankName: 'TRC-20',
        qrImageUrl: '',
        minAmount: 10,
        enabled: true,
      },
    },
    paymentMethods: {
      KZT_FOREIGN_CARD: { enabled: true, label: 'Visa/Mastercard KZT' },
      KZT_KASPI: { enabled: true, label: 'Kaspi KZT' },
      RUB_FOREIGN_CARD: { enabled: false, label: 'Visa/Mastercard RUB' },
      RUB_SBERBANK: { enabled: true, label: 'Перевод из РФ' },
      USDT_TRC20: { enabled: true, label: 'USDT TRC-20' },
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
    const defaults = getDefaultPaymentSettings();
    return {
      ...defaults,
      ...parsed,
      manualDeposit: {
        KZT: mergeManualDepositItem('KZT', parsed.manualDeposit?.KZT, defaults.manualDeposit.KZT),
        KZT_KASPI: mergeManualDepositItem(
          'KZT_KASPI',
          parsed.manualDeposit?.KZT_KASPI,
          defaults.manualDeposit.KZT_KASPI,
        ),
        RUB: mergeManualDepositItem('RUB', parsed.manualDeposit?.RUB, defaults.manualDeposit.RUB),
        RUB_SBERBANK: mergeManualDepositItem(
          'RUB_SBERBANK',
          parsed.manualDeposit?.RUB_SBERBANK,
          defaults.manualDeposit.RUB_SBERBANK,
        ),
        USDT: mergeManualDepositItem('USDT', parsed.manualDeposit?.USDT, defaults.manualDeposit.USDT),
      },
      paymentMethods: {
        ...defaults.paymentMethods,
        ...parsed.paymentMethods,
      },
      notifications: {
        ...defaults.notifications,
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
    qrImageUrl: item.qrImageUrl?.trim() || undefined,
    minAmount: item.minAmount,
    rubPerBrl: item.rubPerBrl,
    walletAddress: item.walletAddress?.trim() || item.cardNumber?.trim() || undefined,
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
