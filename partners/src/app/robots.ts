import type { MetadataRoute } from "next";

import { KICK_GUIDE_BASE_URL } from "@/widgets/KickGuide/kick-guide-data";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/guide", "/kick"],
      disallow: ["/profile", "/api", "/click", "/widget", "/go"],
    },
    sitemap: `${KICK_GUIDE_BASE_URL}/sitemap.xml`,
    host: KICK_GUIDE_BASE_URL,
  };
}
