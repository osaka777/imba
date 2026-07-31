"use client";

import { useEffect, useRef, useState } from "react";

import {
  getCurrencyIconUrl,
  REGISTRATION_CURRENCY_SHORT_LABELS,
} from "~/entities/user/lib/registrationCountries";
import { SITE_CURRENCY_CODES } from "~/shared/lib/siteCurrencies";
import { cn } from "~/shared/lib";
import { Button } from "~/shared/ui";

import styles from "./CurrencySelector.module.css";

function CurrencyIcon({ code, className }: { code: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt=""
      className={className}
      decoding="async"
      height={16}
      loading="lazy"
      src={getCurrencyIconUrl(code)}
      width={16}
    />
  );
}

/** Same popover pattern as LanguageSelector: icon + code + name. */
export const CurrencySelector = ({
  currency,
  setCurrency,
}: {
  currency: string;
  setCurrency: (currency: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const active = currency.toUpperCase();

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className={styles.root} ref={rootRef}>
      <Button
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Currency"
        className={styles.trigger}
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <span className={styles.code}>{active}</span>
        <span className={cn(styles.chevron, open && styles.chevronOpen)} aria-hidden />
        <CurrencyIcon className={styles.flag} code={active} />
      </Button>

      {open ? (
        <ul aria-label="Currency" className={styles.menu} role="listbox">
          {SITE_CURRENCY_CODES.map((code) => {
            const selected = code === active;
            const name = REGISTRATION_CURRENCY_SHORT_LABELS[code] ?? code;
            return (
              <li aria-selected={selected} key={code} role="option">
                <button
                  className={cn(styles.item, selected && styles.itemActive)}
                  onClick={() => {
                    setCurrency(code);
                    setOpen(false);
                  }}
                  type="button"
                >
                  <CurrencyIcon className={styles.itemFlag} code={code} />
                  <span className={styles.itemCode}>{code}</span>
                  <span className={styles.itemName}>{name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
};
