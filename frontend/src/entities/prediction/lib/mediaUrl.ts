export function resolvePredictionMediaUrl(
  url: string | null | undefined,
): string | null {
  if (!url?.trim()) return null;
  const value = url.trim();
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  const path = value.startsWith("/") ? value : `/${value}`;
  if (typeof window !== "undefined") {
    return `${window.location.origin}${path}`;
  }
  const base =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_HOST ||
    "";
  return base ? `${base.replace(/\/$/, "")}${path}` : path;
}
