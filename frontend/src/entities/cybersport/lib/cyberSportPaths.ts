import {
  CYBER_API_SPORT_TO_PATH_SLUG,
  CYBER_PATH_SLUG_TO_API_SPORT,
} from "~/entities/cybersport/lib/cyberDisciplineCatalog";

export function apiSportFromPathSlug(pathSlug: string): string | null {
  return CYBER_PATH_SLUG_TO_API_SPORT[pathSlug] ?? null;
}

export function pathSlugFromApiSport(apiSport: string): string | null {
  return CYBER_API_SPORT_TO_PATH_SLUG[apiSport] ?? null;
}

export function liveSportQueryUrl(apiSport: string, extra?: Record<string, string>): string {
  const params = new URLSearchParams({ sport: apiSport });
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value) params.set(key, value);
    }
  }
  return `/live?${params.toString()}`;
}

/** In-cyber live hub (Kick streaming page). */
export function cyberLiveHubUrl(apiSport: string, extra?: Record<string, string>): string {
  const params = new URLSearchParams({ sport: apiSport });
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value) params.set(key, value);
    }
  }
  return `/cybersport/live?${params.toString()}`;
}

/** In-cyber prematch hub. */
export function cyberLineHubUrl(apiSport: string, extra?: Record<string, string>): string {
  const params = new URLSearchParams({ sport: apiSport });
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value) params.set(key, value);
    }
  }
  return `/cybersport/line?${params.toString()}`;
}

export function lineSportQueryUrl(apiSport: string, extra?: Record<string, string>): string {
  const params = new URLSearchParams({ sport: apiSport });
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value) params.set(key, value);
    }
  }
  return `/line?${params.toString()}`;
}

/** Map legacy /cybersport/line/{sport} → cyber line hub */
export function redirectMainSiteFromCyberPath(pathname: string): string | null {
  const legacyLineSport = pathname.match(/^\/cybersport\/line\/([^/]+)\/?$/);
  if (legacyLineSport) {
    const raw = legacyLineSport[1];
    const apiSport =
      raw.startsWith("esports.")
        ? raw
        : apiSportFromPathSlug(raw) ?? raw;
    if (apiSport.startsWith("esports.")) return cyberLineHubUrl(apiSport);
  }

  return null;
}
