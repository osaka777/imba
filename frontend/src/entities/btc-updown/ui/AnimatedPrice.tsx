"use client";

import { formatAssetPrice } from "../lib/markets";

type Props = {
  value: number | null | undefined;
  className?: string;
  prefix?: string;
};

/** Live/target price — solid digits like profile PnL (no flip slots). */
export function AnimatedPrice({ value, className, prefix = "$" }: Props) {
  const text =
    value == null || !Number.isFinite(value)
      ? "—"
      : `${prefix}${formatAssetPrice(value)}`;

  return <span className={className}>{text}</span>;
}
