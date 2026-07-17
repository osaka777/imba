"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteLandingAction } from "@/entities/landing/actions";
import type { PartnerLandingItem } from "@/entities/landing/types";
import styles from "./LandingList.module.css";

const TEMPLATE_LABELS: Record<PartnerLandingItem["template"], string> = {
  HERO_MATCH: "Герой-матч",
  EVENTS_GRID: "Сетка",
  PROMO_FOCUS: "Промо",
};

type Props = {
  landings: PartnerLandingItem[];
};

export function LandingList({ landings }: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      alert("Ссылка скопирована");
    } catch {
      alert("Не удалось скопировать");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Удалить лендинг?")) return;
    setBusyId(id);
    try {
      await deleteLandingAction(id);
      router.refresh();
    } catch {
      alert("Не удалось удалить");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className={styles.card}>
      <h2 className={styles.title}>Ваши лендинги ({landings.length})</h2>
      {landings.length === 0 ? (
        <p className={styles.empty}>Пока нет лендингов — создайте первый в конструкторе ниже.</p>
      ) : (
        <ul className={styles.list}>
          {landings.map((l) => (
            <li key={l.id} className={styles.item}>
              <div className={styles.itemMain}>
                <div className={styles.itemTitle}>
                  {l.title}
                  <span className={styles.badge}>{TEMPLATE_LABELS[l.template]}</span>
                </div>
                <div className={styles.itemMeta}>
                  {l.eventRefs.length} матч(ей) · {new Date(l.createdAt).toLocaleDateString("ru-RU")}
                </div>
              </div>
              <div className={styles.itemActions}>
                <a href={l.url} target="_blank" rel="noopener noreferrer" className={styles.btn}>
                  Открыть
                </a>
                <button type="button" className={styles.btn} onClick={() => copy(l.url)}>
                  Копировать
                </button>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnDanger}`}
                  disabled={busyId === l.id}
                  onClick={() => remove(l.id)}
                >
                  Удалить
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
