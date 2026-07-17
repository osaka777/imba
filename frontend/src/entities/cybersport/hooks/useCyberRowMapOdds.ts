"use client";

import { useQuery } from "@tanstack/react-query";

import { extractCyberRowQuickOdds } from "~/entities/cybersport/lib/extractCyberRowQuickOdds";
import { fetchWcEventDetail } from "~/entities/wc-odds/api/client";

/** Fetch WC detail for cyber list rows when headline 1X2 is missing (cyber-only). */
export function useCyberRowMapOdds(wcEventRef: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["cyber-row-quick-odds", wcEventRef],
    queryFn: async () => {
      const detail = await fetchWcEventDetail(wcEventRef!);
      if (!detail) return null;
      return {
        detail,
        quick: extractCyberRowQuickOdds(detail),
      };
    },
    enabled: enabled && Boolean(wcEventRef),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}
