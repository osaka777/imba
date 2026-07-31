"use client";

import { useEffect, useMemo, useRef } from "react";
import { useLocalStorage } from "usehooks-ts";
import { useQuery } from "@tanstack/react-query";

import { getUser } from "~/entities/user/api";
import {
  getCurrencyIconUrl,
  getRegistrationCurrencyListName,
} from "~/entities/user/lib/registrationCountries";
import { SITE_CURRENCY_CODES } from "~/shared/lib/siteCurrencies";
import type { MessageKey } from "~/shared/i18n/messages";
import { useLocale } from "~/shared/model/useLocale";
import { cn } from "~/shared/lib";
import { Dialog, DialogContent } from "~/shared/ui/Dialog";
import { HiddenBalance } from "~/shared/ui/HiddenBalance/HiddenBalance";

import styles from "./BalanceModal.module.css";

const CURRENCY_SYMBOLS: Record<string, string> = {
  KZT: "₸",
  UAH: "₴",
  RUB: "₽",
  TRY: "₺",
  UZS: "so'm",
  AZN: "₼",
  KGS: "с",
  TJS: "ЅМ",
  USDT: "USDT",
};

const CURRENCY_FULL_KEYS: Record<string, MessageKey> = {
  KZT: "common.currencyFullKZT",
  RUB: "common.currencyFullRUB",
  USDT: "common.currencyFullUSDT",
  UAH: "common.currencyFullUAH",
  TRY: "common.currencyFullTRY",
  UZS: "common.currencyFullUZS",
  AZN: "common.currencyFullAZN",
  KGS: "common.currencyFullKGS",
  TJS: "common.currencyFullTJS",
};

function symbolFor(code: string) {
  return CURRENCY_SYMBOLS[code] || code;
}

type BalanceModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currency: string;
  setCurrency: (code: string) => void;
  onDeposit: (currencyCode?: string) => void;
};

export function BalanceModal({
  open,
  onOpenChange,
  currency,
  setCurrency,
  onDeposit,
}: BalanceModalProps) {
  const { t, format } = useLocale();
  const [hideBalance] = useLocalStorage<boolean>("hideBalance", false, {
    initializeWithValue: false,
  });
  const active = currency.toUpperCase();

  const formatMoney = (amount: string | number) => {
    const value = Number(amount);
    if (!Number.isFinite(value)) return format.number(0, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return format.number(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const { data: user } = useQuery({
    queryKey: ["user", active],
    queryFn: getUser,
    enabled: open,
    staleTime: 30_000,
  });

  const balances = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of user?.balances ?? []) {
      map.set(String(row.currencyCode).toUpperCase(), String(row.amount ?? "0"));
    }
    return map;
  }, [user?.balances]);

  const mainAmount = balances.get(active) ?? "0";
  const fullNameKey = CURRENCY_FULL_KEYS[active];
  const fullName = fullNameKey ? t(fullNameKey) : active;

  const otherAccounts = useMemo(
    () => SITE_CURRENCY_CODES.filter((code) => code !== active),
    [active],
  );

  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Radix RemoveScroll can swallow wheel on nested ports; keep the dialog as
  // the only scrollport and force wheel deltas onto it when needed.
  useEffect(() => {
    if (!open) return;
    const node = dialogRef.current;
    if (!node) return;

    const onWheel = (event: WheelEvent) => {
      if (node.scrollHeight <= node.clientHeight + 1) return;
      const atTop = node.scrollTop <= 0 && event.deltaY < 0;
      const atBottom =
        node.scrollTop + node.clientHeight >= node.scrollHeight - 1
        && event.deltaY > 0;
      if (atTop || atBottom) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      node.scrollTop += event.deltaY;
      event.preventDefault();
      event.stopPropagation();
    };

    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={styles.dialog}
        ref={dialogRef}
        title={t("profile.balance")}
      >
        <div className={styles.root}>
          <header className={styles.header}>
            <h2 className={styles.title}>{t("profile.balance")}</h2>
          </header>

          <p className={styles.subtitle}>
            <span className={styles.subtitleText}>{t("profile.mainAccountFull")}</span>
            <span className={styles.dot} aria-hidden>
              ·
            </span>
            <span className={styles.subtitleText}>{fullName}</span>
          </p>

          <div className={styles.mainAmount} suppressHydrationWarning>
            {hideBalance ? (
              <HiddenBalance length={5} />
            ) : (
              <>
                {formatMoney(mainAmount)}
                <span className={styles.mainSymbol}>{symbolFor(active)}</span>
              </>
            )}
          </div>

          <button
            className={styles.depositBtn}
            onClick={() => {
              onOpenChange(false);
              onDeposit(active);
            }}
            type="button"
          >
            <span className={styles.depositPlus} aria-hidden>
              +
            </span>
            {t("deposit.depositCta")}
          </button>

          <div className={styles.sectionHead}>
            <h3 className={styles.sectionTitle}>{t("profile.otherAccounts")}</h3>
          </div>

          <ul className={styles.accountList}>
            {otherAccounts.map((code) => {
              const amount = balances.get(code) ?? "0";
              const name = getRegistrationCurrencyListName(code, t);
              return (
                <li key={code}>
                  <button
                    className={cn(styles.accountRow)}
                    onClick={() => setCurrency(code)}
                    type="button"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt=""
                      className={styles.accountIcon}
                      height={36}
                      src={getCurrencyIconUrl(code)}
                      width={36}
                    />
                    <span className={styles.accountMeta}>
                      <span className={styles.accountName}>{name}</span>
                      <span className={styles.accountCode}>{code}</span>
                    </span>
                    <span className={styles.accountBalance} suppressHydrationWarning>
                      {hideBalance ? <HiddenBalance length={4} /> : formatMoney(amount)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
