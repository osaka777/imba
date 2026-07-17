import type { MatchResultsMode, MatchResultsResponse, ResultsSportSlug } from "./types";

export function formatAlmatyDateInput(date = new Date()): string {
  const shifted = new Date(date.getTime() + 5 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

export async function fetchMatchResults(params: {
  sport?: ResultsSportSlug;
  date?: string;
  mode?: MatchResultsMode;
}): Promise<MatchResultsResponse> {
  const search = new URLSearchParams();
  search.set("sport", params.sport ?? "soccer");
  search.set("mode", params.mode ?? "finished");
  if (params.date) search.set("date", params.date);

  const res = await fetch(`/api/games/results?${search.toString()}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Results request failed: ${res.status}`);
  }

  return res.json() as Promise<MatchResultsResponse>;
}

export function periodLabel(sport: string, index: number): string {
  if (sport === "soccer") return index === 0 ? "1Т" : `2Т`;
  if (sport === "tennis" || sport === "table-tennis" || sport === "volleyball") return `С${index + 1}`;
  if (sport === "basketball") return `${index + 1}Ч`;
  if (sport === "hockey") return `${index + 1}П`;
  if (sport.startsWith("cyber-")) return `${index + 1}`;
  return `${index + 1}`;
}
