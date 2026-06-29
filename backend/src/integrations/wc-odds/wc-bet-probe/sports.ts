/** Line sports scanned when WC_BET_PROBE_SPORT=all */
export const WC_PROBE_LINE_SPORTS = [
  'soccer',
  'tennis',
  'volleyball',
  'basketball',
  'hockey',
  'table-tennis',
  'mma',
  'cyber-football',
  'cyber-basketball',
] as const;

export type WcProbeLineSport = (typeof WC_PROBE_LINE_SPORTS)[number];

export function resolveProbeSports(sport: string): string[] {
  const normalized = sport.trim().toLowerCase();
  if (!normalized || normalized === 'all') return [...WC_PROBE_LINE_SPORTS];
  if (normalized.includes(',')) {
    return normalized.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [normalized];
}

export function isAllSportsProbe(sport: string): boolean {
  const normalized = sport.trim().toLowerCase();
  return !normalized || normalized === 'all' || normalized.includes(',');
}
