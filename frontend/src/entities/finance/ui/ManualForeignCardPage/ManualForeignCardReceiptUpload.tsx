"use client";

import { useCallback, useId, useRef, useState } from "react";

import { useLocale } from "~/shared/model/useLocale";
import styles from "./ManualForeignCardPage.module.css";

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

type ManualForeignCardReceiptUploadProps = {
  file: File | null;
  previewUrl: string | null;
  disabled?: boolean;
  onChange: (file: File | null) => void;
};

const IconUpload = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M12 16V4" />
    <path d="m7 9 5-5 5 5" />
    <path d="M4 20h16" />
  </svg>
);

const IconImage = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="9" cy="11" r="2" />
    <path d="m21 17-5-5-4 4-2-2-5 5" />
  </svg>
);

function isAcceptedImage(file: File): boolean {
  if (file.type && file.type.startsWith("image/")) return true;
  // Some OS/DnD payloads omit MIME — fall back to extension.
  return /\.(jpe?g|png|webp|gif)$/i.test(file.name);
}

export function ManualForeignCardReceiptUpload({
  file,
  previewUrl,
  disabled = false,
  onChange,
}: ManualForeignCardReceiptUploadProps) {
  const { t } = useLocale();
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return t("deposit.sizeKb", { n: String(Math.round(bytes / 1024)) });
    return t("deposit.sizeMb", { n: (bytes / (1024 * 1024)).toFixed(1) });
  };
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyFile = useCallback(
    (next: File | null) => {
      setError(null);
      if (!next) {
        onChange(null);
        return;
      }
      if (!isAcceptedImage(next)) {
        setError(t("deposit.receiptImageRequired"));
        return;
      }
      if (next.size > MAX_BYTES) {
        setError(t("deposit.receiptTooBig"));
        return;
      }
      onChange(next);
    },
    [onChange, t],
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] ?? null;
    applyFile(picked);
    e.target.value = "";
  };

  const openPicker = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    dragDepth.current += 1;
    setDragActive(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragActive(false);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    setDragActive(false);
    if (disabled) return;
    const dropped = e.dataTransfer.files?.[0] ?? null;
    applyFile(dropped);
  };

  return (
    <section className={styles.receiptSection} aria-label={t("deposit.receiptAria")}>
      <div className={styles.receiptHeader}>
        <span className={styles.receiptHeaderIcon} aria-hidden>
          <IconImage />
        </span>
        <div>
          <h3 className={styles.receiptTitle}>{t("deposit.receiptTitle")}</h3>
          <p className={styles.receiptSubtitle}>
            {t("deposit.receiptHint")}
          </p>
        </div>
      </div>

      {previewUrl && file ? (
        <div className={styles.receiptPreviewCard}>
          <div className={styles.receiptPreviewMedia}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={t("deposit.receiptPreviewAlt")}
              className={styles.receiptPreviewImg}
              src={previewUrl}
            />
          </div>
          <div className={styles.receiptPreviewMeta}>
            <p className={styles.receiptFileName}>{file.name}</p>
            <p className={styles.receiptFileSize}>{formatFileSize(file.size)}</p>
            <div className={styles.receiptPreviewActions}>
              <button
                className={styles.receiptGhostBtn}
                disabled={disabled}
                onClick={openPicker}
                type="button"
              >
                {t("deposit.replace")}
              </button>
              <button
                className={styles.receiptDangerBtn}
                disabled={disabled}
                onClick={() => onChange(null)}
                type="button"
              >
                {t("deposit.remove")}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          className={`${styles.receiptDropzone} ${dragActive ? styles.receiptDropzone_active : ""} ${disabled ? styles.receiptDropzone_disabled : ""}`}
          onClick={openPicker}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openPicker();
            }
          }}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-controls={inputId}
          aria-disabled={disabled || undefined}
        >
          <span className={styles.receiptDropIcon} aria-hidden>
            <IconUpload />
          </span>
          <span className={styles.receiptDropTitle}>{t("deposit.dropFileHere")}</span>
          <span className={styles.receiptDropHint}>
            {t("deposit.orPickPhone")}
          </span>
          <span className={styles.receiptDropFormats}>
            {t("deposit.receiptFormats")}
          </span>
        </div>
      )}

      {error ? <p className={styles.receiptError}>{error}</p> : null}

      <input
        accept={ACCEPT}
        className={styles.receiptInputHidden}
        disabled={disabled}
        id={inputId}
        onChange={onInputChange}
        ref={inputRef}
        type="file"
      />
    </section>
  );
}
