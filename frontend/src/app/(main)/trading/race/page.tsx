import type { Metadata } from "next";

import { RaceHub } from "~/entities/race/ui/RaceHub";
import { makeSeoMetadata } from "~/shared/i18n/seo-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return makeSeoMetadata("trading.seoRaceTitle", {
    descriptionKey: "trading.seoRaceDesc",
    path: "/trading/race",
  });
}

export default function RaceHubPage() {
  return <RaceHub />;
}
