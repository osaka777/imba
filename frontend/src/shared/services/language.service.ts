/**
 * Centralized language service for frontend
 * Manages language configuration and provides consistent language handling
 */

import type { AppLocale } from "~/shared/i18n/locale";
import { APP_LOCALES, normalizeAppLocale } from "~/shared/i18n/locale";

export type SupportedLanguage = AppLocale;

export class LanguageService {
  private static instance: LanguageService;
  private defaultLanguage: SupportedLanguage = "ru";

  private constructor() {
    this.initializeDefaultLanguage();
  }

  public static getInstance(): LanguageService {
    if (!LanguageService.instance) {
      LanguageService.instance = new LanguageService();
    }
    return LanguageService.instance;
  }

  private initializeDefaultLanguage(): void {
    const envLang = process.env.NEXT_PUBLIC_DEFAULT_LANGUAGE;
    const normalized = normalizeAppLocale(envLang);
    if (normalized) {
      this.defaultLanguage = normalized;
    }
  }

  public getDefaultLanguage(): SupportedLanguage {
    return this.defaultLanguage;
  }

  public isSupportedLanguage(lang: string): lang is SupportedLanguage {
    return normalizeAppLocale(lang) !== null;
  }

  public getLanguageWithFallback(lang?: string): SupportedLanguage {
    return normalizeAppLocale(lang) ?? this.defaultLanguage;
  }

  public getSupportedLanguages(): SupportedLanguage[] {
    return [...APP_LOCALES];
  }

  /**
   * Get locale string for Intl APIs (e.g., NumberFormat, DateTimeFormat)
   */
  public getLocale(lang?: SupportedLanguage): string {
    const language = lang || this.defaultLanguage;

    switch (language) {
      case "en":
        return "en-US";
      case "ru":
        return "ru-RU";
      case "kk":
        return "kk-KZ";
      case "uz":
        return "uz-UZ";
      case "tr":
        return "tr-TR";
      case "uk":
        return "uk-UA";
      case "az":
        return "az-AZ";
      case "es":
        return "es-ES";
      case "pt":
        return "pt-BR";
      default:
        return "ru-RU";
    }
  }

  public getNumberFormat(lang?: SupportedLanguage): Intl.NumberFormat {
    return new Intl.NumberFormat(this.getLocale(lang));
  }

  public getCurrencyFormat(
    currency: string = "RUB",
    lang?: SupportedLanguage,
  ): Intl.NumberFormat {
    return new Intl.NumberFormat(this.getLocale(lang), {
      style: "currency",
      currency,
    });
  }
}

export const languageService = LanguageService.getInstance();
