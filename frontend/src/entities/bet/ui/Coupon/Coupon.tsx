"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { getBets } from "~/entities/bet/api";
import { countPendingWcBets, getMyWcBetsGrouped } from "~/entities/wc-odds/api/getMyWcBets";
import { useAdaptivePollInterval } from "~/shared/lib/useAdaptivePollInterval";
import { OpenTab } from "~/entities/bet/ui/Coupon/OpenTab";
import { Button } from "~/shared/ui";
import { CloseIcon } from "~/shared/assets";
import { useLocale } from "~/shared/model/useLocale";

import { BetTab } from "./BetTab";
import styles from "./Coupon.module.css";

type CouponProps = {
  className?: string;
  classNameContainer?: string;
  isOpen?: boolean;
  setIsOpen: (value: React.SetStateAction<boolean | undefined>) => void;
};

type Tab = "coupon" | "open";

export const Coupon: React.FC<CouponProps> = ({ className, isOpen, setIsOpen }) => {
  const [tab, setTab] = useState<Tab>("coupon");
  const { t } = useLocale();
  const activePollInterval = useAdaptivePollInterval(8000);
  const idlePollInterval = useAdaptivePollInterval(30_000);

  const tabOnClickHandler = (tab: Tab) => () => {
    setTab(tab);
  };

  const { data } = useQuery({
    queryFn: () => getBets(),
    queryKey: ["bets", "open"],
    refetchInterval: isOpen ? activePollInterval : idlePollInterval,
    refetchIntervalInBackground: false,
    staleTime: 4_000,
  });

  const { data: wcGrouped = { ordinar: [], express: [] } } = useQuery({
    queryFn: () => getMyWcBetsGrouped("PENDING"),
    queryKey: ["wc-bets", "pending"],
    refetchInterval: isOpen ? activePollInterval : idlePollInterval,
    refetchIntervalInBackground: false,
    staleTime: 4_000,
  });

  const counter = useMemo(
    () => (data
      ? (data.ordinar?.filter((bet) => bet.status === "PENDING").length ?? 0)
        + (data.express?.filter((bet) => bet.status === "PENDING").length ?? 0)
        + countPendingWcBets(wcGrouped)
      : countPendingWcBets(wcGrouped)),
    [data, wcGrouped],
  );

  return (
    <>
      <div className={`${styles.Coupon} ${className}`} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
        <div className={styles.tabbar}>
          <Button
            className={`${styles.tab} ${tab === "coupon" && styles.active}`}
            onClick={tabOnClickHandler("coupon")}
          >
            {t("coupon.title")}
          </Button>
          <Button
            className={`${styles.tab} ${tab === "open" && styles.active}`}
            onClick={tabOnClickHandler("open")}
          >
            {t("coupon.openBets")}
            {counter > 0 && <div className={styles.counter}>{counter}</div>}
            </Button>
          </div>
          <Button 
            className={styles.closeButton} 
            onClick={() => setIsOpen(false)}
            aria-label={t("coupon.close")}
          >
            <CloseIcon className={styles.closeIcon} />
          </Button>
        </div>
        {tab === "open" ? (
          <div className={styles.tabPanel}>
            <OpenTab isActive />
          </div>
        ) : (
          <BetTab onBetAccepted={() => setTab("open")} setIsOpen={setIsOpen} />
        )}
      </div>
    </>
  );
};

export default Coupon;
