/**
 * Match-level pauses only (rain delay, stoppage, delayed start).
 * Do NOT include EVENT_SUSPENDED — Olimpbet uses it constantly while play continues
 * (bookmaker trading pause). Showing «Приостановлен» then looks like the match stopped.
 */
const WC_FEED_PAUSED_STATUSES = new Set([
  "EVENT_INTERRUPTED",
  "EVENT_DELAYED",
]);

export function isWcFeedPaused(feedStatus: string | null | undefined): boolean {
  if (!feedStatus) return false;
  const status = feedStatus.trim().toUpperCase();
  if (WC_FEED_PAUSED_STATUSES.has(status)) return true;
  // Avoid matching SUSPEND — that is trading suspension, not match pause.
  return status.includes("INTERRUPT") || status.includes("DELAY");
}

export function wcFeedPausedLabel(locale: "ru" | "en" = "ru"): string {
  return locale === "en" ? "Suspended" : "Приостановлен";
}
