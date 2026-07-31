"use client";

type Props = {
  value: number | null | undefined;
  className?: string;
  /** Fraction digits (default 2; use 3 for tiny moves). */
  digits?: number;
  /** Show ▲ / ▼ before the value. */
  showArrow?: boolean;
  arrowClassName?: string;
};

function formatPct(value: number, digits: number): string {
  const abs = Math.abs(value);
  const floor = 10 ** -digits;
  const n = abs < floor ? floor : abs;
  const sign = value >= 0 ? "+" : "−";
  return `${sign}${n.toFixed(digits)}%`;
}

/** Percent — solid digits like profile PnL (no flip slots). */
export function AnimatedPct({
  value,
  className,
  digits,
  showArrow = false,
  arrowClassName,
}: Props) {
  const resolvedDigits =
    digits ??
    (value != null && Number.isFinite(value) && Math.abs(value) < 0.1
      ? 3
      : 2);

  if (value == null || !Number.isFinite(value)) {
    return <span className={className}>—</span>;
  }

  const isUp = value >= 0;
  const text = formatPct(value, resolvedDigits);

  return (
    <span className={className} data-dir={isUp ? "up" : "down"}>
      {showArrow ? (
        <span className={arrowClassName} aria-hidden>
          {isUp ? "▲" : "▼"}
        </span>
      ) : null}
      {text}
    </span>
  );
}
