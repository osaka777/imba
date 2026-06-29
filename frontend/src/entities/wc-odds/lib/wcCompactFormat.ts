const COMPACT_MONTHS = [
  "янв",
  "фев",
  "мар",
  "апр",
  "май",
  "июн",
  "июл",
  "авг",
  "сен",
  "окт",
  "ноя",
  "дек",
] as const;

const ALMATY = "Asia/Almaty";

export function formatWcCompactOdd(v: number | null, empty = "—") {
  return v != null && Number.isFinite(v) ? v.toFixed(2) : empty;
}

export function formatWcCompactTime(iso: string) {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    timeZone: ALMATY,
  }).format(d);
  const monthIndex =
    Number(
      new Intl.DateTimeFormat("en-US", {
        month: "numeric",
        timeZone: ALMATY,
      }).format(d),
    ) - 1;
  const time = new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: ALMATY,
  }).format(d);

  return {
    date: `${day} ${COMPACT_MONTHS[monthIndex] ?? "янв"}`,
    time,
  };
}
