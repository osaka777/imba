/** Max prematch horizon on the line (1 week). */
export const WC_LINE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** UFC/MMA cards are often published 2+ weeks ahead on Olimpbet. */
export const WC_LINE_WINDOW_MS_MMA = 60 * 24 * 60 * 60 * 1000;

export const WC_MMA_SPORT_KEY = 'olimp_1001';

export function wcLineWindowMsForSportKey(sportKey?: string | null): number {
  if (sportKey === WC_MMA_SPORT_KEY) return WC_LINE_WINDOW_MS_MMA;
  return WC_LINE_WINDOW_MS;
}

export type WcLineHoursFilter =
  | 'all'
  | '1'
  | '2'
  | '4'
  | '6'
  | '12'
  | '24'
  | '72'
  | '168';

export const WC_LINE_HOUR_OPTIONS: Array<{ id: WcLineHoursFilter; label: string; hours: number | null }> = [
  { id: 'all', label: 'Все время', hours: null },
  { id: '1', label: 'В ближайший 1 час', hours: 1 },
  { id: '2', label: 'В ближайшие 2 часа', hours: 2 },
  { id: '4', label: 'В ближайшие 4 часа', hours: 4 },
  { id: '6', label: 'В ближайшие 6 часов', hours: 6 },
  { id: '12', label: 'В ближайшие 12 часов', hours: 12 },
  { id: '24', label: 'В ближайшие сутки', hours: 24 },
  { id: '72', label: 'В ближайшие 3-е суток', hours: 72 },
  { id: '168', label: 'В ближайшую неделю', hours: 168 },
];

export function parseWcLineHoursFilter(raw?: string | null): WcLineHoursFilter {
  if (!raw || raw === 'all') return 'all';
  const allowed = new Set(WC_LINE_HOUR_OPTIONS.map((o) => o.id));
  return allowed.has(raw as WcLineHoursFilter) ? (raw as WcLineHoursFilter) : 'all';
}

export function wcLineCommenceTimeRange(
  now: Date = new Date(),
  hoursFilter: WcLineHoursFilter = 'all',
  sportKey?: string | null,
): { gt: Date; lte: Date } {
  const windowEnd = new Date(now.getTime() + wcLineWindowMsForSportKey(sportKey));
  const option = WC_LINE_HOUR_OPTIONS.find((o) => o.id === hoursFilter);
  const hours = option?.hours;
  const filterEnd =
    hours != null
      ? new Date(Math.min(now.getTime() + hours * 60 * 60 * 1000, windowEnd.getTime()))
      : windowEnd;

  return { gt: now, lte: filterEnd };
}
