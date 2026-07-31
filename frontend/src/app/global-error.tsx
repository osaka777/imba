"use client";

import { useEffect } from "react";

const CHUNK_RELOAD_KEY = "imba_chunk_reload";

function isStaleChunkError(error: Error): boolean {
  const msg = `${error?.name ?? ""} ${error?.message ?? ""}`;
  return /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|error loading dynamically imported module/i.test(
    msg,
  );
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[imba global-error]", error?.name, error?.message, error?.digest);
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

  const detail =
    typeof error?.message === "string" && error.message.trim()
      ? error.message.slice(0, 180)
      : null;

  return (
    <html lang="ru">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 24,
          background: "#090F1E",
          color: "#fff",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
        }}
      >
        <p style={{ margin: 0, fontSize: 16, opacity: 0.9 }}>
          Не удалось загрузить imba.bet. Попробуйте обновить страницу.
        </p>
        {detail ? (
          <p
            style={{
              margin: 0,
              maxWidth: 420,
              fontSize: 12,
              opacity: 0.45,
              wordBreak: "break-word",
            }}
          >
            {detail}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => {
            try {
              sessionStorage.removeItem(CHUNK_RELOAD_KEY);
            } catch {
              /* ignore */
            }
            window.location.assign("/");
          }}
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
        <button
          type="button"
          onClick={() => reset()}
          style={{
            padding: 0,
            border: "none",
            background: "transparent",
            color: "rgba(255,255,255,0.55)",
            fontSize: 13,
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          Попробовать ещё раз
        </button>
      </body>
    </html>
  );
}
