export const LOCALE_STORAGE_KEY = "imba_locale";

/**
 * UI locales — wave 1 CIS + wave 2 LatAm (es, pt).
 * kk = Kazakh (ISO 639-1); backend also accepts legacy `kz`.
 */
export type AppLocale = "ru" | "en" | "kk" | "uz" | "tr" | "uk" | "az" | "es" | "pt";

export const APP_LOCALES: AppLocale[] = [
  "ru",
  "en",
  "kk",
  "uz",
  "tr",
  "uk",
  "az",
  "es",
  "pt",
];

export type LocaleMeta = {
  code: AppLocale;
  /** Native language name (как у 1win — верхняя строка) */
  nativeName: string;
  /** Название на английском (нижняя строка) */
  englishName: string;
  /** ISO 3166-1 alpha-2 для flagcdn */
  flag: string;
  /** Show "(Beta)" badge in the language picker */
  beta?: boolean;
};

export const LOCALE_META: Record<AppLocale, LocaleMeta> = {
  ru: {
    code: "ru",
    nativeName: "Русский",
    englishName: "Russian",
    flag: "ru",
  },
  en: {
    code: "en",
    nativeName: "English",
    englishName: "English",
    flag: "gb",
  },
  kk: {
    code: "kk",
    nativeName: "Қазақша",
    englishName: "Kazakh",
    flag: "kz",
    beta: true,
  },
  uz: {
    code: "uz",
    nativeName: "Oʻzbekcha",
    englishName: "Uzbek",
    flag: "uz",
    beta: true,
  },
  tr: {
    code: "tr",
    nativeName: "Türkçe",
    englishName: "Turkish",
    flag: "tr",
    beta: true,
  },
  uk: {
    code: "uk",
    nativeName: "Українська",
    englishName: "Ukrainian",
    flag: "ua",
    beta: true,
  },
  az: {
    code: "az",
    nativeName: "Azərbaycanca",
    englishName: "Azerbaijani",
    flag: "az",
    beta: true,
  },
  es: {
    code: "es",
    nativeName: "Español",
    englishName: "Spanish",
    flag: "es",
    beta: true,
  },
  pt: {
    code: "pt",
    nativeName: "Português",
    englishName: "Portuguese",
    flag: "br",
    beta: true,
  },
};

const APP_LOCALE_SET = new Set<string>(APP_LOCALES);

/** Map legacy / alternate codes to AppLocale */
const LOCALE_ALIASES: Record<string, AppLocale> = {
  kz: "kk",
  ua: "uk",
  gb: "en",
  us: "en",
  br: "pt",
  mx: "es",
  ar: "es",
};

export function normalizeAppLocale(value: string | null | undefined): AppLocale | null {
  if (!value) return null;
  const normalized = value.toLowerCase().split("-")[0] ?? "";
  if (APP_LOCALE_SET.has(normalized)) return normalized as AppLocale;
  return LOCALE_ALIASES[normalized] ?? null;
}

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return normalizeAppLocale(value) !== null;
}

export function flagUrl(countryCode: string, width = 40): string {
  return `https://flagcdn.com/w${width}/${countryCode}.png`;
}

/** Olimpbet / feed name overlay only knows ru|en */
export type FeedLocale = "ru" | "en";

/**
 * Locales that fall back to English when a key is missing
 * (LatAm + Turkish — EN is far more readable than RU).
 * CIS locales fall back to Russian.
 */
export const ENGLISH_FALLBACK_LOCALES: ReadonlySet<AppLocale> = new Set([
  "en",
  "es",
  "pt",
  "tr",
]);

export function prefersEnglishFallback(locale: AppLocale): boolean {
  return ENGLISH_FALLBACK_LOCALES.has(locale);
}

/** UI string fallback chain: locale → en|ru → ru → key */
export function localeFallbackChain(locale: AppLocale): AppLocale[] {
  if (locale === "ru") return ["ru"];
  if (prefersEnglishFallback(locale)) {
    return locale === "en" ? ["en", "ru"] : [locale, "en", "ru"];
  }
  return [locale, "ru"];
}

/** Map UI locale → feed overlay language (ru|en only). */
export function toFeedLocale(locale: AppLocale): FeedLocale {
  return prefersEnglishFallback(locale) ? "en" : "ru";
}
