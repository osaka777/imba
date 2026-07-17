export function isEsportsSport(sport?: string | null): boolean {
  return Boolean(sport?.startsWith("esports."));
}
