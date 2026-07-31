import { LOCALE_STORAGE_KEY, normalizeAppLocale, type AppLocale } from "./locale";
import { translate, type MessageKey, type TranslateParams } from "./messages";

type CookieCarrier = {
  cookies: { get(name: string): { value: string } | undefined };
  headers: { get(name: string): null | string };
};

/** UI locale for route handlers: cookie first, then Accept-Language. Defaults to ru. */
export function localeFromRequest(request: CookieCarrier): AppLocale {
  try {
    const fromCookie = normalizeAppLocale(request.cookies.get(LOCALE_STORAGE_KEY)?.value);
    if (fromCookie) return fromCookie;
    const header = request.headers.get("accept-language");
    const fromHeader = normalizeAppLocale(header?.split(",")[0]);
    if (fromHeader) return fromHeader;
  } catch {
    // ignore
  }
  return "ru";
}

/** Translate inside a route handler using the request locale. */
export function tRequest(
  request: CookieCarrier,
  key: MessageKey,
  params?: TranslateParams,
): string {
  return translate(localeFromRequest(request), key, params);
}
