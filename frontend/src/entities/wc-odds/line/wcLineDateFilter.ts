export const WC_LINE_DATE_FILTER_STORAGE_KEY = "imba-line-date-filter";

export function formatLineDateLabel(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return d.toLocaleDateString("ru-RU", {
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
