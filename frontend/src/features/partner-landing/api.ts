import type { PublicPartnerLanding } from "./types";
import { normalizeLandingSlug } from "./slug";

function serverApiBase(): string {
  const internal = process.env.BACKEND_URL || process.env.BACKEND_INTERNAL_URL;
  if (internal) return internal.replace(/\/$/, "");
  return (process.env.NEXT_PUBLIC_HOST || "http://localhost:3000").replace(/\/$/, "");
}

export async function fetchPublicLanding(
  rawSlug: string,
): Promise<PublicPartnerLanding | null> {
  const slug = normalizeLandingSlug(rawSlug);
  const base = serverApiBase();
  const res = await fetch(
    `${base}/api/affiliate-program/landings/public/${encodeURIComponent(slug)}`,
    { cache: "no-store" },
  );
  if (!res.ok) return null;
  return res.json();
}
