"use client";

import NumberFlow, { continuous } from "@number-flow/react";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import styles from "./FlipDigits.module.css";

type Props = {
  value: string;
  className?: string;
  /** Countdown digits usually roll downward. */
  preferDir?: "up" | "down";
};

function buildRoll(from: number, to: number, preferDir: "up" | "down") {
  if (from === to) return [String(to)];
  const upDist = (to - from + 10) % 10 || 10;
  const downDist = (from - to + 10) % 10 || 10;
  // Prefer the asked direction unless the other path is clearly shorter.
  const goUp =
    preferDir === "up" ? upDist <= downDist + 1 : upDist < downDist;

  const digits: string[] = [String(from)];
  if (goUp) {
    let d = from;
    do {
      d = (d + 1) % 10;
      digits.push(String(d));
    } while (d !== to);
  } else {
    let d = from;
    do {
      d = (d + 9) % 10;
      digits.push(String(d));
    } while (d !== to);
  }
  // Cap long spins so scrub stays snappy (Polymarket-feel).
  if (digits.length > 6) {
    return [String(from), String(to)];
  }
  return digits;
}

function FlipDigit({
  ch,
  preferDir,
}: {
  ch: string;
  preferDir: "up" | "down";
}) {
  const prevRef = useRef(ch);
  const [anim, setAnim] = useState<{
    digits: string[];
    key: number;
    ms: number;
  } | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    if (ch === prev) return;

    const canFlip = /\d/.test(ch) && /\d/.test(prev);
    prevRef.current = ch;
    if (!canFlip) {
      setAnim(null);
      return;
    }

    const digits = buildRoll(Number(prev), Number(ch), preferDir);
    if (digits.length < 2) {
      setAnim(null);
      return;
    }

    const ms = Math.min(280, 70 + digits.length * 38);
    const key = Date.now() + Math.random();
    setAnim({ digits, key, ms });
    const t = window.setTimeout(() => setAnim(null), ms);
    return () => window.clearTimeout(t);
  }, [ch, preferDir]);

  if (!/\d/.test(ch)) {
    return <span className={styles.sep}>{ch}</span>;
  }

  if (anim) {
    const n = anim.digits.length;
    return (
      <span className={styles.slot}>
        <span
          key={anim.key}
          className={styles.reelMulti}
          style={
            {
              "--n": n,
              "--ms": `${anim.ms}ms`,
              height: `${n}em`,
            } as CSSProperties
          }
        >
          {anim.digits.map((d, i) => (
            <span key={`${anim.key}-${i}`}>{d}</span>
          ))}
        </span>
      </span>
    );
  }

  return (
    <span className={styles.slot}>
      <span className={styles.digit}>{ch}</span>
    </span>
  );
}

/**
 * Odometer-style flip: each character is its own cell with a stable
 * right-aligned key so "9"→"10" does not remount every digit.
 */
export function FlipDigits({
  value,
  className,
  preferDir = "down",
}: Props) {
  const chars = value.split("");
  return (
    <span
      className={[styles.root, className].filter(Boolean).join(" ")}
      aria-label={value}
    >
      {chars.map((ch, i) => (
        <FlipDigit
          key={`c${chars.length - i}`}
          ch={ch}
          preferDir={preferDir}
        />
      ))}
    </span>
  );
}

export function currencySymbol(code: string) {
  switch (code.toUpperCase()) {
    case "USD":
    case "USDT":
      return "$";
    case "RUB":
      return "₽";
    case "KZT":
      return "₸";
    case "UAH":
      return "₴";
    case "EUR":
      return "€";
    default:
      return code;
  }
}

function isPrefixCurrency(code: string) {
  const c = code.toUpperCase();
  return c === "USD" || c === "USDT" || c === "EUR";
}

/** Format stake/payout with currency symbol ($5 / 1 000 ₸). */
export function formatMoneyAmount(
  n: number,
  currency: string,
  fractionDigits?: number,
) {
  const c = currency.toUpperCase();
  const sym = currencySymbol(c);
  const digits =
    fractionDigits ?? (isPrefixCurrency(c) && !Number.isInteger(n) ? 2 : 0);
  const body = n.toLocaleString(isPrefixCurrency(c) ? "en-US" : "ru-RU", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  if (isPrefixCurrency(c)) return `${sym}${body}`;
  return `${body}\u00A0${sym}`;
}

export function presetsForCurrency(currency: string): number[] {
  const c = currency.toUpperCase();
  if (c === "USD" || c === "USDT") return [1, 5, 25, 100];
  if (c === "RUB") return [500, 2000, 10_000];
  return [1000, 5000, 10_000];
}

export function stakeStepForCurrency(currency: string): number {
  const c = currency.toUpperCase();
  if (c === "USD" || c === "USDT") return 1;
  if (c === "RUB") return 100;
  return 100;
}

/** Smaller step while holding +/- (continuous nudge). */
export function holdStakeStepForCurrency(currency: string): number {
  const c = currency.toUpperCase();
  if (c === "USD" || c === "USDT") return 1;
  if (c === "RUB") return 50;
  return 50;
}

/** Per-currency stake caps (must match backend maxStakeForCurrency). */
export function maxStakeForCurrency(currency: string): number {
  const c = currency.toUpperCase();
  if (c === "USD" || c === "USDT") return 10_000;
  if (c === "RUB") return 150_000;
  return 1_000_000;
}

/**
 * Polymarket-style money: uses the same @number-flow/react odometer
 * (number-flow-react) they ship on trader profiles when scrubbing the chart.
 */
const SCRUB_PLUGINS = [continuous];

export function ScrubMoney({
  value,
  currency,
  fractionDigits,
  className,
  active = false,
}: {
  value: number;
  currency: string;
  fractionDigits?: number;
  className?: string;
  active?: boolean;
}) {
  const c = currency.toUpperCase();
  const digits =
    fractionDigits ??
    (isPrefixCurrency(c) ? (Number.isInteger(value) ? 0 : 2) : 0);
  const sym = currencySymbol(c);
  const prefix = isPrefixCurrency(c) ? sym : undefined;
  const suffix = isPrefixCurrency(c) ? undefined : `\u00A0${sym}`;

  return (
    <NumberFlow
      className={className}
      value={Math.abs(value)}
      locales={isPrefixCurrency(c) ? "en-US" : "ru-RU"}
      format={{
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
        useGrouping: true,
      }}
      prefix={prefix}
      suffix={suffix}
      plugins={active ? SCRUB_PLUGINS : undefined}
      willChange={active}
      spinTiming={{
        duration: active ? 280 : 450,
        easing: "cubic-bezier(0.16, 0.84, 0.22, 1)",
      }}
      transformTiming={{
        duration: active ? 280 : 450,
        easing: "cubic-bezier(0.16, 0.84, 0.22, 1)",
      }}
      opacityTiming={{ duration: 200, easing: "ease-out" }}
    />
  );
}

/** Flip ticker for money strings with symbol. */
export function FlipMoney({
  value,
  currency,
  fractionDigits,
  className,
}: {
  value: number;
  currency: string;
  fractionDigits?: number;
  className?: string;
}) {
  const prev = useRef(value);
  const dir: "up" | "down" =
    value > prev.current ? "up" : value < prev.current ? "down" : "up";

  useEffect(() => {
    prev.current = value;
  }, [value]);

  const c = currency.toUpperCase();
  const digits =
    fractionDigits ??
    (isPrefixCurrency(c) ? (Number.isInteger(value) ? 0 : 2) : 0);

  return (
    <FlipDigits
      value={formatMoneyAmount(value, currency, digits)}
      preferDir={dir}
      className={className}
    />
  );
}
