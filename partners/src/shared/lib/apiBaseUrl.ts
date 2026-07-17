export function getApiBaseUrl() {
  const host =
    (typeof window === "undefined" && (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_MAIN_SITE))
    || process.env.NEXT_PUBLIC_HOST
    || "http://localhost:3000";
  const base = host.replace(/\/$/, "");
  return base.endsWith("/api") ? base : `${base}/api`;
}

/** Относительный API для браузера на partners.imba.bet (same-origin через Caddy). */
export function getBrowserApiBaseUrl() {
  if (typeof window !== "undefined" && window.location.hostname === "partners.imba.bet") {
    return "/api";
  }
  return getApiBaseUrl();
}
