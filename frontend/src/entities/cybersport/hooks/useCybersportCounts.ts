"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchCybersportCounts } from "~/entities/cybersport/api/client";

export function useCybersportCounts() {
  return useQuery({
    queryKey: ["cybersportCounts"],
    queryFn: fetchCybersportCounts,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 10_000,
    gcTime: 1000 * 60 * 5,
  });
}
