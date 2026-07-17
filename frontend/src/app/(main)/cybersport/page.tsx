import { Metadata } from "next";

import { CybersportSection } from "~/entities/cybersport/ui/CybersportSection";
import { makeMetadata } from "~/shared/lib";

export const metadata: Metadata = makeMetadata("Киберспорт", {
  description:
    "Ставки на киберспорт в Imba.bet: CS2, Dota 2 и другие дисциплины — линия и live.",
  path: "/cybersport",
});

export default function CybersportPage() {
  return <CybersportSection />;
}
