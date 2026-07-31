import { getClientLocale } from "./get-client-locale";
import { translate, type MessageKey, type TranslateParams } from "./messages";

/**
 * Translate outside the React tree (API clients, error handlers, event callbacks).
 * Never call during render or hydration — it reads localStorage. Use useLocale there.
 */
export function tOutside(key: MessageKey, params?: TranslateParams): string {
  return translate(getClientLocale(), key, params);
}
