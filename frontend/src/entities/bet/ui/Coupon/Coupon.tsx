"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { getBets } from "~/entities/bet/api";
import { getMyWcBets } from "~/entities/wc-odds/api/getMyWcBets";
import { useAdaptivePollInterval } from "~/shared/lib/useAdaptivePollInterval";
import { OpenTab } from "~/entities/bet/ui/Coupon/OpenTab";
import { Button } from "~/shared/ui";
import { CloseIcon } from "~/shared/assets";

import { BetTab } from "./BetTab";
import styles from "./Coupon.module.css";

type CouponProps = {
  className?: string;
  classNameContainer?: string;
  setIsOpen: (value: React.SetStateAction<boolean | undefined>) => void;
};

type Tab = "coupon" | "open";

export const Coupon: React.FC<CouponProps> = ({ className, setIsOpen }) => {
  const [tab, setTab] = useState<Tab>("coupon");
  const pollInterval = useAdaptivePollInterval(5000);

  const tabOnClickHandler = (tab: Tab) => () => {
    setTab(tab);
  };

  const { data } = useQuery({
    queryFn: () => getBets(),
    queryKey: ["bets", "open"],
    refetchInterval: pollInterval,
    refetchIntervalInBackground: false,
    staleTime: 0,
  });

  const { data: wcPending = [] } = useQuery({
    queryFn: () => getMyWcBets("PENDING"),
    queryKey: ["wc-bets", "pending"],
    refetchInterval: pollInterval,
    refetchIntervalInBackground: false,
    staleTime: 0,
  });

  const counter = data
    ? (data.ordinar?.filter((bet) => bet.status === "PENDING").length ?? 0)
      + (data.express?.filter((bet) => bet.status === "PENDING").length ?? 0)
      + wcPending.length
    : wcPending.length;

  return (
    <>
      <div className={`${styles.Coupon} ${className}`} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
        <div className={styles.tabbar}>
          <Button
            className={`${styles.tab} ${tab === "coupon" && styles.active}`}
            onClick={tabOnClickHandler("coupon")}
          >
            Купон
          </Button>
          <Button
            className={`${styles.tab} ${tab === "open" && styles.active}`}
            onClick={tabOnClickHandler("open")}
          >
            Открытые ставки
            {counter > 0 && <div className={styles.counter}>{counter}</div>}
            </Button>
          </div>
          <Button 
            className={styles.closeButton} 
            onClick={() => setIsOpen(false)}
            aria-label="Закрыть купон"
          >
            <CloseIcon className={styles.closeIcon} />
          </Button>
        </div>
        {tab === "open" ? (
          <OpenTab />
        ) : (
          <BetTab onBetAccepted={() => setTab("open")} setIsOpen={setIsOpen} />
        )}
      </div>
    </>
  );
};

export default Coupon;
