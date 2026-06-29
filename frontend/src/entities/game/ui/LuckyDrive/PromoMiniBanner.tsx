"use client";

import Image from "next/image";
import Link from "next/link";
import type { MouseEvent } from "react";

import { LiveIcon } from "~/shared/assets";
import { cn } from "~/shared/lib";

import styles from "./LuckyDriveBanner.module.css";

type PromoMiniBannerProps = {
  title: string;
  subtitle: string;
  highlight?: string;
  href?: string;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  gradientFrom: string;
  gradientTo: string;
  imageSrc?: string;
  showLiveBadge?: boolean;
  className?: string;
};

export function PromoMiniBanner({
  title,
  subtitle,
  highlight,
  href,
  onClick,
  gradientFrom,
  gradientTo,
  imageSrc,
  showLiveBadge = false,
  className,
}: PromoMiniBannerProps) {
  const style = {
    backgroundImage: `linear-gradient(143deg, ${gradientFrom} 0.74%, ${gradientTo} 141.93%)`,
  };

  const content = (
    <>
      <div className={styles.miniContent}>
        <div className={styles.miniTitleRow}>
          <p className={styles.miniTitle}>{title}</p>
          {showLiveBadge ? (
            <span className={styles.miniLiveBadge}>
              <LiveIcon className={styles.icon} />
            </span>
          ) : null}
        </div>
        <div className={styles.miniSubtitleRow}>
          <p className={styles.miniSubtitle}>{subtitle}</p>
          {highlight ? <span className={styles.miniBonusTag}>{highlight}</span> : null}
        </div>
      </div>
      {imageSrc ? (
        <div className={styles.miniImageWrap}>
          <Image
            src={imageSrc}
            alt=""
            className={styles.miniImage}
            loading="lazy"
            width={107}
            height={40}
          />
        </div>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(styles.miniRoot, className)}
        style={style}
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      href={href ?? "#"}
      className={cn(styles.miniRoot, className)}
      style={style}
    >
      {content}
    </Link>
  );
}
