"use client";

import { useParams, useSearchParams } from "next/navigation";

import { apiSportFromPathSlug } from "~/entities/cybersport/lib/cyberSportPaths";

/** Active sport from path (`/soccer`), cyber discipline (`/cybersport/cs2/...`), or query. */
export function useSportFilter(): string | undefined {
  const params = useParams();
  const searchParams = useSearchParams();
  const fromPath = params?.sport as string | undefined;
  const fromQuery = searchParams.get("sport") ?? undefined;
  const discipline = params?.discipline as string | undefined;
  const fromDiscipline = discipline
    ? (apiSportFromPathSlug(discipline) ?? undefined)
    : undefined;
  return fromPath ?? fromQuery ?? fromDiscipline ?? undefined;
}
