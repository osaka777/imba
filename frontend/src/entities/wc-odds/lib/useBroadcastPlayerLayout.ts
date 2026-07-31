"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "wc-broadcast-player-layout-v1";

export const BROADCAST_DOCK_MIN_H = 120;
export const BROADCAST_DOCK_MAX_H = 420;
export const BROADCAST_FLOAT_MIN_W = 280;
export const BROADCAST_FLOAT_MIN_H = 160;
export const BROADCAST_FLOAT_MAX_W = 720;
export const BROADCAST_FLOAT_MAX_H = 480;

export type BroadcastPlayerLayout = {
  mode: "docked" | "float";
  /** Video area height (px). */
  height: number;
  /** Float window width (px). */
  width: number;
  /** Float window top-left (px). */
  x: number;
  y: number;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function defaultLayout(): BroadcastPlayerLayout {
  // Fixed coords on first paint so SSR and client hydrate match.
  return {
    mode: "docked",
    height: 186,
    width: 360,
    x: 40,
    y: 80,
  };
}

function readStored(): BroadcastPlayerLayout {
  if (typeof window === "undefined") return defaultLayout();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultLayout();
    const parsed = JSON.parse(raw) as Partial<BroadcastPlayerLayout>;
    const base = defaultLayout();
    return {
      mode: parsed.mode === "float" ? "float" : "docked",
      height: clamp(
        Number(parsed.height) || base.height,
        BROADCAST_DOCK_MIN_H,
        BROADCAST_DOCK_MAX_H,
      ),
      width: clamp(
        Number(parsed.width) || base.width,
        BROADCAST_FLOAT_MIN_W,
        BROADCAST_FLOAT_MAX_W,
      ),
      x: Number.isFinite(parsed.x) ? Number(parsed.x) : base.x,
      y: Number.isFinite(parsed.y) ? Number(parsed.y) : base.y,
    };
  } catch {
    return defaultLayout();
  }
}

function writeStored(layout: BroadcastPlayerLayout): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    /* ignore quota */
  }
}

export function useBroadcastPlayerLayout() {
  const [layout, setLayout] = useState<BroadcastPlayerLayout>(defaultLayout);
  const [hydrated, setHydrated] = useState(false);
  const layoutRef = useRef(layout);
  const draggingRef = useRef(false);

  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  useEffect(() => {
    setLayout(readStored());
    setHydrated(true);
  }, []);

  const patch = useCallback((partial: Partial<BroadcastPlayerLayout>) => {
    setLayout((prev) => {
      const next = { ...prev, ...partial };
      layoutRef.current = next;
      writeStored(next);
      return next;
    });
  }, []);

  const setDockedHeight = useCallback(
    (height: number) => {
      patch({
        mode: "docked",
        height: clamp(height, BROADCAST_DOCK_MIN_H, BROADCAST_DOCK_MAX_H),
      });
    },
    [patch],
  );

  const undockToFloat = useCallback(() => {
    setLayout((prev) => {
      const width = clamp(prev.width || 360, BROADCAST_FLOAT_MIN_W, BROADCAST_FLOAT_MAX_W);
      const height = clamp(
        Math.max(prev.height, 220),
        BROADCAST_FLOAT_MIN_H,
        BROADCAST_FLOAT_MAX_H,
      );
      const next: BroadcastPlayerLayout = {
        mode: "float",
        width,
        height,
        x: clamp(window.innerWidth - width - 28, 12, window.innerWidth - BROADCAST_FLOAT_MIN_W),
        y: clamp(96, 12, window.innerHeight - BROADCAST_FLOAT_MIN_H),
      };
      layoutRef.current = next;
      writeStored(next);
      return next;
    });
  }, []);

  const dock = useCallback(() => {
    patch({ mode: "docked" });
  }, [patch]);

  const beginPointerDrag = useCallback(
    (opts: {
      kind: "float-move" | "float-resize";
      startX: number;
      startY: number;
    }) => {
      if (draggingRef.current) return;
      draggingRef.current = true;
      const start = {
        ...layoutRef.current,
        pointerX: opts.startX,
        pointerY: opts.startY,
      };

      document.body.style.userSelect = "none";
      document.body.style.cursor =
        opts.kind === "float-move" ? "grabbing" : "nwse-resize";

      const onMove = (event: PointerEvent) => {
        const dx = event.clientX - start.pointerX;
        const dy = event.clientY - start.pointerY;

        if (opts.kind === "float-move") {
          const maxX = window.innerWidth - start.width - 8;
          const maxY = window.innerHeight - start.height - 8;
          patch({
            x: clamp(start.x + dx, 8, Math.max(8, maxX)),
            y: clamp(start.y + dy, 8, Math.max(8, maxY)),
          });
          return;
        }

        const width = clamp(start.width + dx, BROADCAST_FLOAT_MIN_W, BROADCAST_FLOAT_MAX_W);
        const height = clamp(start.height + dy, BROADCAST_FLOAT_MIN_H, BROADCAST_FLOAT_MAX_H);
        patch({ width, height });
      };

      const onUp = () => {
        draggingRef.current = false;
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [patch],
  );

  return {
    layout,
    hydrated,
    patch,
    setDockedHeight,
    undockToFloat,
    dock,
    beginPointerDrag,
  };
}
