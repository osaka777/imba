"use client";

import { useEffect, useRef, useState } from "react";

import { EnIcon, RuIcon } from "~/shared/assets/icons";
import { LOCALE_META, type AppLocale } from "~/shared/i18n/locale";
import { useLocale } from "~/shared/model/useLocale";
import { cn } from "~/shared/lib";
import { Button } from "~/shared/ui";

import styles from "./LanguageSelector.module.css";

const FLAG_BY_LOCALE: Record<AppLocale, React.ComponentType<{ className?: string }>> = {
  ru: RuIcon,
  en: EnIcon,
};

/** Простой переключатель как у старого 1win: код + флаг → короткий dropdown */
export const LanguageSelector = () => {
  const { locale, setLocale, t, locales } = useLocale();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const Flag = FLAG_BY_LOCALE[locale];

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
        type="button"
        className={styles.trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("lang.switch")}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.code}>{locale.toUpperCase()}</span>
        <Flag className={styles.flag} />
        <span className={cn(styles.chevron, open && styles.chevronOpen)} aria-hidden />
      </Button>

      {open ? (
        <ul className={styles.menu} role="listbox" aria-label={t("lang.title")}>
          {locales.map((code) => {
            const meta = LOCALE_META[code];
            const ItemFlag = FLAG_BY_LOCALE[code];
            const active = code === locale;
            return (
              <li key={code} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={cn(styles.item, active && styles.itemActive)}
                  onClick={() => {
                    setLocale(code);
                    setOpen(false);
                  }}
                >
                  <ItemFlag className={styles.itemFlag} />
                  <span className={styles.itemCode}>{code.toUpperCase()}</span>
                  <span className={styles.itemName}>
                    {meta.nativeName}
                    {meta.beta ? <span className={styles.betaBadge}> (Beta)</span> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
};
