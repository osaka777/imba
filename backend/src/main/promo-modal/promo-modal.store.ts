import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';

export type PromoModalPromoType = 'DEPOSIT_BONUS' | 'DIRECT_BONUS';

export interface PromoModalSettingsFile {
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
  promoType: PromoModalPromoType;
  minDepositAmount: number;
  minDepositCurrency: string;
  bonusPercentage: number;
  bonusAmount: number;
  bonusCurrency: string;
  promoAvailable: number;
  validUntilDays: number;
  presetAmounts: number[];
  wcRedirectPath: string;
  autoSyncPromo: boolean;
}

const SETTINGS_PATH =
  process.env.PROMO_MODAL_SETTINGS_PATH || '/data/logs/promo-modal-settings.json';

export function getDefaultPromoModalSettings(): PromoModalSettingsFile {
  return {
    enabled: true,
    showInHeader: true,
    showOnHome: true,
    showOnLive: true,
    showOnLine: true,
    bannerTitle: 'World Cup',
    bannerSubtitle: 'Бонус на первый депозит',
    modalTitle: 'World Cup 2026',
    modalSubtitle: 'Зарегистрируйся, пополни счёт и получи бонус на ставки ЧМ',
    stepRegisterText: 'Зарегистрируйся на imba.bet',
    stepDepositText: 'Пополни счёт — бонус активируется автоматически',
    bonusHighlight: 'до 5 000 ₸',
    ctaDeposit: 'Перейти к пополнению',
    ctaClaim: 'Получить бонус',
    ctaGoToWc: 'Смотреть линию',
    successTitle: 'Бонус активирован!',
    successSubtitle: 'Играй с бонусного счёта и отыграй условия перед выводом',
    heroImageUrl: '/fifa01.png',
    bannerImageUrl: '/fifa01.png',
    gradientFrom: '#00c2ff',
    gradientTo: '#0009da',
    accentColor: '#7AFF6E',
    promoCode: 'IMBAWELCOME',
    promoType: 'DEPOSIT_BONUS',
    minDepositAmount: 1000,
    minDepositCurrency: 'KZT',
    bonusPercentage: 50,
    bonusAmount: 5000,
    bonusCurrency: 'KZT',
    promoAvailable: 100000,
    validUntilDays: 90,
    presetAmounts: [1000, 3000, 5000],
    wcRedirectPath: '/wc',
    autoSyncPromo: true,
  };
}

function mergeSettings(
  parsed: Partial<PromoModalSettingsFile> | undefined,
  defaults: PromoModalSettingsFile,
): PromoModalSettingsFile {
  if (!parsed) return defaults;
  return {
    ...defaults,
    ...parsed,
    presetAmounts: Array.isArray(parsed.presetAmounts) && parsed.presetAmounts.length
      ? parsed.presetAmounts.map(Number).filter((n) => n > 0)
      : defaults.presetAmounts,
  };
}

export function loadPromoModalSettings(): PromoModalSettingsFile {
  try {
    if (!existsSync(SETTINGS_PATH)) {
      const defaults = getDefaultPromoModalSettings();
      savePromoModalSettings(defaults);
      return defaults;
    }
    const raw = readFileSync(SETTINGS_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<PromoModalSettingsFile>;
    return mergeSettings(parsed, getDefaultPromoModalSettings());
  } catch {
    return getDefaultPromoModalSettings();
  }
}

export function savePromoModalSettings(settings: PromoModalSettingsFile): void {
  const dir = dirname(SETTINGS_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf8');
}

export function toPublicPromoModalSettings(
  settings: PromoModalSettingsFile,
): Omit<
  PromoModalSettingsFile,
  'autoSyncPromo' | 'promoAvailable' | 'validUntilDays' | 'bonusPercentage' | 'bonusAmount'
> & {
  minDepositLabel: string;
} {
  const symbol = settings.minDepositCurrency === 'RUB' ? '₽' : settings.minDepositCurrency === 'KZT' ? '₸' : settings.minDepositCurrency;
  return {
    enabled: settings.enabled,
    showInHeader: settings.showInHeader,
    showOnHome: settings.showOnHome,
    showOnLive: settings.showOnLive,
    showOnLine: settings.showOnLine,
    bannerTitle: settings.bannerTitle,
    bannerSubtitle: settings.bannerSubtitle,
    modalTitle: settings.modalTitle,
    modalSubtitle: settings.modalSubtitle,
    stepRegisterText: settings.stepRegisterText,
    stepDepositText: settings.stepDepositText,
    bonusHighlight: settings.bonusHighlight,
    ctaDeposit: settings.ctaDeposit,
    ctaClaim: settings.ctaClaim,
    ctaGoToWc: settings.ctaGoToWc,
    successTitle: settings.successTitle,
    successSubtitle: settings.successSubtitle,
    heroImageUrl: settings.heroImageUrl,
    bannerImageUrl: settings.bannerImageUrl,
    gradientFrom: settings.gradientFrom,
    gradientTo: settings.gradientTo,
    accentColor: settings.accentColor,
    promoCode: settings.promoCode,
    promoType: settings.promoType,
    minDepositAmount: settings.minDepositAmount,
    minDepositCurrency: settings.minDepositCurrency,
    bonusCurrency: settings.bonusCurrency,
    presetAmounts: settings.presetAmounts,
    wcRedirectPath: settings.wcRedirectPath,
    minDepositLabel: `${settings.minDepositAmount.toLocaleString('ru-RU')} ${symbol}`,
  };
}
