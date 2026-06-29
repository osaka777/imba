export type WcLineHoursFilter =
  | "all"
  | "1"
  | "2"
  | "4"
  | "6"
  | "12"
  | "24"
  | "72"
  | "168";

export type WcLineTimeOption = {
  id: WcLineHoursFilter;
  label: string;
  shortLabel: string;
};

export const WC_LINE_TIME_OPTIONS: WcLineTimeOption[] = [
  { id: "all", label: "Все время", shortLabel: "Все" },
  { id: "1", label: "В ближайший 1 час", shortLabel: "1 ч" },
  { id: "2", label: "В ближайшие 2 часа", shortLabel: "2 ч" },
  { id: "4", label: "В ближайшие 4 часа", shortLabel: "4 ч" },
  { id: "6", label: "В ближайшие 6 часов", shortLabel: "6 ч" },
  { id: "12", label: "В ближайшие 12 часов", shortLabel: "12 ч" },
  { id: "24", label: "В ближайшие сутки", shortLabel: "Сутки" },
  { id: "72", label: "В ближайшие 3 суток", shortLabel: "3 дня" },
  { id: "168", label: "В ближайшую неделю", shortLabel: "Неделя" },
];

/** Быстрый выбор в чипах */
export const WC_LINE_TIME_QUICK_IDS: WcLineHoursFilter[] = ["all", "6", "24", "168"];

export const WC_LINE_HOURS_FILTER_STORAGE_KEY = "imba-line-hours-filter";

export function getLineTimeOption(id: WcLineHoursFilter): WcLineTimeOption | undefined {
  return WC_LINE_TIME_OPTIONS.find((option) => option.id === id);
}

export function readStoredLineHoursFilter(): WcLineHoursFilter {
  if (typeof window === "undefined") return "all";
  try {
    const stored = localStorage.getItem(WC_LINE_HOURS_FILTER_STORAGE_KEY);
    if (stored && WC_LINE_TIME_OPTIONS.some((option) => option.id === stored)) {
      return stored as WcLineHoursFilter;
    }
  } catch {
    /* ignore */
  }
  return "all";
}

export function writeStoredLineHoursFilter(value: WcLineHoursFilter): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(WC_LINE_HOURS_FILTER_STORAGE_KEY, value);
  } catch {
    /* ignore */
  }
}
