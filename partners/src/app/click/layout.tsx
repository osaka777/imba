import type { Metadata } from "next";

import "./click-landing.global.css";

export const metadata: Metadata = {
  title: "Переход на imba.bet",
  description: "Ставки на киберспорт по ссылке стримера",
  robots: "noindex",
};

export default function ClickLayout({ children }: { children: React.ReactNode }) {
  return children;
}
