import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kick × imba Partners — монетизация эфира и RevShare до 50%",
  description:
    "Партнёрка для Kick-стримеров: подключение канала, RevShare до 50%, welcome $10, чат-бот, OBS-оверлей, выплаты USDT. Регистрация за 2 минуты.",
  alternates: {
    canonical: "https://kick.imba.bet/",
  },
  openGraph: {
    title: "Kick × imba Partners",
    description:
      "Монетизация Kick-эфира: RevShare, USDT, чат-бот и аналитика трафика.",
    url: "https://kick.imba.bet/",
    siteName: "kick.imba.bet",
    locale: "ru_RU",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function KickRouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
