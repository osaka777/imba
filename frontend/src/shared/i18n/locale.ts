import type { SupportedLanguage } from "~/shared/services/language.service";

export const LOCALE_STORAGE_KEY = "imba_locale";

/** UI locales shipped in the first phase */
export type AppLocale = Extract<SupportedLanguage, "ru" | "en">;

export const APP_LOCALES: AppLocale[] = ["ru", "en"];

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
    beta: true,
  },
};

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return value === "ru" || value === "en";
}

export function flagUrl(countryCode: string, width = 40): string {
  return `https://flagcdn.com/w${width}/${countryCode}.png`;
}
