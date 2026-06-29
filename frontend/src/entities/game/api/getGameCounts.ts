import { api } from "~/shared/api";
import { fetchWcLineCounts } from "~/entities/wc-odds/api/client";

export interface GameCounts {
  total: number;
  [key: string]: number;
}

function mergeOlimpbetCounts(counts: GameCounts, olimpbet: Record<string, number>): GameCounts {
  const merged = { ...counts };
  for (const [sport, count] of Object.entries(olimpbet)) {
    merged[sport] = (merged[sport] ?? 0) + count;
    merged.total = (merged.total ?? 0) + count;
  }
  return merged;
}

export const getLiveGameCounts = async (): Promise<GameCounts> => {
  const { data, error } = await api.GET("/api/games/counts/live");
  if (error) throw error;
  return data || { total: 0 };
};

export const getPrematchGameCounts = async (): Promise<GameCounts> => {
  const [{ data, error }, olimpbetCounts] = await Promise.all([
    api.GET("/api/games/counts/prematch"),
    fetchWcLineCounts().catch(() => ({} as Record<string, number>)),
  ]);
  if (error) throw error;
  const base = data || { total: 0 };
  return mergeOlimpbetCounts(base, olimpbetCounts);
}; 