"use client";

import { useCallback, useMemo, useState, useTransition } from "react";

import { updateKickOnboardingAction } from "@/entities/kick/actions";
import type { KickSession, KickStatus } from "@/entities/kick/api";

import styles from "./KickOnboardingChecklist.module.css";

type Props = {
  status: KickStatus | null;
  sessions: KickSession[];
};

type ManualCheckId = "link" | "obs";

export function KickOnboardingChecklist({ status, sessions }: Props) {
  const [linkDone, setLinkDone] = useState(Boolean(status?.onboarding?.linkDone));
  const [obsDone, setObsDone] = useState(Boolean(status?.onboarding?.obsDone));
  const [isPending, startTransition] = useTransition();

  const connected = Boolean(status?.connected);
  const brandedStream = sessions.some((session) => session.hadBranding);

  const items = useMemo(
    () => [
      {
        id: "connected",
        label: "Kick подключён к партнёрскому аккаунту",
        done: connected,
        manual: false,
      },
      {
        id: "link",
        label: "Ссылка imba.bet добавлена в описание канала или чат",
        done: linkDone,
        manual: true,
      },
      {
        id: "obs",
        label: "OBS-оверлей (Browser Source) добавлен в сцену",
        done: obsDone,
        manual: true,
      },
      {
        id: "branding",
        label: "Проведён эфир с imba-брендингом в заголовке",
        done: brandedStream,
        manual: false,
      },
    ],
    [connected, linkDone, obsDone, brandedStream],
  );

  const doneCount = items.filter((item) => item.done).length;

  const toggleManual = useCallback((id: ManualCheckId, next: boolean) => {
    if (id === "link") setLinkDone(next);
    if (id === "obs") setObsDone(next);

    startTransition(async () => {
      try {
        const patch = id === "link" ? { linkDone: next } : { obsDone: next };
        const result = await updateKickOnboardingAction(patch);
        setLinkDone(result.onboarding.linkDone);
        setObsDone(result.onboarding.obsDone);
      } catch {
        if (id === "link") setLinkDone((prev) => !next ? next : prev);
        if (id === "obs") setObsDone((prev) => !next ? next : prev);
      }
    });
  }, []);

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <h2 className={styles.title}>Чеклист стримера</h2>
        <span className={styles.progress}>
          {doneCount}/{items.length}
        </span>
      </div>
      <p className={styles.desc}>
        Пройдите шаги: подключите Kick ($10 welcome), добавьте ссылку и начните приводить игроков.
      </p>

      <ul className={styles.list}>
        {items.map((item) => (
          <li className={styles.item} key={item.id}>
            {item.manual ? (
              <label className={styles.manualLabel}>
                <input
                  checked={item.done}
                  className={styles.checkbox}
                  disabled={isPending}
                  type="checkbox"
                  onChange={(e) => toggleManual(item.id as ManualCheckId, e.target.checked)}
                />
                <span className={item.done ? styles.labelDone : styles.label}>{item.label}</span>
              </label>
            ) : (
              <div className={styles.autoItem}>
                <span className={`${styles.dot} ${item.done ? styles.dotDone : ""}`} aria-hidden />
                <span className={item.done ? styles.labelDone : styles.label}>{item.label}</span>
              </div>
            )}
          </li>
        ))}
      </ul>

      {doneCount === items.length ? (
        <p className={styles.complete}>Все шаги выполнены — можно масштабировать эфиры.</p>
      ) : null}
    </section>
  );
}

export function markKickLinkChecklistDone() {
  void updateKickOnboardingAction({ linkDone: true });
}
