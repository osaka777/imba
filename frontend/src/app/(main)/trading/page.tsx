import type { Metadata } from "next";

import { TradingHub } from "~/entities/btc-updown/ui/TradingHub";

export const metadata: Metadata = {
  title: "Trading · Imba",
  description:
    "Choose an UP/DOWN market: BTC, ETH, SOL, DOGE, PEPE, WLD, or TIA. BTC/DOGE — 1m/5m/15m; others — 5m/15m.",
};

export default function TradingPage() {
  return <TradingHub />;
}
