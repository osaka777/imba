import type { AppLocale } from "~/shared/i18n/locale";
import { prefersEnglishFallback } from "~/shared/i18n/locale";

/** Pick RU/EN content: EN locales → en then ru; CIS → ru then en. */
export function pickPredictionText(
  ru: string | null | undefined,
  en: string | null | undefined,
  locale: AppLocale,
): string {
  const r = (ru ?? "").trim();
  const e = (en ?? "").trim();
  if (prefersEnglishFallback(locale)) return e || r;
  return r || e;
}
