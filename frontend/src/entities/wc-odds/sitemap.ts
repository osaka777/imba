import { MetadataRoute } from "next";

import type { WcEvent } from "~/entities/wc-odds/api/client";

export const dynamic = "force-dynamic";

async function fetchWcEventsForSitemap() {
  const host = process.env.NEXT_PUBLIC_HOST || "https://imba.bet";
  try {
    const res = await fetch(`${host}/api/wc-odds/events`, { cache: "no-store" });
    if (!res.ok) return [];
    return (await res.json()) as Array<{
      id: string;
      slug: string;
      homeTeam: string;
      awayTeam: string;
      commenceTime: string;
    }>;
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = process.env.NEXT_PUBLIC_HOST || "https://imba.bet";
  const base: MetadataRoute.Sitemap = [
    {
      changeFrequency: "daily",
      lastModified: new Date(),
      priority: 1,
      url: `${host}/`,
    },
    {
      changeFrequency: "hourly",
      lastModified: new Date(),
      priority: 0.9,
      url: `${host}/wc`,
    },
    {
      changeFrequency: "daily",
      lastModified: new Date(),
      priority: 1,
      url: `${host}/line`,
    },
    {
      changeFrequency: "daily",
      lastModified: new Date(),
      priority: 0.7,
      url: `${host}/profile`,
    },
    {
      changeFrequency: "daily",
      lastModified: new Date(),
      priority: 0.3,
      url: `${host}/betHistory`,
    },
    {
      changeFrequency: "daily",
      lastModified: new Date(),
      priority: 0.3,
      url: `${host}/financeHistory`,
    },
    {
      changeFrequency: "daily",
      lastModified: new Date(),
      priority: 0.5,
      url: `${host}/info`,
    },
  ];

  const events = await fetchWcEventsForSitemap();
  const wcGames: MetadataRoute.Sitemap = events
    .filter((event): event is WcEvent & { slug: string } => Boolean(event.slug))
    .map((event) => ({
      url: `${host}/game/${event.slug}`,
      lastModified: new Date(event.commenceTime),
      changeFrequency: "hourly" as const,
      priority: 0.85,
    }));

  return [...base, ...wcGames];
}
