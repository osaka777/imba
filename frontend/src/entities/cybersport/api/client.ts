import type { components } from "~/shared/api";

export type CyberGame = components["schemas"]["GameDtoWithGroupedMarkets"];

function apiOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_HOST || "http://localhost:3000";
}

export async function fetchCybersportStatus(): Promise<{ enabled: boolean }> {
  const res = await fetch(`${apiOrigin()}/api/cybersport/status`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return { enabled: false };
  return (await res.json()) as { enabled: boolean };
}

export async function fetchCybersportLive(
  sport: string,
  limit = 24,
): Promise<CyberGame[]> {
  const url = new URL("/api/cybersport/live", apiOrigin());
  url.searchParams.set("sport", sport);
  url.searchParams.set("limit", String(limit));

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Cybersport live fetch failed");
  return (await res.json()) as CyberGame[];
}

export async function fetchCybersportLine(
  sport: string,
  limit = 24,
  offset = 0,
): Promise<CyberGame[]> {
  const url = new URL("/api/cybersport/line", apiOrigin());
  url.searchParams.set("sport", sport);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Cybersport line fetch failed");
  return (await res.json()) as CyberGame[];
}

export async function fetchCybersportGame(eventId: string): Promise<CyberGame | null> {
  const res = await fetch(`${apiOrigin()}/api/cybersport/game/${encodeURIComponent(eventId)}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Cybersport game fetch failed");
  return (await res.json()) as CyberGame;
}
