import type { MetadataRoute } from "next";

import { KICK_GUIDE_BASE_URL } from "@/widgets/KickGuide/kick-guide-data";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: `${KICK_GUIDE_BASE_URL}/`,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${KICK_GUIDE_BASE_URL}/guide`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
  ];
}
