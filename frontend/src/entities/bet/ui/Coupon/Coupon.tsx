"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { getBets } from "~/entities/bet/api";
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

  const tabOnClickHandler = (tab: Tab) => () => {
    setTab(tab);
  };

  const { data } = useQuery({
    queryFn: () => getBets(), // Запрашиваем все ставки
    queryKey: ["bets", "open"],
    refetchInterval: 5000, // Обновляем каждые 5 секунд
    refetchIntervalInBackground: true,
    staleTime: 0, // Данные всегда считаются устаревшими
  });
  
  const counter = data ? 
    (data.ordinar?.filter(bet => bet.status === 'PENDING').length ?? 0) + 
    (data.express?.filter(bet => bet.status === 'PENDING').length ?? 0) : 0;

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
        {tab === "open" ? <OpenTab /> : <BetTab setIsOpen={setIsOpen} />}
      </div>
    </>
  );
};

export default Coupon;
