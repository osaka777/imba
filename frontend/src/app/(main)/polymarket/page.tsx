import { makeMetadata } from "~/shared/lib";

import { PolymarketPreview } from "./PolymarketPreview";

export const metadata = makeMetadata("Polymarket preview", {
  description:
    "Превью рынков Polymarket на Imba.bet: вероятности и объёмы с публичного API.",
  path: "/polymarket",
  noIndex: true,
});

export default function PolymarketPage() {
  return <PolymarketPreview />;
}
