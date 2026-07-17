import { MetadataRoute } from "next";

const PRIVATE_PATHS = [
  "/api",
  "/profile",
  "/deposit",
  "/reset-password",
];

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
    ],
    sitemap: `${host}/sitemap.xml`,
  };
}
