"use client";

import { useParams, useSearchParams } from "next/navigation";

/** Active sport from path (`/soccer`) or query (`/live?sport=soccer`). */
export function useSportFilter(): string | undefined {
  const params = useParams();
  const searchParams = useSearchParams();
  const fromPath = params?.sport as string | undefined;
  const fromQuery = searchParams.get("sport") ?? undefined;
  return fromPath ?? fromQuery ?? undefined;
}
