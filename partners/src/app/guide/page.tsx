import type { Metadata } from "next";

import { KickGuidePage } from "@/widgets/KickGuide/KickGuidePage";
import { buildKickGuideJsonLd } from "@/widgets/KickGuide/kick-guide-schema";
import { KICK_GUIDE_BASE_URL } from "@/widgets/KickGuide/kick-guide-data";

export const metadata: Metadata = {
  title: "Как монетизировать Kick-стрим через imba.bet — гид для стримеров",
  description:
    "Пошаговый гид: подключение Kick, партнёрские ссылки imbalance.click, чат-бот, OBS-оверлей, RevShare до 50% и выплаты USDT. Для стримеров KZ и RU. Welcome $10.",
  alternates: {
    canonical: `${KICK_GUIDE_BASE_URL}/guide`,
  },
  openGraph: {
    title: "Гид по монетизации Kick × imba.bet",
    description:
      "Подключение Kick, RevShare, USDT, чат-бот и OBS — практическая инструкция для стримеров.",
    url: `${KICK_GUIDE_BASE_URL}/guide`,
    siteName: "kick.imba.bet",
    locale: "ru_RU",
    type: "article",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function GuidePage() {
  const jsonLd = buildKickGuideJsonLd();

  return (
    <>
      {jsonLd.map((block) => (
        <script
          key={block["@type"]}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }}
        />
      ))}
      <KickGuidePage />
    </>
  );
}
