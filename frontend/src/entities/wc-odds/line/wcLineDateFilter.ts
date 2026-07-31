export const WC_LINE_DATE_FILTER_STORAGE_KEY = "imba-line-date-filter";

export function formatLineDateLabel(date: string, locale = "ru"): string {
  const d = new Date(`${date}T12:00:00Z`);
  const bcp47 =
    locale === "kk" ? "kk-KZ"
    : locale === "uz" ? "uz-UZ"
    : locale === "uk" ? "uk-UA"
    : locale === "tr" ? "tr-TR"
    : locale === "az" ? "az-AZ"
    : locale === "es" ? "es-ES"
    : locale === "pt" ? "pt-PT"
    : locale === "en" ? "en-US"
    : "ru-RU";
  return d.toLocaleDateString(bcp47, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Almaty",
  });
}

export function readStoredLineDateFilter(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(WC_LINE_DATE_FILTER_STORAGE_KEY);
    return stored && /^\d{4}-\d{2}-\d{2}$/.test(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function writeStoredLineDateFilter(value: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!value) {
      localStorage.removeItem(WC_LINE_DATE_FILTER_STORAGE_KEY);
      return;
    }
    localStorage.setItem(WC_LINE_DATE_FILTER_STORAGE_KEY, value);
  } catch {
    /* ignore */
  }
}
