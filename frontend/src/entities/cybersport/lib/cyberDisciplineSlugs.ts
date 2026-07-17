import {
  CYBER_API_SPORT_TO_PATH_SLUG,
  CYBER_PATH_SLUG_SET,
  CYBERSPORT_CATALOG,
  cyberIconForApiSport,
} from "~/entities/cybersport/lib/cyberDisciplineCatalog";
import { cyberLiveHubUrl, cyberLineHubUrl } from "~/entities/cybersport/lib/cyberSportPaths";

export type CyberDisciplineSlug = (typeof CYBERSPORT_CATALOG)[number]["pathSlug"];

export type CyberDisciplineConfig = {
  slug: CyberDisciplineSlug;
  /** Olimpbet / internal API sport key */
  apiSport: string;
  label: string;
  description: string;
  Icon: React.FC<{ className?: string }>;
};

export const CYBER_DISCIPLINES: Record<CyberDisciplineSlug, CyberDisciplineConfig> =
  Object.fromEntries(
    CYBERSPORT_CATALOG.map((entry) => [
      entry.pathSlug,
      {
        slug: entry.pathSlug as CyberDisciplineSlug,
        apiSport: entry.apiSport,
        label: entry.label,
        description: `${entry.label} — live и линия, ставки через Imba.bet`,
        Icon: cyberIconForApiSport(entry.apiSport),
      },
    ]),
  ) as Record<CyberDisciplineSlug, CyberDisciplineConfig>;

export const CYBER_DISCIPLINE_LIST = Object.values(CYBER_DISCIPLINES);

const API_SPORT_TO_DISCIPLINE = new Map(
  CYBER_DISCIPLINE_LIST.map((item) => [item.apiSport, item.slug]),
);

export function isCyberDisciplineSlug(value: string): value is CyberDisciplineSlug {
  return CYBER_PATH_SLUG_SET.has(value);
}

export function disciplineToApiSport(slug: CyberDisciplineSlug): string {
  return CYBER_DISCIPLINES[slug].apiSport;
}

export function apiSportToDisciplineSlug(apiSport: string): CyberDisciplineSlug | null {
  const pathSlug = CYBER_API_SPORT_TO_PATH_SLUG[apiSport];
  return pathSlug && isCyberDisciplineSlug(pathSlug) ? pathSlug : null;
}

export function resolveCyberDiscipline(slugOrApiSport: string): CyberDisciplineConfig | null {
  if (isCyberDisciplineSlug(slugOrApiSport)) {
    return CYBER_DISCIPLINES[slugOrApiSport];
  }
  const discipline = apiSportToDisciplineSlug(slugOrApiSport);
  return discipline ? CYBER_DISCIPLINES[discipline] : null;
}

export function cyberDisciplineLiveHref(slug: CyberDisciplineSlug): string {
  return `/cybersport/${slug}/live`;
}

export function cyberDisciplineLineHref(slug: CyberDisciplineSlug): string {
  return `/cybersport/${slug}/line`;
}

/** SEO landing for a discipline with live/prematch previews. */
export function cyberDisciplineHubHref(slug: CyberDisciplineSlug): string {
  return `/cybersport/${slug}`;
}

export function liveHrefForApiSport(apiSport: string): string {
  const slug = apiSportToDisciplineSlug(apiSport);
  if (slug) return cyberDisciplineLiveHref(slug);
  return cyberLiveHubUrl(apiSport);
}

export function lineHrefForApiSport(apiSport: string): string {
  const slug = apiSportToDisciplineSlug(apiSport);
  if (slug) return cyberDisciplineLineHref(slug);
  return cyberLineHubUrl(apiSport);
}

/** Resolve active discipline from pathname (/cybersport/cs2/...). */
export function disciplineFromPathname(pathname: string | null): CyberDisciplineSlug | null {
  if (!pathname) return null;
  const segment = pathname.split("/")[2];
  const resolved = segment ? resolveCyberDiscipline(segment) : null;
  return resolved?.slug ?? null;
}

export function disciplineHubFromPathname(pathname: string | null): string {
  const discipline = disciplineFromPathname(pathname);
  return discipline ? cyberDisciplineHubHref(discipline) : "/cybersport";
}
