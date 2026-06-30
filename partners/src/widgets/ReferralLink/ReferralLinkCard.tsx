"use client";

import { useState } from "react";
import styles from "./ReferralLinkCard.module.css";
import type { PartnerPromoCode } from "@/entities/user/api/getReferralLink";

type Props = {
  referralLink: string;
  percent: string;
  promoCodes?: PartnerPromoCode[];
};

export function ReferralLinkCard({ referralLink, percent, promoCodes = [] }: Props) {
  const [copied, setCopied] = useState(false);
  const [copiedPromo, setCopiedPromo] = useState<string | null>(null);
  const [sub1, setSub1] = useState("");
  const [sub2, setSub2] = useState("");
  const [sub3, setSub3] = useState("");
  const [sub4, setSub4] = useState("");
  const [sub5, setSub5] = useState("");

  const buildLink = (promoCode?: string) => {
    const url = new URL(referralLink);
    const subs: [string, string][] = [
      ["sub1", sub1],
      ["sub2", sub2],
      ["sub3", sub3],
      ["sub4", sub4],
      ["sub5", sub5],
    ];
    for (const [key, val] of subs) {
      const t = val.trim().slice(0, 64);
      if (t) url.searchParams.set(key, t);
    }
    if (promoCode) url.searchParams.set("promo", promoCode);
    return url.toString();
  };

  const copyText = async (text: string, kind: "link" | "promo", promoCode?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      if (kind === "link") {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else if (promoCode) {
        setCopiedPromo(promoCode);
        setTimeout(() => setCopiedPromo(null), 2000);
      }
    } catch {
      setCopied(false);
    }
  };

  const displayLink = buildLink();

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <h2 className={styles.title}>Ваша реферальная ссылка</h2>
        <span className={styles.badge}>RevShare {percent}%</span>
      </div>
      <p className={styles.desc}>
        Делитесь ссылкой или промокодом. Игрок закрепляется за вами при регистрации.
        Комиссия начисляется с проигрышных ставок.
      </p>
      <div className={styles.linkRow}>
        <input className={styles.input} readOnly value={displayLink} />
        <button type="button" className={styles.button} onClick={() => copyText(displayLink, "link")}>
          {copied ? "Скопировано" : "Копировать"}
        </button>
      </div>

      <div className={styles.subsRow}>
        <label className={styles.subField}>
          sub1
          <input value={sub1} onChange={(e) => setSub1(e.target.value)} placeholder="telegram" />
        </label>
        <label className={styles.subField}>
          sub2
          <input value={sub2} onChange={(e) => setSub2(e.target.value)} placeholder="post_id" />
        </label>
        <label className={styles.subField}>
          sub3
          <input value={sub3} onChange={(e) => setSub3(e.target.value)} placeholder="banner" />
        </label>
        <label className={styles.subField}>
          sub4
          <input value={sub4} onChange={(e) => setSub4(e.target.value)} placeholder="geo" />
        </label>
        <label className={styles.subField}>
          sub5
          <input value={sub5} onChange={(e) => setSub5(e.target.value)} placeholder="creative" />
        </label>
      </div>

      {promoCodes.length > 0 && (
        <div className={styles.promoBlock}>
          <h3 className={styles.promoTitle}>Ваши промокоды</h3>
          <ul className={styles.promoList}>
            {promoCodes.map((promo) => (
              <li key={promo.id} className={styles.promoItem}>
                <div className={styles.promoMeta}>
                  <strong>{promo.code}</strong>
                  <span>
                    {promo.used}/{promo.available} · до{" "}
                    {new Date(promo.validUntil).toLocaleDateString("ru-RU")}
                  </span>
                </div>
                <div className={styles.promoActions}>
                  <button
                    type="button"
                    className={styles.promoBtn}
                    onClick={() => copyText(promo.code, "promo", promo.code)}
                  >
                    {copiedPromo === promo.code ? "Скопировано" : "Код"}
                  </button>
                  <button
                    type="button"
                    className={styles.promoBtn}
                    onClick={() => copyText(buildLink(promo.code), "promo", promo.code)}
                  >
                    Ссылка+код
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
