import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRequestLocale } from '~/common/locale/locale.context';

@Injectable()
export class LanguageService {
  private readonly defaultLanguage: string;

  constructor(private readonly configService: ConfigService) {
    this.defaultLanguage = this.configService.get<string>('BETAPI_DEFAULT_LANGUAGE') || 'ru';
  }

  /**
   * Язык текущего HTTP-запроса (из Accept-Language / X-Locale) или fallback на env.
   */
  getActiveLanguage(): string {
    return this.getLanguageWithFallback(getRequestLocale());
  }

  /**
   * Получить язык по умолчанию из переменной окружения BETAPI_DEFAULT_LANGUAGE
   */
  getDefaultLanguage(): string {
    return this.defaultLanguage;
  }

  /**
   * Проверить, поддерживается ли указанный язык
   */
  isSupportedLanguage(language: string): boolean {
    const supportedLanguages = ['ru', 'en', 'tr', 'kk', 'kz', 'uz', 'uk', 'az', 'es', 'pt'];
    return supportedLanguages.includes(language.toLowerCase());
  }

  getLanguageWithFallback(language?: string): string {
    if (language && this.isSupportedLanguage(language)) {
      const normalized = language.toLowerCase();
      return normalized === 'kz' ? 'kk' : normalized;
    }
    return this.defaultLanguage;
  }

  getSupportedLanguages(): string[] {
    return ['ru', 'en', 'kk', 'uz', 'tr', 'uk', 'az', 'es', 'pt'];
  }
}