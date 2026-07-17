const SUPPORTED_UI_LOCALES = new Set(["ru", "en", "tr", "kz", "uz"]);

export function parseRequestLocale(
  xLocaleHeader?: string | string[],
  acceptLanguageHeader?: string | string[],
): string {
  const xLocale = Array.isArray(xLocaleHeader) ? xLocaleHeader[0] : xLocaleHeader;
  if (xLocale) {
    const normalized = xLocale.toLowerCase().split("-")[0];
    if (SUPPORTED_UI_LOCALES.has(normalized)) {
      return normalized;
    }
  }

  const acceptLanguage = Array.isArray(acceptLanguageHeader)
    ? acceptLanguageHeader[0]
    : acceptLanguageHeader;

  if (acceptLanguage) {
    for (const part of acceptLanguage.split(",")) {
      const token = part.trim().split(";")[0]?.toLowerCase();
      if (!token) continue;
      const normalized = token.split("-")[0];
      if (SUPPORTED_UI_LOCALES.has(normalized)) {
        return normalized;
      }
    }
  }

  return "ru";
}
