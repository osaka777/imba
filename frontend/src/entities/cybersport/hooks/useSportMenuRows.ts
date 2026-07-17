"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchCybersportCounts } from "~/entities/cybersport/api/client";
import {
  esportsMenuItems,
  mergeSportCounts,
} from "~/entities/cybersport/lib/visibleEsportsMenuItems";
import { visibleGamesList } from "~/entities/game";
import type { GameCounts } from "~/entities/game/api/getGameCounts";

export type SportMenuRow = {
  Icon: React.FC<{ className?: string }>;
  label: string;
  name: string;
  count: number;
  isPriority: boolean;
  /** True for Olimpbet esports.* disciplines — render separately from soccer/tennis. */
  isEsports?: boolean;
};

export function useSportMenuRows(
  type: "live" | "line",
  options: {
    gameCounts: GameCounts;
    wcCounts: Record<string, number>;
    prioritySports: Set<string>;
    broadcastOnly?: boolean;
  },
) {
  const { data: cyberCounts = {} } = useQuery({
    queryKey: ["cybersportCounts", type],
    queryFn: fetchCybersportCounts,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 10_000,
    gcTime: 1000 * 60 * 5,
  });

  const esportsCounts = useMemo(
    () => mergeSportCounts(options.wcCounts, cyberCounts),
    [options.wcCounts, cyberCounts],
  );

  const coreRows = useMemo(() => {
    return visibleGamesList()
      .map(({ Icon, label, name }) => ({
        Icon,
        label,
        name,
        count: options.broadcastOnly
          ? options.wcCounts[name] || 0
          : (options.wcCounts[name] || 0) + (options.gameCounts[name] || 0),
        isPriority: options.prioritySports.has(name),
        isEsports: false as const,
      }))
      .sort((a, b) => b.count - a.count);
  }, [
    options.broadcastOnly,
    options.gameCounts,
    options.prioritySports,
    options.wcCounts,
  ]);

  const esportsRows = useMemo(() => {
    return esportsMenuItems(esportsCounts).map((item) => ({
      ...item,
      count: esportsCounts[item.name] || 0,
      isPriority: options.prioritySports.has(item.name),
      isEsports: true as const,
    }));
  }, [esportsCounts, options.prioritySports]);

  const totalCount = useMemo(
    () =>
      coreRows.reduce((sum, row) => sum + row.count, 0)
      + esportsRows.reduce((sum, row) => sum + row.count, 0),
    [coreRows, esportsRows],
  );

  return {
    coreRows,
    esportsRows,
    rows: [...coreRows, ...esportsRows],
    totalCount,
    cyberCounts,
    esportsCounts,
  };
}
