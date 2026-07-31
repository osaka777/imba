import type { MessageKey } from "~/shared/i18n/locales";

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
  labelKey: MessageKey;
  shortLabelKey: MessageKey;
};

export const WC_LINE_TIME_OPTIONS: WcLineTimeOption[] = [
  { id: "all", labelKey: "common.lineTimeAll", shortLabelKey: "common.lineTimeAllShort" },
  { id: "1", labelKey: "common.lineTime1", shortLabelKey: "common.lineTime1Short" },
  { id: "2", labelKey: "common.lineTime2", shortLabelKey: "common.lineTime2Short" },
  { id: "4", labelKey: "common.lineTime4", shortLabelKey: "common.lineTime4Short" },
  { id: "6", labelKey: "common.lineTime6", shortLabelKey: "common.lineTime6Short" },
  { id: "12", labelKey: "common.lineTime12", shortLabelKey: "common.lineTime12Short" },
  { id: "24", labelKey: "common.lineTime24", shortLabelKey: "common.lineTime24Short" },
  { id: "72", labelKey: "common.lineTime72", shortLabelKey: "common.lineTime72Short" },
  { id: "168", labelKey: "common.lineTime168", shortLabelKey: "common.lineTime168Short" },
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
