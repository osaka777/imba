import type { Metadata } from "next";

import { makeSeoMetadata } from "~/shared/i18n/seo-metadata";

import { PolymarketPreview } from "./PolymarketPreview";

export async function generateMetadata(): Promise<Metadata> {
  return makeSeoMetadata("common.seoPolymarket", {
    descriptionKey: "common.seoPolymarketDesc",
    path: "/polymarket",
    noIndex: true,
  });
}

export default function PolymarketPage() {
  return <PolymarketPreview />;
}
