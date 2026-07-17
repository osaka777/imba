import type { AppLocale } from "~/shared/i18n/locale";
import { toIntlLocale } from "~/shared/i18n/format";

const ALMATY = "Asia/Almaty";

export function formatWcCompactOdd(v: number | null, empty = "—") {
  return v != null && Number.isFinite(v) ? v.toFixed(2) : empty;
}

export function formatWcCompactTime(iso: string, locale: AppLocale = "ru") {
  const d = new Date(iso);
  const intl = toIntlLocale(locale);
  const date = new Intl.DateTimeFormat(intl, {
    day: "numeric",
    month: "short",
    timeZone: ALMATY,
  }).format(d);
  const time = new Intl.DateTimeFormat(intl, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: ALMATY,
  }).format(d);

  return { date, time };
}
