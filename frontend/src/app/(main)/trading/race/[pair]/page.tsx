import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RACE_PAIRS, racePairFromSlug } from "~/entities/race/lib/pairs";
import { RaceGame } from "~/entities/race/ui/RaceGame";
import { makeSeoMetadata } from "~/shared/i18n/seo-metadata";

type Props = {
  params: Promise<{ pair: string }>;
  searchParams: Promise<{ round?: string }>;
};

export function generateStaticParams() {
  return RACE_PAIRS.map((p) => ({ pair: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { pair: slug } = await params;
  const pair = racePairFromSlug(slug);
  if (!pair) {
    return makeSeoMetadata("trading.seoRaceTitle", { path: "/trading/race" });
  }
  return makeSeoMetadata("trading.seoRacePairTitle", {
    path: `/trading/race/${pair.slug}`,
    params: { name: pair.name },
  });
}

export default async function RacePairPage({ params, searchParams }: Props) {
  const { pair: slug } = await params;
  const sp = await searchParams;
  const pair = racePairFromSlug(slug);
  if (!pair) notFound();
  const roundRaw = Number(sp.round);
  const initialRoundMs = roundRaw === 900_000 ? 900_000 : 300_000;
  return <RaceGame initialPairKey={pair.key} initialRoundMs={initialRoundMs} />;
}
