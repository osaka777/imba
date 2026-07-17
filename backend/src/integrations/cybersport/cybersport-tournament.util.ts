/** URL slug for a cybersport tournament page: `ar3ena-open-44356`. */
export function slugifyCyberTournament(name: string, id: number): string {
  const normalized = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  const base = normalized || "tournament";
  return `${base}-${id}`;
}

export function tournamentIdFromCyberSlug(slug: string): number | null {
  const match = slug.trim().match(/-(\d+)$/);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}
