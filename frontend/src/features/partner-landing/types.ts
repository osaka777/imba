export type LandingEvent = {
  id: string;
  slug: string;
  sport: string;
  leagueName: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  oddsHome: number | null;
  oddsDraw: number | null;
  oddsAway: number | null;
  homeScore: number | null;
  awayScore: number | null;
  phase: "prematch" | "live" | "finished";
  homeTeamIcon?: string | null;
  awayTeamIcon?: string | null;
};

export type PublicPartnerLanding = {
  id: string;
  slug: string;
  title: string;
  template: "HERO_MATCH" | "EVENTS_GRID" | "PROMO_FOCUS";
  headline: string | null;
  subheadline: string | null;
  promoCode: string | null;
  defaultSub1: string | null;
  partnerTag: string;
  partnerPercent: string;
  events: LandingEvent[];
  ctaUrl: string;
};

export type PartnerLandingItem = {
  id: string;
  slug: string;
  title: string;
  template: PublicPartnerLanding["template"];
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
export type LandingEvent = {
  id: string;
  slug: string;
  sport: string;
  leagueName: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  oddsHome: number | null;
  oddsDraw: number | null;
  oddsAway: number | null;
  homeScore: number | null;
  awayScore: number | null;
  phase: "prematch" | "live" | "finished";
  homeTeamIcon?: string | null;
  awayTeamIcon?: string | null;
};

export type PublicPartnerLanding = {
  id: string;
  slug: string;
  title: string;
  template: "HERO_MATCH" | "EVENTS_GRID" | "PROMO_FOCUS";
  headline: string | null;
  subheadline: string | null;
  promoCode: string | null;
  defaultSub1: string | null;
  partnerTag: string;
  partnerPercent: string;
  events: LandingEvent[];
  ctaUrl: string;
};

export type PartnerLandingItem = {
  id: string;
  slug: string;
  title: string;
  template: PublicPartnerLanding["template"];
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
