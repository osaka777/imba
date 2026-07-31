import { MetadataRoute } from "next";

import { CYBER_DISCIPLINES } from "~/entities/cybersport/lib/cyberDisciplineSlugs";

export const dynamic = "force-dynamic";

type FeedEvent = {
  slug?: string | null;
  commenceTime: string;
};

type CyberGameSitemap = {
  eventId: string;
  updatedAt?: string;
};

const CYBER_SITEMAP_SPORTS = ["esports.cs", "esports.dota2", "esports.valorant"] as const;

async function fetchEventsForSitemap(): Promise<FeedEvent[]> {
  const host =
    process.env.BACKEND_URL
    || process.env.NEXT_PUBLIC_HOST
    || "https://imba.bet";
  try {
    const res = await fetch(`${host}/api/feed/events`, { cache: "no-store" });
    if (!res.ok) return [];
    return (await res.json()) as FeedEvent[];
  } catch {
    return [];
  }
}

async function fetchCybersportGamesForSitemap(): Promise<CyberGameSitemap[]> {
  const host = process.env.NEXT_PUBLIC_HOST || "https://imba.bet";
  const games = new Map<string, CyberGameSitemap>();

  for (const sport of CYBER_SITEMAP_SPORTS) {
    for (const mode of ["line", "live"] as const) {
      try {
        const res = await fetch(
          `${host}/api/cybersport/${mode}?sport=${encodeURIComponent(sport)}&limit=40`,
          { cache: "no-store" },
        );
        if (!res.ok) continue;
        const rows = (await res.json()) as Array<{
          eventId?: string;
          meta?: { commenceTime?: string };
          updatedAt?: string;
        }>;
        for (const row of rows) {
          if (!row.eventId) continue;
          games.set(row.eventId, {
            eventId: row.eventId,
            updatedAt: row.meta?.commenceTime ?? row.updatedAt,
          });
        }
      } catch {
        // ignore per-sport failures
      }
    }
  }

  return [...games.values()];
}

async function fetchCybersportTournamentsForSitemap(): Promise<
  Array<{ discipline: string; slug: string }>
> {
  const host = process.env.NEXT_PUBLIC_HOST || "https://imba.bet";
  const rows: Array<{ discipline: string; slug: string }> = [];

  for (const sport of CYBER_SITEMAP_SPORTS) {
    try {
      const res = await fetch(`${host}/api/cybersport/tournaments?sport=${encodeURIComponent(sport)}`, {
        cache: "no-store",
      });
      if (!res.ok) continue;
      const tournaments = (await res.json()) as Array<{ slug: string; apiSport: string }>;
      for (const row of tournaments.slice(0, 12)) {
        const discipline =
          row.apiSport === "esports.cs"
            ? "cs2"
            : row.apiSport === "esports.dota2"
              ? "dota-2"
              : row.apiSport === "esports.valorant"
                ? "valorant"
                : null;
        if (!discipline) continue;
        rows.push({ discipline, slug: row.slug });
      }
    } catch {
      // ignore
    }
  }

  return rows;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = process.env.NEXT_PUBLIC_HOST || "https://imba.bet";
  const now = new Date();

  const base: MetadataRoute.Sitemap = [
    {
      changeFrequency: "daily",
      lastModified: now,
      priority: 1,
      url: `${host}/`,
    },
    {
      changeFrequency: "hourly",
      lastModified: now,
      priority: 0.9,
      url: `${host}/line`,
    },
    {
      changeFrequency: "hourly",
      lastModified: now,
      priority: 0.9,
      url: `${host}/live`,
    },
    {
      changeFrequency: "hourly",
      lastModified: now,
      priority: 0.85,
      url: `${host}/cybersport`,
    },
    ...Object.values(CYBER_DISCIPLINES)
      .filter((item) => ["cs2", "dota-2", "valorant", "lol", "rainbow-six"].includes(item.slug))
      .map((item) => ({
        changeFrequency: "hourly" as const,
        lastModified: now,
        priority: 0.83,
        url: `${host}/cybersport/${item.slug}`,
      })),
    {
      changeFrequency: "hourly",
      lastModified: now,
      priority: 0.82,
      url: `${host}/live?sport=esports.cs`,
    },
    {
      changeFrequency: "hourly",
      lastModified: now,
      priority: 0.8,
      url: `${host}/live?sport=esports.dota2`,
    },
    {
      changeFrequency: "hourly",
      lastModified: now,
      priority: 0.78,
      url: `${host}/live?sport=esports.valorant`,
    },
    {
      changeFrequency: "hourly",
      lastModified: now,
      priority: 0.75,
      url: `${host}/line?sport=esports.cs`,
    },
    {
      changeFrequency: "hourly",
      lastModified: now,
      priority: 0.75,
      url: `${host}/line?sport=esports.dota2`,
    },
    {
      changeFrequency: "monthly",
      lastModified: now,
      priority: 0.65,
      url: `${host}/guides`,
    },
    {
      changeFrequency: "monthly",
      lastModified: now,
      priority: 0.6,
      url: `${host}/guides/kaspi`,
    },
    {
      changeFrequency: "monthly",
      lastModified: now,
      priority: 0.6,
      url: `${host}/guides/vyvod`,
    },
    {
      changeFrequency: "monthly",
      lastModified: now,
      priority: 0.6,
      url: `${host}/guides/bonusy`,
    },
    {
      changeFrequency: "monthly",
      lastModified: now,
      priority: 0.4,
      url: `${host}/info`,
    },
    {
      changeFrequency: "monthly",
      lastModified: now,
      priority: 0.7,
      url: `${host}/app`,
    },
    {
      changeFrequency: "monthly",
      lastModified: now,
      priority: 0.7,
      url: `${host}/windows`,
    },
  ];

  const events = await fetchEventsForSitemap();
  const cyberGames = await fetchCybersportGamesForSitemap();
  const cyberTournaments = await fetchCybersportTournamentsForSitemap();
  const gamePages: MetadataRoute.Sitemap = events
    .filter((event): event is FeedEvent & { slug: string } => Boolean(event.slug?.trim()))
    .map((event) => ({
      changeFrequency: "hourly" as const,
      lastModified: new Date(event.commenceTime),
      priority: 0.75,
      url: `${host}/game/${event.slug}`,
    }));

  const cyberGamePages: MetadataRoute.Sitemap = cyberGames.map((game) => ({
    changeFrequency: "hourly" as const,
    lastModified: game.updatedAt ? new Date(game.updatedAt) : now,
    priority: 0.72,
    url: `${host}/cybersport/game/${encodeURIComponent(game.eventId)}`,
  }));

  const cyberTournamentPages: MetadataRoute.Sitemap = cyberTournaments.map((row) => ({
    changeFrequency: "hourly" as const,
    lastModified: now,
    priority: 0.7,
    url: `${host}/cybersport/${row.discipline}/tournament/${row.slug}`,
  }));

  return [...base, ...gamePages, ...cyberGamePages, ...cyberTournamentPages];
}
