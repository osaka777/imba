import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    host: process.env.NEXT_PUBLIC_HOST,
    rules: [
      {
        allow: "/",
        disallow: "/api",
        userAgent: "*",
      },
    ],
    sitemap: `${process.env.NEXT_PUBLIC_HOST}/sitemap.xml`,
  };
}
