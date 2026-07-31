const SUPPORTED_UI_LOCALES = new Set([
  'ru',
  'en',
  'tr',
  'kk',
  'kz', // legacy alias for Kazakh
  'uz',
  'uk',
  'az',
  'es',
  'pt',
]);

const LOCALE_ALIASES: Record<string, string> = {
  kz: 'kk',
  ua: 'uk',
  gb: 'en',
  us: 'en',
  br: 'pt',
  mx: 'es',
};

export function parseRequestLocale(
  xLocaleHeader?: string | string[],
  acceptLanguageHeader?: string | string[],
): string {
  const normalize = (raw: string): string | null => {
    const token = raw.toLowerCase().split('-')[0];
    if (!token) return null;
    if (LOCALE_ALIASES[token]) return LOCALE_ALIASES[token];
    if (SUPPORTED_UI_LOCALES.has(token)) {
      return token === 'kz' ? 'kk' : token;
    }
    return null;
  };

  const xLocale = Array.isArray(xLocaleHeader) ? xLocaleHeader[0] : xLocaleHeader;
  if (xLocale) {
    const normalized = normalize(xLocale);
    if (normalized) return normalized;
  }

  const acceptLanguage = Array.isArray(acceptLanguageHeader)
    ? acceptLanguageHeader[0]
    : acceptLanguageHeader;

  if (acceptLanguage) {
    for (const part of acceptLanguage.split(',')) {
      const token = part.trim().split(';')[0];
      if (!token) continue;
      const normalized = normalize(token);
      if (normalized) return normalized;
    }
  }

  return 'ru';
}
