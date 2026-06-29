"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useReadLocalStorage } from "usehooks-ts";

import { getBets } from "~/entities/bet/api";
import { getMyWcBets } from "~/entities/wc-odds/api/getMyWcBets";
import { CouponIcon } from "~/shared/assets";
import { Button } from "~/shared/ui";

import { Rates } from "../../types";
import { Coupon } from "./Coupon";
import styles from "./CouponWrapper.module.css";

type CouponWrapper = {
  className?: string;
};

export const CouponWrapper: React.FC<CouponWrapper> = ({ className }) => {
  const [isOpen, setIsOpen] = useState<boolean>();
  const [width, setWidth] = useState<number>(global.innerWidth);
  const rates = useReadLocalStorage<Rates>("rates", {
    initializeWithValue: false,
  });
  
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
    const handleResize = () => setWidth(global.innerWidth);
    window.addEventListener("resize", handleResize);

    if (isOpen && width <= 767) {
      document.body.style.overflow = "hidden";
    } else if (!isOpen) {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("resize", handleResize);
    };
  }, [isOpen, width]);

  const { data } = useQuery({
    queryFn: () => getBets("PENDING"),
    queryKey: ["bets", "pending"],
  });

  const { data: wcPending = [] } = useQuery({
    queryFn: () => getMyWcBets("PENDING"),
    queryKey: ["wc-bets", "pending"],
  });

  const counter =
    (data?.ordinar?.length ?? 0) + (data?.express?.length ?? 0) + wcPending.length;

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
        <Coupon className={styles.coupon} setIsOpen={setIsOpen} />
      </div>
      <Button className={styles.trigger} onClick={triggerOnClickHandler}>
        {rates && rates.length > 0 && (
          <span className={styles.triggerNumber}>{rates.length}</span>
        )}
        <CouponIcon className={styles.icon} />
        {counter > 0 && <div className={styles.counter}>{counter}</div>}
      </Button>
    </>
  );
};
