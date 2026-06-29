/** Olimpbet /entity-tags: 34 = SuperTop, 1 = TOP */
export const OLIMP_TAG_SUPER_TOP = 34;
export const OLIMP_TAG_TOP = 1;

export type OlimpbetPriorityLevel = 0 | 1 | 2;

export function resolveOlimpbetPriorityLevel(
  eventTags?: number[] | null,
  tournamentTags?: number[] | null,
): OlimpbetPriorityLevel {
  const tags = [...(eventTags ?? []), ...(tournamentTags ?? [])];
  if (tags.includes(OLIMP_TAG_SUPER_TOP)) return 2;
  if (tags.includes(OLIMP_TAG_TOP)) return 1;
  return 0;
}

export function isOlimpbetPriorityLevel(level: number | null | undefined): boolean {
  return (level ?? 0) > 0;
}

export function compareOlimpbetPriority(
  aLevel: number | null | undefined,
  bLevel: number | null | undefined,
): number {
  return (bLevel ?? 0) - (aLevel ?? 0);
}
