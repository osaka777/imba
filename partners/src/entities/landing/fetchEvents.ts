import { getBrowserApiBaseUrl } from "@/shared/lib/apiBaseUrl";
import type { WcEventPickerItem } from "./types";

function normalizeList(data: unknown): WcEventPickerItem[] {
  const list = Array.isArray(data) ? data : [];
  return list.filter(
    (e): e is WcEventPickerItem =>
      Boolean(e && typeof e === "object" && "id" in e && (e as WcEventPickerItem).phase !== "finished"),
  );
}

function filterByQuery(events: WcEventPickerItem[], q: string) {
  const term = q.trim().toLowerCase();
  if (term.length < 2) return events;
  return events.filter(
    (e) =>
      e.homeTeam.toLowerCase().includes(term) ||
      e.awayTeam.toLowerCase().includes(term) ||
      e.leagueName.toLowerCase().includes(term),
  );
}

export async function fetchEventsForPicker(params: {
  mode: "line" | "live";
  sport: string;
  q?: string;
}): Promise<WcEventPickerItem[]> {
  const base = getBrowserApiBaseUrl();
  const q = params.q?.trim() ?? "";

  if (q.length >= 2) {
    const searchParams = new URLSearchParams({ q });
    if (params.sport) searchParams.set("sport", params.sport);
    const searchRes = await fetch(`${base}/feed/search?${searchParams}`, {
      cache: "no-store",
    });
    if (searchRes.ok) {
      const found = normalizeList(await searchRes.json());
      if (found.length > 0) return found;
    }
  }

  const path = params.mode === "live" ? "feed/live/events" : "feed/line/events";
  const listParams = new URLSearchParams({
    sport: params.sport,
    limit: "30",
  });
  if (params.mode === "line") listParams.set("hours", "72");

  const res = await fetch(`${base}/${path}?${listParams}`, { cache: "no-store" });
  if (!res.ok) return [];
  const events = normalizeList(await res.json());
  return q.length >= 2 ? filterByQuery(events, q) : events;
}
