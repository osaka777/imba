import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Bitcoin Up or Down · Imba",
  description: "5-минутные ставки BTC вверх/вниз с баланса Imba",
};

export default function BtcUpdownPage() {
  notFound();
}
