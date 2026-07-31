"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type UiTheme = "graphite" | "classic";

/** Bumped key so previous auto-graphite default does not stick after restore. */
export const UI_THEME_STORAGE_KEY = "imbaUiTheme";

type ThemeContextType = {
  theme: UiTheme;
  setTheme: (theme: UiTheme) => void;
  toggleTheme: () => void;
  isGraphite: boolean;
  isClassic: boolean;
  isClient: boolean;
};

const ThemeContext = createContext<ThemeContextType | null>(null);

const FORCED_THEME: UiTheme = "classic";

function applyThemeToDocument(theme: UiTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-ui-theme", theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", "#090F1E");
  }
}

function writeStoredTheme(theme: UiTheme) {
  try {
    localStorage.setItem(UI_THEME_STORAGE_KEY, JSON.stringify(theme));
  } catch {
    /* ignore quota / private mode */
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<UiTheme>(FORCED_THEME);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // Always classic — clear any previously saved graphite preference.
    setThemeState(FORCED_THEME);
    writeStoredTheme(FORCED_THEME);
    applyThemeToDocument(FORCED_THEME);
    setIsClient(true);
  }, []);

  const setTheme = useCallback((_next: UiTheme) => {
    setThemeState(FORCED_THEME);
    writeStoredTheme(FORCED_THEME);
    applyThemeToDocument(FORCED_THEME);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(FORCED_THEME);
  }, [setTheme]);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme,
      isGraphite: false,
      isClassic: true,
      isClient,
    }),
    [theme, setTheme, toggleTheme, isClient],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

const FALLBACK_THEME: ThemeContextType = {
  theme: "classic",
  setTheme: () => {},
  toggleTheme: () => {},
  isGraphite: false,
  isClassic: true,
  isClient: false,
};

export function useUiTheme() {
  return useContext(ThemeContext) ?? FALLBACK_THEME;
}
