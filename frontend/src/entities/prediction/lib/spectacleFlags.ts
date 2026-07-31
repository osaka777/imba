/**
 * Imba Markets spectacle features.
 * Flip any flag to `false` to disable without a git revert.
 * Full rollback: `git revert` commits on `feature/imba-markets-spectacle`
 * or set `MARKETS_SPECTACLE_MASTER = false`.
 */
export const MARKETS_SPECTACLE_MASTER = true;

const on = (v: boolean) => MARKETS_SPECTACLE_MASTER && v;

export const spectacleFlags = {
  /** Video/image featured carousel on /markets */
  featuredBanner: on(true),
  /** Recent trades on event page */
  activityFeed: on(true),
  /** /markets/portfolio + /markets/bookmarks */
  portfolioBookmarks: on(true),
  /** Mini chance charts on hub cards */
  sparklines: on(true),
  /** Flash green/red when chance moves */
  priceFlash: on(true),
  /** Top traders strip on hub */
  leaderboard: on(true),
  /** Live global trade tape on hub */
  globalTape: on(true),
  /** Hot / closing-soon badges */
  urgencyTags: on(true),
  /** Settle result celebration overlay */
  settleDrama: on(true),
} as const;
