export type PartnerLandingItem = {
  id: string;
  slug: string;
  title: string;
  template: "HERO_MATCH" | "EVENTS_GRID" | "PROMO_FOCUS";
  headline: string | null;
  subheadline: string | null;
  promoCode: string | null;
  eventRefs: string[];
  defaultSub1: string | null;
  isPublished: boolean;
  url: string;
  eventLimit: number;
  createdAt: string;
};

export type WcEventPickerItem = {
  id: string;
  slug: string;
  homeTeam: string;
  awayTeam: string;
  leagueName: string;
  commenceTime: string;
  phase: "prematch" | "live" | "finished";
  oddsHome: number | null;
  oddsDraw: number | null;
  oddsAway: number | null;
};

export type CreateLandingPayload = {
  title: string;
  template: PartnerLandingItem["template"];
  headline?: string;
  subheadline?: string;
  promoCode?: string;
  eventRefs: string[];
  defaultSub1?: string;
};
