"use client";

import { useCallback, useEffect, useState } from "react";

import { DEFAULT_CYBER_SPORT } from "~/entities/cybersport/lib/cyberSportsList";

const STORAGE_KEY = "imba-cyber-sport-filter";

function readStoredSport(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value?.startsWith("esports.") ? value : null;
  } catch {
    return null;
  }
}

export function useCyberSportPreference(initialSport?: string) {
  const [sport, setSportState] = useState(initialSport ?? DEFAULT_CYBER_SPORT);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // URL (?sport=) имеет приоритет над localStorage — без flash при шаринге ссылок
    if (initialSport) {
      setSportState(initialSport);
    } else {
      const stored = readStoredSport();
      if (stored) setSportState(stored);
    }
    setHydrated(true);
  }, [initialSport]);

  const setSport = useCallback((next: string) => {
    setSportState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore quota errors */
    }
  }, []);

  const syncUrlSport = useCallback((next: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("sport", next);
    window.history.replaceState(null, "", url.toString());
  }, []);

  return { sport, setSport, syncUrlSport, hydrated };
}
