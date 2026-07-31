import type { FC } from "react";

import { cyberDisciplineIcon } from "~/entities/cybersport/lib/cyberDisciplineIcons";

/**
 * Active cybersport filter — mirrors backend ONEWIN_ESPORTS_CATALOG.
 * Only titles that appear on the 1win gateway (not the legacy Olimpbet dump).
 */
export type CybersportCatalogEntry = {
  /** 1win sportId (kept as olimpbetId for older menu/API shapes). */
  olimpbetId: number;
  apiSport: string;
  pathSlug: string;
  label: string;
  /** Local mark shown in cyber menus / tournament heads. */
  iconUrl: string;
};

const cyberIcon = (file: string) => `/icons/cyber/${file}`;

export const CYBERSPORT_CATALOG: CybersportCatalogEntry[] = [
  {
    olimpbetId: 142,
    apiSport: "esports.cs",
    pathSlug: "cs2",
    label: "CS2",
    iconUrl: cyberIcon("cs2.svg"),
  },
  {
    olimpbetId: 47,
    apiSport: "esports.dota2",
    pathSlug: "dota-2",
    label: "Dota 2",
    iconUrl: cyberIcon("dota2.svg"),
  },
  {
    olimpbetId: 37,
    apiSport: "esports.lol",
    pathSlug: "lol",
    label: "League of Legends",
    iconUrl: cyberIcon("lol.svg"),
  },
  {
    olimpbetId: 99,
    apiSport: "esports.valorant",
    pathSlug: "valorant",
    label: "Valorant",
    iconUrl: cyberIcon("valorant.svg"),
  },
  {
    olimpbetId: 45,
    apiSport: "esports.r6",
    pathSlug: "rainbow-six",
    label: "Rainbow Six",
    iconUrl: cyberIcon("rainbow-six.svg"),
  },
  {
    olimpbetId: 136,
    apiSport: "esports.mobile-legends",
    pathSlug: "mobile-legends",
    label: "Mobile Legends",
    iconUrl: cyberIcon("mobile-legends.svg"),
  },
  {
    olimpbetId: 101,
    apiSport: "esports.kog",
    pathSlug: "king-of-glory",
    label: "King of Glory",
    iconUrl: cyberIcon("king-of-glory.svg"),
  },
  {
    olimpbetId: 59,
    apiSport: "esports.overwatch2",
    pathSlug: "overwatch-2",
    label: "Overwatch 2",
    iconUrl: cyberIcon("overwatch-2.svg"),
  },
  {
    olimpbetId: 167,
    apiSport: "esports.pubg-mobile",
    pathSlug: "pubg-mobile",
    label: "PUBG Mobile",
    iconUrl: cyberIcon("pubg-mobile.svg"),
  },
];

export function cyberIconForApiSport(apiSport: string): FC<{ className?: string }> {
  return cyberDisciplineIcon(apiSport);
}

export function cyberIconUrlForApiSport(apiSport: string): string | null {
  return CYBERSPORT_CATALOG.find((e) => e.apiSport === apiSport)?.iconUrl ?? null;
}

export function isEsportsApiSport(sport: string): boolean {
  return sport.startsWith("esports.");
}

export const CYBER_PATH_SLUG_SET = new Set(CYBERSPORT_CATALOG.map((e) => e.pathSlug));

export const CYBER_API_SPORT_TO_PATH_SLUG: Record<string, string> = Object.fromEntries(
  CYBERSPORT_CATALOG.map((e) => [e.apiSport, e.pathSlug]),
);

export const CYBER_PATH_SLUG_TO_API_SPORT: Record<string, string> = Object.fromEntries(
  CYBERSPORT_CATALOG.map((e) => [e.pathSlug, e.apiSport]),
);

export const CYBER_SPORT_LABELS: Record<string, string> = Object.fromEntries(
  CYBERSPORT_CATALOG.map((e) => [e.apiSport, e.label]),
);
