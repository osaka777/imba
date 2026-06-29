export function wcCompetitorIconUrl(
  _competitorId?: number | null,
  iconUrl?: string | null,
): string | null {
  return iconUrl?.trim() || null;
}
