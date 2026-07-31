import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BtcUpdownGame } from "~/entities/btc-updown/ui/BtcUpdownGame";
import {
  marketFromSlug,
  roundsForSymbol,
  TRADING_MARKETS,
} from "~/entities/btc-updown/lib/markets";

type Props = {
  params: Promise<{ asset: string }>;
  searchParams: Promise<{ round?: string; side?: string }>;
};

export function generateStaticParams() {
  return TRADING_MARKETS.map((m) => ({ asset: m.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { asset } = await params;
  const market = marketFromSlug(asset);
  if (!market) return { title: "Trading · Imba" };
  return {
    title: `${market.short} UP/DOWN · Imba`,
    description:
      market.roundsKey === "trading.roundsShort"
        ? `${market.name}: up or down on 1m / 5m / 15m.`
        : `${market.name}: up or down on 5m / 15m.`,
  };
}

export default async function TradingAssetPage({ params, searchParams }: Props) {
  const { asset } = await params;
  const sp = await searchParams;
  const market = marketFromSlug(asset);
  if (!market) notFound();
  const roundRaw = Number(sp.round);
  const allowed = roundsForSymbol(market.symbol);
  const initialRoundMs =
    Number.isFinite(roundRaw) &&
    (allowed as readonly number[]).includes(roundRaw)
      ? roundRaw
      : undefined;
  const sideRaw = (sp.side ?? "").toUpperCase();
  const initialSide =
    sideRaw === "UP" || sideRaw === "DOWN" ? sideRaw : undefined;
  return (
    <BtcUpdownGame
      initialSymbol={market.symbol}
      initialRoundMs={initialRoundMs}
      initialSide={initialSide}
    />
  );
}
