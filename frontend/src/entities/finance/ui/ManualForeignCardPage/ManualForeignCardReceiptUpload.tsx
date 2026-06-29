"use client";

import { useCallback, useId, useRef, useState } from "react";

import styles from "./ManualForeignCardPage.module.css";

const MAX_BYTES = 10 * 1024 * 1024;

type ManualForeignCardReceiptUploadProps = {
  file: File | null;
  previewUrl: string | null;
  disabled?: boolean;
  onChange: (file: File | null) => void;
};

const IconUpload = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 16V4" />
    <path d="m7 9 5-5 5 5" />
    <path d="M4 20h16" />
  </svg>
);

const IconImage = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="9" cy="11" r="2" />
    <path d="m21 17-5-5-4 4-2-2-5 5" />
  </svg>
);

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export function ManualForeignCardReceiptUpload({
  file,
  previewUrl,
  disabled = false,
  onChange,
}: ManualForeignCardReceiptUploadProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const applyFile = useCallback(
    (next: File | null) => {
      if (!next) {
        onChange(null);
        return;
      }
      if (!next.type.startsWith("image/")) {
        return;
      }
      if (next.size > MAX_BYTES) {
        return;
      }
      onChange(next);
    },
    [onChange],
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] ?? null;
    applyFile(picked);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (disabled) return;
    applyFile(e.dataTransfer.files?.[0] ?? null);
  };

  return (
    <section className={styles.receiptSection} aria-label="Прикрепление чека">
      <div className={styles.receiptHeader}>
        <span className={styles.receiptHeaderIcon}>
          <IconImage />
        </span>
        <div>
          <h3 className={styles.receiptTitle}>Прикрепите чек перевода</h3>
          <p className={styles.receiptSubtitle}>
            Скрин или фото из банка — без чека заявку не примем
          </p>
        </div>
      </div>

      {previewUrl && file ? (
        <div className={styles.receiptPreviewCard}>
          <div className={styles.receiptPreviewMedia}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="Превью чека" className={styles.receiptPreviewImg} src={previewUrl} />
          </div>
          <div className={styles.receiptPreviewMeta}>
            <p className={styles.receiptFileName}>{file.name}</p>
            <p className={styles.receiptFileSize}>{formatFileSize(file.size)}</p>
            <div className={styles.receiptPreviewActions}>
              <button
                className={styles.receiptGhostBtn}
                disabled={disabled}
                onClick={() => inputRef.current?.click()}
                type="button"
              >
                Заменить
              </button>
              <button
                className={styles.receiptDangerBtn}
                disabled={disabled}
                onClick={() => onChange(null)}
                type="button"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      ) : (
        <label
          className={`${styles.receiptDropzone} ${dragActive ? styles.receiptDropzone_active : ""} ${disabled ? styles.receiptDropzone_disabled : ""}`}
          htmlFor={inputId}
          onDragEnter={(e) => {
            e.preventDefault();
            if (!disabled) setDragActive(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragActive(false);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
        >
          <span className={styles.receiptDropIcon}>
            <IconUpload />
          </span>
          <span className={styles.receiptDropTitle}>Перетащите файл сюда</span>
          <span className={styles.receiptDropHint}>или нажмите, чтобы выбрать с телефона</span>
          <span className={styles.receiptDropFormats}>JPG, PNG, WEBP · до 10 МБ</span>
        </label>
      )}

      <input
        accept="image/jpeg,image/png,image/webp,image/gif"
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
