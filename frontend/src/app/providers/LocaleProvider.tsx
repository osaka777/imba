"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  APP_LOCALES,
  isAppLocale,
  type AppLocale,
} from "~/shared/i18n/locale";
import { createFormatters, type Formatters } from "~/shared/i18n/format";
import {
  getClientLocale,
  persistClientLocale,
} from "~/shared/i18n/get-client-locale";
import { translate, type MessageKey, type TranslateParams } from "~/shared/i18n/messages";
import { languageService } from "~/shared/services/language.service";

type LocaleContextType = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  t: (key: MessageKey, params?: TranslateParams) => string;
  format: Formatters;
  locales: AppLocale[];
  /** False until client storage has been applied (avoid SSR/client mismatch work). */
  ready: boolean;
};

export const LocaleContext = createContext<LocaleContextType | null>(null);

export const LocaleProvider = ({ children }: { children: React.ReactNode }) => {
  // SSR + first client paint must match. Reading localStorage here caused
  // "Application error" on every reload for users with a non-default locale.
  const [locale, setLocaleState] = useState<AppLocale>(
    () => languageService.getDefaultLanguage(),
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = getClientLocale();
    setLocaleState(stored);
    persistClientLocale(stored);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.lang = locale;
  }, [locale, ready]);

  const setLocale = useCallback((next: AppLocale) => {
    if (!isAppLocale(next)) return;
    persistClientLocale(next);
    setLocaleState(next);
    window.dispatchEvent(new Event("localeChanged"));
  }, []);

  const t = useCallback(
    (key: MessageKey, params?: TranslateParams) => translate(locale, key, params),
    [locale],
  );

  const format = useMemo(() => createFormatters(locale), [locale]);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
      format,
      locales: APP_LOCALES,
      ready,
    }),
    [locale, setLocale, t, format, ready],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
};
