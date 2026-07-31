"use client";

import { useCallback, useEffect, useState } from "react";

import {
  searchPredictionGifs,
  predictionGifDisplaySrc,
  type PredictionGifItem,
} from "~/entities/prediction/api/client";
import { useLocale } from "~/shared/model/useLocale";

import styles from "./PredictionGifPicker.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (gif: PredictionGifItem) => void;
};

const QUICK_TAGS = [
  "funny",
  "yes",
  "no",
  "clap",
  "dance",
  "laugh",
  "wow",
  "sad",
  "cool",
] as const;

export function PredictionGifPicker({ open, onClose, onPick }: Props) {
  const { t } = useLocale();
  const [query, setQuery] = useState("funny");
  const [draft, setDraft] = useState("");
  const [items, setItems] = useState<PredictionGifItem[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [broken, setBroken] = useState<Record<string, boolean>>({});

  const load = useCallback(
    async (q: string, pos?: string | null, append = false) => {
      setLoading(true);
      try {
        const res = await searchPredictionGifs(q, pos);
        setItems((prev) => (append ? [...prev, ...res.items] : res.items));
        setNext(res.next);
        if (!append) setBroken({});
      } catch {
        if (!append) setItems([]);
        setNext(null);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!open) return;
    void load(query || "funny");
  }, [open, query, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        aria-label={t("prediction.gifPickerTitle")}
        aria-modal="true"
        className={styles.dialog}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div className={styles.head}>
          <h2 className={styles.title}>{t("prediction.gifPickerTitle")}</h2>
          <button
            aria-label={t("prediction.gifRemove")}
            className={styles.close}
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>

        <div className={styles.searchRow}>
          <span aria-hidden className={styles.searchIcon}>
            ⌕
          </span>
          <input
            autoFocus
            className={styles.searchInput}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                setQuery(draft.trim() || "funny");
              }
            }}
            placeholder={t("prediction.gifSearchPlaceholder")}
            value={draft}
          />
          <button
            className={styles.searchGo}
            onClick={() => setQuery(draft.trim() || "funny")}
            type="button"
          >
            {t("prediction.gifSearch")}
          </button>
        </div>

        <div className={styles.tags} role="group">
          {QUICK_TAGS.map((tag) => (
            <button
              className={`${styles.tag} ${
                query === tag ? styles.tagOn : ""
              }`}
              key={tag}
              onClick={() => {
                setDraft(tag);
                setQuery(tag);
              }}
              type="button"
            >
              {tag}
            </button>
          ))}
        </div>

        <div className={styles.gridScroll}>
          {loading && items.length === 0 ? (
            <p className={styles.empty}>{t("prediction.loading")}</p>
          ) : items.length === 0 ? (
            <p className={styles.empty}>{t("prediction.gifEmpty")}</p>
          ) : (
            <div className={styles.grid}>
              {items.map((gif) => {
                if (broken[gif.id]) return null;
                const src = predictionGifDisplaySrc(gif.preview || gif.url);
                return (
                  <button
                    className={styles.cell}
                    key={gif.id}
                    onClick={() => {
                      onPick(gif);
                      onClose();
                    }}
                    title={gif.title}
                    type="button"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt=""
                      className={styles.thumb}
                      decoding="async"
                      loading="lazy"
                      onError={() =>
                        setBroken((prev) => ({ ...prev, [gif.id]: true }))
                      }
                      src={src}
                    />
                  </button>
                );
              })}
            </div>
          )}
          {next ? (
            <button
              className={styles.more}
              disabled={loading}
              onClick={() => void load(query || "funny", next, true)}
              type="button"
            >
              {loading ? t("prediction.loading") : t("prediction.gifMore")}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
