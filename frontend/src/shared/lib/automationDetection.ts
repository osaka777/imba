/**
 * Detects Selenium / CDP / headless automation in the browser.
 * High-confidence only — must not false-positive real Chrome or native WebViews.
 */

export function detectBrowserAutomation(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  try {
    if (navigator.webdriver === true) return true;

    const doc = document as Document & {
      documentElement?: HTMLElement & { getAttribute?: (name: string) => string | null };
    };
    if (doc.documentElement?.getAttribute?.("webdriver") === "true") return true;

    const win = window as Window & Record<string, unknown>;
    const markers = [
      "__selenium_unwrapped",
      "__selenium_evaluate",
      "__fxdriver_evaluate",
      "__driver_evaluate",
      "__webdriver_evaluate",
      "__driver_unwrapped",
      "__fxdriver_unwrapped",
      "_Selenium_IDE_Recorder",
      "_selenium",
      "calledSelenium",
      "domAutomation",
      "domAutomationController",
      "$chrome_asyncScriptInfo",
      "__lastWatirAlert",
      "__lastWatirConfirm",
      "__lastWatirPrompt",
    ];
    for (const key of markers) {
      if (key in win) return true;
    }

    // ChromeDriver classic CDP probe properties.
    for (const key of Object.keys(win)) {
      if (key.startsWith("cdc_") || key.startsWith("$cdc_")) return true;
    }

    const nav = navigator as Navigator & {
      connection?: { rtt?: number };
      userAgent?: string;
    };
    const ua = (nav.userAgent || "").toLowerCase();
    if (ua.includes("headlesschrome") || ua.includes("; headless")) return true;

    // Phantom / Nightmare leftovers.
    if ("callPhantom" in win || "_phantom" in win || "phantom" in win) return true;
  } catch {
    return false;
  }

  return false;
}
