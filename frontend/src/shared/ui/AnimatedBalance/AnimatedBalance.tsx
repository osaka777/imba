"use client";

import { useMemo } from "react";
import { cn } from "~/shared/lib";

import { useAnimatedNumber } from "~/shared/lib/useAnimatedNumber";

import styles from "./AnimatedBalance.module.css";

type AnimatedBalanceProps = {
  value: number;
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  className?: string;
};

export function AnimatedBalance({
  value,
  locale = "ru-RU",
  minimumFractionDigits = 2,
  maximumFractionDigits = 2,
  className,
}: AnimatedBalanceProps) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const { value: animated } = useAnimatedNumber(safeValue);

  const formatted = useMemo(
    () =>
      Intl.NumberFormat(locale, {
        minimumFractionDigits,
        maximumFractionDigits,
      }).format(animated),
    [animated, locale, minimumFractionDigits, maximumFractionDigits],
  );

  return (
    <span className={cn(styles.root, className)} suppressHydrationWarning>
      {formatted}
    </span>
  );
}
