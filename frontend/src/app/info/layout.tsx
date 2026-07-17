import { makeMetadata } from "~/shared/lib";

export const metadata = makeMetadata("Правила и информация", {
  description:
    "Условия использования Imba.bet, правила приёма ставок, политика конфиденциальности и контакты службы поддержки.",
  path: "/info",
});

export default function InfoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
