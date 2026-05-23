"use client";

import React, { useEffect, useMemo, useState } from "react";
import styles from "./BonusBibikaBanner.module.css";
import { BonusBibikaImage } from "~/shared/assets";
import { bannerAPI, type Banner } from "~/shared/api/banner";

export const BonusBibikaBanner: React.FC = () => {
  const [data, setData] = useState<Banner | null>(null);

  useEffect(() => {
    let mounted = true;
    bannerAPI.getActiveBanners().then((list) => {
      if (!mounted) return;
      const found = list.find(b => b.order === 1) || null;
      setData(found);
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  const baseUrl = useMemo(() => process.env.NEXT_PUBLIC_HOST || 'http://localhost:3000', []);
  const href = data?.linkUrl || "https://imba.bet/deposit/kzt-foreign-card";
  const imageSrc = data?.imagePath ? `${baseUrl}/${data.imagePath}` : (data?.imageUrl || BonusBibikaImage.src);
  const title = data?.title || "Free Money";
  const desc = data?.description || "Giving away Ferrari F8 Spider & other prizes";

  return (
    <a href={href} className={styles.banner}>
      <div className={styles.content}>
        <div className={styles.badge}>{title}</div>
        <p className={styles.desc}>{desc}</p>
      </div>
      <img alt="promo" src={imageSrc} className={styles.image} />
    </a>
  );
}
