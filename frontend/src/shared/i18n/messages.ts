import type { AppLocale } from "./locale";
import { dictionaries, type MessageKey } from "./locales";

export type { MessageKey } from "./locales";

export type TranslateParams = Record<string, string | number>;

export function translate(
  locale: AppLocale,
  key: MessageKey,
  params?: TranslateParams,
): string {
  let text = dictionaries[locale][key] ?? dictionaries.ru[key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

const SPORT_KEYS = {
  soccer: "sport.soccer",
  hockey: "sport.hockey",
  basketball: "sport.basketball",
  "table-tennis": "sport.tableTennis",
  tennis: "sport.tennis",
  volleyball: "sport.volleyball",
  mma: "sport.mma",
  "cyber-football": "sport.cyberFootball",
  "cyber-basketball": "sport.cyberBasketball",
} as const satisfies Record<string, MessageKey>;

export function translateSportLabel(
  locale: AppLocale,
  sportName: string,
  fallback: string,
): string {
  const key = SPORT_KEYS[sportName as keyof typeof SPORT_KEYS];
  return key ? translate(locale, key) : fallback;
}
