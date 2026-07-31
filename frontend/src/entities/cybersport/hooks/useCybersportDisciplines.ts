"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchCybersportDisciplines } from "~/entities/cybersport/api/client";

export function useCybersportDisciplines() {
  return useQuery({
    queryKey: ["cybersport-disciplines"],
    queryFn: fetchCybersportDisciplines,
    staleTime: 5 * 60_000,
  });
}

export function useCyberSportIconUrl(apiSport: string): string | null {
  const { data } = useCybersportDisciplines();
  return data?.find((row) => row.apiSport === apiSport)?.iconUrl ?? null;
}
