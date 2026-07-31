import { MetadataRoute } from "next";

import { AI_CRAWLER_USER_AGENTS } from "~/shared/lib/aiBotDetection";

const PRIVATE_PATHS = [
  "/api",
  "/profile",
  "/deposit",
  "/reset-password",
];

/**
 * AI / training crawlers — disallow indexing and scraping for model use.
 * Interactive agents (Cursor, Claude, ChatGPT, ...) that don't self-identify
 * via a dedicated crawler UA are additionally refused at the edge — see
 * `middleware.ts` and the legal notice at /legal/ai-usage-policy.
 */
const AI_USER_AGENTS = AI_CRAWLER_USER_AGENTS;

export default function robots(): MetadataRoute.Robots {
  const host = process.env.NEXT_PUBLIC_HOST || "https://imba.bet";

  return {
    host,
    rules: [
      {
        allow: "/",
        disallow: PRIVATE_PATHS,
        userAgent: "*",
      },
      ...AI_USER_AGENTS.map((userAgent) => ({
        userAgent,
        disallow: ["/"] as string[],
      })),
    ],
    sitemap: `${host}/sitemap.xml`,
  };
}
