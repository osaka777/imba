import type { AppLocale } from "~/shared/i18n/locale";
import { toIntlLocale } from "~/shared/i18n/format";
import type { MessageKey, TranslateParams } from "~/shared/i18n/messages";
import { VISIBLE_SITE_CURRENCY_CODES } from "~/shared/lib/siteCurrencies";

export type RegistrationCountry = {
  code: string;
  name: string;
  dialCode: string;
  placeholder: string;
};

export type TranslateFn = (key: MessageKey, params?: TranslateParams) => string;

const REGISTRATION_FLAG_CODES = new Set([
  "KZ", "RU", "UZ", "UA", "AZ", "KG", "TJ", "TR", "US", "AR",
]);

export function getCountryFlagUrl(code: string): string {
  const normalized = code.toUpperCase();
  if (!REGISTRATION_FLAG_CODES.has(normalized)) {
    return "/images/flags/us.svg";
  }
  return `/images/flags/${normalized.toLowerCase()}.svg`;
}

export const REGISTRATION_COUNTRIES: RegistrationCountry[] = [
  { code: "US", name: "США", dialCode: "+1", placeholder: "000 000 0000" },
  { code: "KZ", name: "Казахстан", dialCode: "+7", placeholder: "700 000 00 00" },
  { code: "RU", name: "Россия", dialCode: "+7", placeholder: "900 000 00 00" },
  { code: "UZ", name: "Узбекистан", dialCode: "+998", placeholder: "90 000 00 00" },
  { code: "UA", name: "Украина", dialCode: "+380", placeholder: "50 000 00 00" },
  { code: "AZ", name: "Азербайджан", dialCode: "+994", placeholder: "50 000 00 00" },
  { code: "KG", name: "Кыргызстан", dialCode: "+996", placeholder: "700 000 000" },
  { code: "TJ", name: "Таджикистан", dialCode: "+992", placeholder: "90 000 00 00" },
  { code: "TR", name: "Турция", dialCode: "+90", placeholder: "500 000 00 00" },
  { code: "AR", name: "Аргентина", dialCode: "+54", placeholder: "0 00 0000 000" },
];

export const DEFAULT_REGISTRATION_COUNTRY = REGISTRATION_COUNTRIES[0];

export function getCountryName(code: string, locale: AppLocale): string {
  const fallback =
    REGISTRATION_COUNTRIES.find((country) => country.code === code.toUpperCase())?.name ?? code;
  try {
    const display = new Intl.DisplayNames([toIntlLocale(locale)], { type: "region" });
    return display.of(code.toUpperCase()) ?? fallback;
  } catch {
    return fallback;
  }
}

export function formatPhoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

const LOCAL_PHONE_GROUPS: Record<string, number[]> = {
  KZ: [3, 3, 2, 2],
  RU: [3, 3, 2, 2],
  UZ: [2, 3, 2, 2],
  UA: [2, 3, 2, 2],
  AZ: [2, 3, 2, 2],
  KG: [3, 3, 3],
  TJ: [2, 3, 2, 2],
  TR: [3, 3, 2, 2],
  US: [3, 3, 4],
  AR: [1, 2, 4, 3],
};

export function formatLocalPhoneDisplay(countryCode: string, digits: string): string {
  const normalized = formatPhoneDigits(digits);
  if (!normalized) return "";

  const groups = LOCAL_PHONE_GROUPS[countryCode] ?? [3, 3, 2, 2];
  const parts: string[] = [];
  let offset = 0;

  for (const size of groups) {
    if (offset >= normalized.length) break;
    parts.push(normalized.slice(offset, offset + size));
    offset += size;
  }

  if (offset < normalized.length) {
    parts.push(normalized.slice(offset));
  }

  return parts.join(" ");
}

export function buildInternationalPhone(dialCode: string, localDigits: string): string {
  const dialDigits = dialCode.replace(/\D/g, "");
  const local = formatPhoneDigits(localDigits);
  if (!local) return "";
  return `+${dialDigits}${local}`;
}

export const REGISTRATION_CURRENCY_CODES = VISIBLE_SITE_CURRENCY_CODES;

const REGISTRATION_CURRENCY_REG_KEYS: Record<string, MessageKey> = {
  KZT: "common.currencyRegKZT",
  RUB: "common.currencyRegRUB",
  USDT: "common.currencyRegUSDT",
  UAH: "common.currencyRegUAH",
  TRY: "common.currencyRegTRY",
  UZS: "common.currencyRegUZS",
  AZN: "common.currencyRegAZN",
  KGS: "common.currencyRegKGS",
  TJS: "common.currencyRegTJS",
};

const REGISTRATION_CURRENCY_SHORT_KEYS: Record<string, MessageKey> = {
  KZT: "promo.currencyKZT",
  RUB: "common.currencyShortRUB",
  USDT: "promo.currencyUSDT",
  UAH: "promo.currencyUAH",
  TRY: "promo.currencyTRY",
  UZS: "promo.currencyUZS",
  AZN: "promo.currencyAZN",
  KGS: "promo.currencyKGS",
  TJS: "promo.currencyTJS",
};

/** @deprecated Prefer getRegistrationCurrencyLabel(isoCode, t) in UI. */
export const REGISTRATION_CURRENCY_LABELS: Record<string, string> = {
  KZT: "Тенге (KZT)",
  RUB: "Российский рубль",
  USDT: "Tether (USDT)",
  UAH: "Гривна",
  TRY: "Турецкая лира",
  UZS: "Узбекский сум",
  AZN: "Азербайджанский манат",
  KGS: "Киргизский сом",
  TJS: "Таджикский сомони",
};

/** @deprecated Prefer getRegistrationCurrencyShortLabel(isoCode, t) in UI. */
export const REGISTRATION_CURRENCY_SHORT_LABELS: Record<string, string> = {
  KZT: "Тенге",
  RUB: "Рубль",
  USDT: "USDT",
  UAH: "Гривна",
  TRY: "Лира",
  UZS: "Сум",
  AZN: "Манат",
  KGS: "Сом",
  TJS: "Сомони",
};

const REGISTRATION_CURRENCY_ICON_FILES: Record<string, string> = {
  KZT: "kzt.svg",
  RUB: "rub.svg",
  USDT: "usdt.svg",
  UAH: "uah.svg",
  TRY: "try.svg",
  UZS: "uzs.svg",
  AZN: "azn.svg",
  KGS: "kyrgyz_som.svg",
  TJS: "tjs.svg",
};

export function getCurrencyIconUrl(isoCode: string): string {
  const normalized = isoCode.toUpperCase();
  const file = REGISTRATION_CURRENCY_ICON_FILES[normalized] ?? `${normalized.toLowerCase()}.svg`;
  return `/currency/${file}`;
}

export function getRegistrationCurrencyLabel(isoCode: string, t: TranslateFn): string {
  const key = REGISTRATION_CURRENCY_REG_KEYS[isoCode.toUpperCase()];
  return key ? t(key) : isoCode;
}

export function getRegistrationCurrencyShortLabel(isoCode: string, t: TranslateFn): string {
  const key = REGISTRATION_CURRENCY_SHORT_KEYS[isoCode.toUpperCase()];
  return key ? t(key) : isoCode;
}

export function getRegistrationCurrencyListName(
  isoCode: string,
  t?: TranslateFn,
  fallback?: string,
): string {
  if (t) {
    const key = REGISTRATION_CURRENCY_REG_KEYS[isoCode.toUpperCase()];
    if (key) {
      return t(key).replace(/\s*\([A-Z]{3}\)\s*$/, "").trim();
    }
  }
  const label = REGISTRATION_CURRENCY_LABELS[isoCode];
  if (label) {
    return label.replace(/\s*\([A-Z]{3}\)\s*$/, "").trim();
  }
  return fallback ?? isoCode;
}

export function filterRegistrationCurrencies<T extends { isoCode: string; name: string }>(
  items: T[],
  query: string,
  t?: TranslateFn,
): T[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return items;

  return items.filter((item) => {
    const listName = getRegistrationCurrencyListName(item.isoCode, t, item.name);
    const shortName = t
      ? getRegistrationCurrencyShortLabel(item.isoCode, t)
      : REGISTRATION_CURRENCY_SHORT_LABELS[item.isoCode] ?? "";
    const haystack = [
      item.isoCode,
      item.name,
      listName,
      shortName,
      t ? getRegistrationCurrencyLabel(item.isoCode, t) : REGISTRATION_CURRENCY_LABELS[item.isoCode],
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalized);
  });
}

export function filterRegistrationCountries(query: string): RegistrationCountry[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return REGISTRATION_COUNTRIES;

  return REGISTRATION_COUNTRIES.filter((country) => {
    const haystack = [
      country.code,
      country.name,
      country.dialCode,
      country.dialCode.replace(/\D/g, ""),
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalized);
  });
}
