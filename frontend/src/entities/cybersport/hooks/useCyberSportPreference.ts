"use client";

import { useCallback, useEffect, useState } from "react";

import { DEFAULT_CYBER_SPORT } from "~/entities/cybersport/lib/cyberSportsList";

const STORAGE_KEY = "imba-cyber-sport-filter";

/** Empty string = all disciplines (home live hub). */
function readStoredSport(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "") return "";
    return value?.startsWith("esports.") ? value : null;
  } catch {
    return null;
  }
}

export function useCyberSportPreference(initialSport?: string) {
  const [sport, setSportState] = useState(
    initialSport !== undefined ? initialSport : DEFAULT_CYBER_SPORT,
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // URL / explicit initialSport wins; otherwise restore localStorage (incl. "").
    if (initialSport !== undefined && initialSport !== "") {
      setSportState(initialSport);
    } else if (initialSport === "") {
      const stored = readStoredSport();
      setSportState(stored ?? "");
    } else {
      const stored = readStoredSport();
      if (stored != null) setSportState(stored);
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
    if (next) url.searchParams.set("sport", next);
    else url.searchParams.delete("sport");
    window.history.replaceState(null, "", url.toString());
  }, []);

  return { sport, setSport, syncUrlSport, hydrated };
}
