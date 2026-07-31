"use client";

import { useEffect } from "react";

const CHUNK_RELOAD_KEY = "imba_chunk_reload";

function isStaleChunkError(error: Error): boolean {
  const msg = `${error?.name ?? ""} ${error?.message ?? ""}`;
  return /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|error loading dynamically imported module/i.test(
    msg,
  );
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isStaleChunkError(error)) return;
    try {
      if (!sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
        sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
        window.location.reload();
        return;
      }
      sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    } catch {
      /* private mode */
    }
  }, [error]);

  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: 24,
        color: "#fff",
        textAlign: "center",
      }}
    >
      <p style={{ margin: 0, fontSize: 16, opacity: 0.9 }}>
        Не удалось загрузить страницу. Попробуйте обновить.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        style={{
          padding: "10px 18px",
          borderRadius: 8,
          border: "none",
          background: "#1a6fff",
          color: "#fff",
          fontSize: 14,
          cursor: "pointer",
        }}
      >
        Обновить
      </button>
    </div>
  );
}
