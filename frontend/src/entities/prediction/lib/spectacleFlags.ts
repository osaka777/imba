/**
 * Imba Markets spectacle features — all off (restored pre-spectacle UX).
 * Re-enable individually or set MASTER true if needed again.
 */
export const MARKETS_SPECTACLE_MASTER = false;

const on = (v: boolean) => MARKETS_SPECTACLE_MASTER && v;

export const spectacleFlags = {
  featuredBanner: on(false),
  activityFeed: on(false),
  portfolioBookmarks: on(false),
  sparklines: on(false),
  priceFlash: on(false),
  leaderboard: on(false),
  globalTape: on(false),
  urgencyTags: on(false),
  settleDrama: on(false),
} as const;
