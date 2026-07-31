"use client";

import InfiniteScroll from "react-infinite-scroller";
import { useCallback } from "react";

import type { CyberDisciplineSlug } from "~/entities/cybersport/lib/cyberDisciplineSlugs";
import { resolveCyberSportLabel } from "~/entities/cybersport/lib/cyberSportsList";
import { useCyberSportPreference } from "~/entities/cybersport/hooks/useCyberSportPreference";
import { useCybersportFeed } from "~/entities/cybersport/hooks/useCybersportFeed";
import { CybersportLeagueMenu } from "~/entities/cybersport/ui/CybersportLeagueMenu";
import { CybersportMatchSkeleton } from "~/entities/cybersport/ui/CybersportMatchSkeleton";
import { CybersportSidebarMenu } from "~/entities/cybersport/ui/CybersportSidebarMenu";
import { LuckyDriveBanner } from "~/entities/game/ui/LuckyDrive/LuckyDriveBanner";
import { Search } from "~/entities/game/ui/Search";
import { TournamentTable } from "~/entities/game/ui/TournamentTable";
import prematchStyles from "~/entities/game/ui/GamesPrematch/GamesPrematch.module.css";
import shellStyles from "~/entities/game/ui/SportPageShell.module.css";
import { cn } from "~/shared/lib";
import { useLocale } from "~/shared/model/useLocale";
import { LoadingSpinner } from "~/shared/ui";
import { Header } from "~/widgets/Header";

type CybersportLineHubProps = {
  initialSport?: string;
  disciplineSlug?: CyberDisciplineSlug;
};

/**
 * Prematch line for /cybersport/{discipline}/line — SportPageShell chrome
 * with cybersport-only sidebar (not WC sports menu).
 */
export function CybersportLineHub({ initialSport, disciplineSlug }: CybersportLineHubProps) {
  const { t } = useLocale();
  const { sport, hydrated } = useCyberSportPreference(initialSport);
  const sportLabel = resolveCyberSportLabel(sport);

  const {
    leagues,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
  } = useCybersportFeed(sport, "line");

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const showLoader =
    isFetchingNextPage || (isLoading && leagues.length === 0) || !hydrated;

  return (
    <div className={prematchStyles.GamesPrematch}>
      <div className={shellStyles.pageShell}>
        <div className={shellStyles.pageHeaderSlot}>
          <Header />
        </div>
        <div className={shellStyles.pageFlow}>
          <div className={shellStyles.sidebarColumn}>
            <aside className={shellStyles.sportsSidebar}>
              <div className={shellStyles.sidebarControls}>
                <div className={shellStyles.sidebarSearchSlot}>
                  <Search sport={sport} />
                </div>
              </div>
              <div className={shellStyles.sidebarMenuScroll}>
                <CybersportSidebarMenu
                  className={cn(sport && shellStyles.sportsMenuSlot_mobileHidden)}
                  discipline={disciplineSlug}
                  layout="sidebar"
                  mode="line"
                  sport={sport}
                />
                {sport ? (
                  <CybersportLeagueMenu layout="sidebar" type="prematch" />
                ) : null}
              </div>
            </aside>
          </div>

          <div className={shellStyles.pageMain}>
            <div className={shellStyles.pageMainLead}>
              <LuckyDriveBanner compact placement="line" />
            </div>
            <div className={shellStyles.pageMainBody}>
              <Search hideOnDesktop sport={sport} />

              {!hydrated || (isLoading && leagues.length === 0) ? (
                <CybersportMatchSkeleton rows={5} />
              ) : (
                <InfiniteScroll
                  className={prematchStyles.GamesPrematch}
                  hasMore={Boolean(hasNextPage) && !isFetchingNextPage}
                  loadMore={loadMore}
                  pageStart={0}
                  threshold={250}
                  useWindow
                >
                  {error ? (
                    <div className="p-4 text-center bg-red-500/10 text-red-500">
                      {t("cyber.lineLoadFailed")}
                    </div>
                  ) : null}

                  {leagues.length === 0 && !error ? (
                    <p className="p-4 text-center bg-white/5">
                      {t("cyber.noLineSport", { sport: sportLabel.toLowerCase() })}
                    </p>
                  ) : (
                    leagues.map((league, index) => (
                      <TournamentTable
                        gameLinkPrefix="/cybersport/game/"
                        games={league.games}
                        isLive={false}
                        key={`${league.leagueName}-${index}`}
                        league={league.leagueName}
                        sport={league.games[0]?.sport ?? sport}
                      />
                    ))
                  )}

                  {showLoader && leagues.length > 0 ? (
                    <LoadingSpinner
                      className={prematchStyles.loading}
                      key="cyber-line-loading"
                    />
                  ) : null}
                </InfiniteScroll>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
