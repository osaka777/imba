import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LanguageService {
  private readonly defaultLanguage: string;

  constructor(private readonly configService: ConfigService) {
    this.defaultLanguage = this.configService.get<string>('BETAPI_DEFAULT_LANGUAGE') || 'ru';
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
    const supportedLanguages = ['ru', 'en', 'tr', 'kz', 'uz'];
    return supportedLanguages.includes(language.toLowerCase());
  }

  /**
   * Получить язык с fallback на язык по умолчанию
   */
  getLanguageWithFallback(language?: string): string {
    if (language && this.isSupportedLanguage(language)) {
      return language.toLowerCase();
    }
    return this.defaultLanguage;
  }

  /**
   * Получить список поддерживаемых языков
   */
  getSupportedLanguages(): string[] {
    return ['ru', 'en', 'tr', 'kz', 'uz'];
  }
}