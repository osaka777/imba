"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useReadLocalStorage } from "usehooks-ts";

import { getBets } from "~/entities/bet/api";
import { countPendingWcBets, getMyWcBetsGrouped } from "~/entities/wc-odds/api/getMyWcBets";
import { CouponIcon } from "~/shared/assets";
import { Button } from "~/shared/ui";
import { useLocale } from "~/shared/model/useLocale";

import { MQ_DESKTOP } from "~/shared/lib/layoutBreakpoints";
import { Rates } from "../../types";
import { Coupon } from "./Coupon";
import styles from "./CouponWrapper.module.css";

type CouponWrapper = {
  className?: string;
};

export const CouponWrapper: React.FC<CouponWrapper> = ({ className }) => {
  const pathname = usePathname();
  const { t } = useLocale();
  const isCybersport = pathname?.startsWith("/cybersport");
  const [isOpen, setIsOpen] = useState<boolean>();
  const [isDesktop, setIsDesktop] = useState(false);
  const rates = useReadLocalStorage<Rates>("rates", {
    initializeWithValue: false,
  });

  useEffect(() => {
    const mq = window.matchMedia(MQ_DESKTOP);
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  
  useEffect(() => {
    const handleOpenCoupon = () => setIsOpen(true);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    
    window.addEventListener("open-coupon", handleOpenCoupon);
    window.addEventListener("keydown", handleKeyDown);
  
    return () => {
      window.removeEventListener("open-coupon", handleOpenCoupon);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);
  

  useEffect(() => {
    if (isOpen && !isDesktop) {
      document.body.style.overflow = "hidden";
    } else if (!isOpen) {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen, isDesktop]);

  const { data } = useQuery({
    queryFn: () => getBets("PENDING"),
    queryKey: ["bets", "pending"],
  });

  const { data: wcGrouped = { ordinar: [], express: [] } } = useQuery({
    queryFn: () => getMyWcBetsGrouped("PENDING"),
    queryKey: ["wc-bets", "pending"],
  });

  const counter =
    (data?.ordinar?.length ?? 0) + (data?.express?.length ?? 0) + countPendingWcBets(wcGrouped);

  const hasSelections = (rates?.length ?? 0) > 0;
  const shouldMountCoupon = isDesktop || Boolean(isOpen) || counter > 0 || hasSelections;

  const kickBadgeCount =
    (rates?.length ?? 0) > 0 ? rates.length : counter;

  const triggerOnClickHandler = () => setIsOpen((prev) => !prev);

  return (
    <>
      <div
        className={`${styles.CouponWrapper} ${isOpen && styles.CouponWrapper_open} ${className}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setIsOpen(false);
          }
        }}
      >
        {shouldMountCoupon && (
          <Coupon className={styles.coupon} isOpen={Boolean(isOpen)} setIsOpen={setIsOpen} />
        )}
      </div>
      <Button
        className={`${styles.trigger} ${isCybersport ? styles.trigger_kick : ""} ${isOpen ? styles.trigger_hidden : ""}`}
        onClick={triggerOnClickHandler}
        type="button"
        aria-hidden={isOpen || undefined}
        tabIndex={isOpen ? -1 : undefined}
      >
        {isCybersport ? (
          <>
            <span className={styles.triggerLabel}>{t("coupon.title")}</span>
            {kickBadgeCount > 0 ? (
              <span className={styles.kickBadge}>{kickBadgeCount}</span>
            ) : null}
          </>
        ) : (
          <>
            <CouponIcon className={styles.icon} />
            <span className={styles.triggerLabel}>{t("coupon.title")}</span>
            {rates && rates.length > 0 ? (
              <span className={styles.triggerNumber}>{rates.length}</span>
            ) : null}
            {counter > 0 && <div className={styles.counter}>{counter}</div>}
          </>
        )}
      </Button>
    </>
  );
};
