/**
 * Centralized language service for frontend
 * Manages language configuration and provides consistent language handling
 */

export type SupportedLanguage = 'en' | 'ru' | 'tr';

export class LanguageService {
  private static instance: LanguageService;
  private defaultLanguage: SupportedLanguage = 'ru';

  private constructor() {
    // Initialize default language from environment or fallback
    this.initializeDefaultLanguage();
  }

  public static getInstance(): LanguageService {
    if (!LanguageService.instance) {
      LanguageService.instance = new LanguageService();
    }
    return LanguageService.instance;
  }

  private initializeDefaultLanguage(): void {
    // Try to get from environment variable or use fallback
    const envLang = process.env.NEXT_PUBLIC_DEFAULT_LANGUAGE as SupportedLanguage;
    if (envLang && this.isSupportedLanguage(envLang)) {
      this.defaultLanguage = envLang;
    }
  }

  public getDefaultLanguage(): SupportedLanguage {
    return this.defaultLanguage;
  }

  public isSupportedLanguage(lang: string): lang is SupportedLanguage {
    return ['en', 'ru', 'tr'].includes(lang);
  }

  public getLanguageWithFallback(lang?: string): SupportedLanguage {
    if (lang && this.isSupportedLanguage(lang)) {
      return lang;
    }
    return this.defaultLanguage;
  }

  /**
   * Get locale string for Intl APIs (e.g., NumberFormat, DateTimeFormat)
   */
  public getLocale(lang?: SupportedLanguage): string {
    const language = lang || this.defaultLanguage;
    
    switch (language) {
      case 'en':
        return 'en-US';
      case 'ru':
        return 'ru-RU';
      case 'tr':
        return 'tr-TR';
      default:
        return 'ru-RU';
    }
  }

  /**
   * Get number format for the specified language
   */
  public getNumberFormat(lang?: SupportedLanguage): Intl.NumberFormat {
    const locale = this.getLocale(lang);
    return new Intl.NumberFormat(locale);
  }

  /**
   * Get currency format for the specified language
   */
  public getCurrencyFormat(currency: string = 'RUB', lang?: SupportedLanguage): Intl.NumberFormat {
    const locale = this.getLocale(lang);
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
    });
  }
}

// Export singleton instance
export const languageService = LanguageService.getInstance();