"use client";

import React, { useEffect, useMemo, useState } from "react";
import styles from "./BonusBonusBanner.module.css";
import { BonusBanerImage } from "~/shared/assets";
import { bannerAPI, type Banner } from "~/shared/api/banner";

export const BonusBonusBanner: React.FC = () => {
  const [data, setData] = useState<Banner | null>(null);

  useEffect(() => {
    let mounted = true;
    bannerAPI
      .getActiveBanners()
      .then((list) => {
        if (!mounted) return;
        const found = list.find((b) => b.order === 2) || null;
        setData(found);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const baseUrl = useMemo(() => process.env.NEXT_PUBLIC_HOST || "http://localhost:3000", []);
  const href = data?.linkUrl || "https://imba.bet/deposit/kzt-foreign-card";
  const imageSrc = data?.imagePath ? `${baseUrl}/${data.imagePath}` : data?.imageUrl || BonusBanerImage.src;
  const badgeText = data?.title || "Bonuses";
  const descText = data?.description || "1 available bonus";

  return (
    <a
      href={href}
      className={styles.wrapper}
      style={{
        // css var copies from external sample if parent supports
        // @ts-ignore
        ['--06c7e4fc']: 'radial-gradient(50% 120% at 85% 83.22%, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0) 60%)',
      }}
    >
      <div className={styles.content}>
        <div className={styles.badge}>
          <div className={styles.badgeText}>{badgeText}</div>
        </div>
        <div className={styles.desc}>
          <div className={styles.pulse}>
            <div className={styles.pulseDot}></div>
          </div>
          <p style={{ margin: 0 }}>{descText}</p>
        </div>
      </div>
      <picture className={styles.picture}>
        <img className={styles.bg} src={imageSrc} alt="bonus" />
      </picture>
    </a>
  );
}
