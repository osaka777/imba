import {
  LOCALE_STORAGE_KEY,
  normalizeAppLocale,
  type AppLocale,
} from "./locale";
import { languageService } from "~/shared/services/language.service";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function defaultLocale(): AppLocale {
  return languageService.getDefaultLanguage();
}

function readLocaleCookie(): AppLocale | null {
  if (typeof document === "undefined") return null;
  try {
    const match = document.cookie.match(
      new RegExp(`(?:^|;\\s*)${LOCALE_STORAGE_KEY}=([^;]*)`),
    );
    const value = match?.[1] ? decodeURIComponent(match[1]) : null;
    return normalizeAppLocale(value);
  } catch {
    return null;
  }
}

/** Persist locale for SSR (Next.js cookies()) and reopen-after-close. */
export function writeLocaleCookie(locale: AppLocale): void {
  if (typeof document === "undefined") return;
  try {
    document.cookie = `${LOCALE_STORAGE_KEY}=${encodeURIComponent(locale)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  } catch {
    // ignore
  }
}

/** Read UI locale from localStorage → cookie → env default.
 *  Do NOT call during React render / hydration — use LocaleProvider.t instead.
 *  Safe in effects, event handlers, and API clients.
 */
export function getClientLocale(): AppLocale {
  if (typeof window === "undefined") {
    return defaultLocale();
  }

  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
    const fromStorage = normalizeAppLocale(raw);
    if (fromStorage) return fromStorage;
  } catch {
    // ignore
  }

  const fromCookie = readLocaleCookie();
  if (fromCookie) return fromCookie;

  return defaultLocale();
}

/** Sync storage → cookie so SSR and next visits keep the choice. */
export function persistClientLocale(locale: AppLocale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // ignore
  }
  writeLocaleCookie(locale);
}
