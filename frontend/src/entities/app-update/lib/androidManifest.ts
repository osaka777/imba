export type AndroidAppManifest = {
  platform: "android";
  version: string;
  versionCode: number;
  apkUrl: string;
  minSupportedVersion?: string;
  title: string;
  subtitle: string;
  highlights: string[];
  cta: string;
  later: string;
};

export async function fetchAndroidAppManifest(): Promise<AndroidAppManifest | null> {
  try {
    const res = await fetch(`/app-android.json?t=${Date.now()}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as AndroidAppManifest;
  } catch {
    return null;
  }
}

/** Compare dotted versions: 2.5.0 > 2.4.0 → 1 */
export function compareSemver(a: string, b: string): number {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
}

export function isAndroidUpdateAvailable(
  installedVersion: string,
  remote: AndroidAppManifest,
): boolean {
  if (!installedVersion || !remote.version) return false;
  return compareSemver(remote.version, installedVersion) > 0;
}

export function resolveApkAbsoluteUrl(apkUrl: string): string {
  if (apkUrl.startsWith("http://") || apkUrl.startsWith("https://")) return apkUrl;
  if (typeof window === "undefined") return apkUrl;
  return new URL(apkUrl, window.location.origin).toString();
}
