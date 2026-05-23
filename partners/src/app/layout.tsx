import "@styles/index.css";
import "tailwindcss/tailwind.css"
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Imba • Ставки на спорт онлайн • Букмекерская контора • Imba.bet",
  description: "OneX site Главная страница",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
