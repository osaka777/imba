"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "~/app/providers/AuthProvider";
import { getUser } from "~/entities/user/api";
import {
  formatBonusTimeLeft,
  getWagerProgressPercent,
  isBonusExpired,
} from "~/entities/user/lib/bonusExpiry";
import { useCurrency } from "~/shared/model/useCurrency";
import { LazyWelcomeBonusModal } from "~/shared/lib/lazyModals";
import {
  buildWelcomeDepositPath,
} from "./welcomeBonusDeposit";
import { formatWelcomeMoney, getWelcomeLimit } from "./welcomeBonusLimits";
import { WELCOME_BONUS_STICKY_BANNER_ENABLED } from "./welcomeBonusCopy";

import styles from "./WelcomeBonusStickyBanner.module.css";

type BonusBalance = {
  currencyCode: string;
  amount: string;
  totalWagered: string;
  requiredWager: string;
  isActive: boolean;
  requiresDeposit?: boolean;
  depositActivated?: boolean;
  expiresAt?: string | null;
};

export function WelcomeBonusStickyBanner() {
  const { isAuth } = useAuth();
  const { currency } = useCurrency();
  const pathname = usePathname();
  const router = useRouter();
  const [tick, setTick] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);

  const { data: user } = useQuery({
    queryKey: ["user"],
    queryFn: getUser,
    enabled: isAuth,
    staleTime: 60_000,
  });

  const bonus = useMemo(
    () =>
      (user?.bonusBalances as BonusBalance[] | undefined)?.find(
        (b) => b.currencyCode === currency,
      ),
    [user?.bonusBalances, currency],
  );

  const limit = getWelcomeLimit(currency);

  const locked = Boolean(
    bonus?.requiresDeposit && !bonus?.depositActivated && !isBonusExpired(bonus?.expiresAt),
  );

  const wagering = Boolean(
    bonus?.depositActivated
    && bonus?.isActive
    && Number(bonus.requiredWager) > 0
    && Number(bonus.totalWagered) < Number(bonus.requiredWager)
    && !isBonusExpired(bonus?.expiresAt),
  );

  const visible =
    WELCOME_BONUS_STICKY_BANNER_ENABLED && isAuth && bonus && (locked || wagering);

  useEffect(() => {
    if (!visible || !bonus?.expiresAt) return;
    const id = setInterval(() => setTick((v) => v + 1), 30_000);
    return () => clearInterval(id);
  }, [visible, bonus?.expiresAt]);

  const timeLeft = useMemo(
    () => formatBonusTimeLeft(bonus?.expiresAt),
    [bonus?.expiresAt, tick],
  );

  const wagerPct = getWagerProgressPercent(bonus?.totalWagered, bonus?.requiredWager);

  if (!visible || pathname?.startsWith("/profile")) {
    return null;
  }

  const goDeposit = () => router.push(buildWelcomeDepositPath(currency));

  return (
    <>
      <div className={styles.bar} role="region" aria-label="Welcome-бонус">
        <div className={styles.inner}>
          <div className={styles.icon} aria-hidden>
            🎁
          </div>
          <div className={styles.body}>
            <div className={styles.titleRow}>
              <p className={styles.title}>
                {locked ? "Welcome-бонус ждёт депозита" : "Отыгрыш welcome-бонуса"}
              </p>
              <span className={styles.badge}>40%</span>
            </div>
            <p className={styles.subtitle}>
              {locked ? (
                <>
                  Пополни от{" "}
                  <strong>{formatWelcomeMoney(limit.minDeposit, limit.currency)}</strong>
                  {" "}— получи до{" "}
                  <strong>{formatWelcomeMoney(limit.maxBonus, limit.currency)}</strong> бонусом
                </>
              ) : (
                <>
                  Осталось отыграть {100 - wagerPct}% · бонус{" "}
                  <strong>{bonus?.amount}</strong> {currency}
                </>
              )}
              {timeLeft ? (
                <>
                  {" · "}
                  <span className={styles.timer}>⏱ {timeLeft}</span>
                </>
              ) : null}
            </p>
            {wagering ? (
              <div className={styles.progressWrap} aria-hidden>
                <div className={styles.progressFill} style={{ width: `${wagerPct}%` }} />
              </div>
            ) : null}
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.cta} onClick={goDeposit}>
              {locked ? "Пополнить" : "В профиль"}
            </button>
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() => setModalOpen(true)}
            >
              Условия
            </button>
          </div>
        </div>
      </div>

      {modalOpen ? (
        <LazyWelcomeBonusModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
      ) : null}
    </>
  );
}
