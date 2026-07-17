import { cache } from "react";

import type { Metadata } from "next";

import { ClickLandingClient, type ClickLandingData } from "./ClickLandingClient";

type Props = {
  params: Promise<{ slug: string }>;
};

const fetchClickData = cache(async (slug: string): Promise<ClickLandingData> => {
  const backend = process.env.BACKEND_URL?.replace(/\/$/, "") || "http://backend:3000";
  try {
    const res = await fetch(`${backend}/api/kick/click/${encodeURIComponent(slug)}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      return { found: false, channelSlug: slug };
    }
    return (await res.json()) as ClickLandingData;
  } catch {
    return { found: false, channelSlug: slug };
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await fetchClickData(slug);

  if (!data.found) {
    return {
      title: "Переход на imba.bet",
      description: "Ставки на киберспорт по ссылке стримера",
      robots: "noindex",
    };
  }

  const name = data.channelDisplayName?.trim() || data.channelSlug.replace(/^@/, "");
  const title = data.isLive
    ? `@${name} в эфире — ставки на imba.bet`
    : `@${name} приглашает на imba.bet`;
  const description =
    (data.isLive && data.streamTitle) ||
    "Ставки на киберспорт с бонусом по ссылке стримера";
  const image =
    (data.isLive ? data.streamThumbnail : null) ||
    data.channelAvatarUrl ||
    data.channelBannerUrl ||
    undefined;

  return {
    title,
    description,
    robots: "noindex",
    openGraph: {
      title,
      description,
      siteName: "imba.bet",
      type: "website",
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function ClickLandingPage({ params }: Props) {
  const { slug } = await params;
  const data = await fetchClickData(slug);
  return <ClickLandingClient data={data} />;
}
