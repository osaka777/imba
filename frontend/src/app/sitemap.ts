import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      changeFrequency: "daily",
      lastModified: new Date(),
      priority: 1,
      url: `${process.env.NEXT_PUBLIC_HOST}/`,
    },
    {
      changeFrequency: "daily",
      lastModified: new Date(),
      priority: 1,
      url: `${process.env.NEXT_PUBLIC_HOST}/line`,
    },
    {
      changeFrequency: "daily",
      lastModified: new Date(),
      priority: 0.7,
      url: `${process.env.NEXT_PUBLIC_HOST}/profile`,
    },
    {
      changeFrequency: "daily",
      lastModified: new Date(),
      priority: 0.3,
      url: `${process.env.NEXT_PUBLIC_HOST}/betHistory`,
    },
    {
      changeFrequency: "daily",
      lastModified: new Date(),
      priority: 0.3,
      url: `${process.env.NEXT_PUBLIC_HOST}/financeHistory`,
    },
    {
      changeFrequency: "daily",
      lastModified: new Date(),
      priority: 0.5,
      url: `${process.env.NEXT_PUBLIC_HOST}/info`,
    },
  ];
}
