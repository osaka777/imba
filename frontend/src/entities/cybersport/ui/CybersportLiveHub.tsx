"use client";

import InfiniteScroll from "react-infinite-scroller";
import { useCallback } from "react";

import type { CyberDisciplineSlug } from "~/entities/cybersport/lib/cyberDisciplineSlugs";
import { useCyberSportPreference } from "~/entities/cybersport/hooks/useCyberSportPreference";
import { useCybersportFeed } from "~/entities/cybersport/hooks/useCybersportFeed";
import { CybersportLeagueMenu } from "~/entities/cybersport/ui/CybersportLeagueMenu";
import { CybersportSidebarMenu } from "~/entities/cybersport/ui/CybersportSidebarMenu";
import { LuckyDriveBanner } from "~/entities/game/ui/LuckyDrive/LuckyDriveBanner";
import { Search } from "~/entities/game/ui/Search";
import { TournamentTable } from "~/entities/game/ui/TournamentTable";
import gamesStyles from "~/entities/game/ui/Games/Games.module.css";
import shellStyles from "~/entities/game/ui/SportPageShell.module.css";
import { cn } from "~/shared/lib";
import { useLocale } from "~/shared/model/useLocale";
import { LoadingSpinner } from "~/shared/ui";
import { Header } from "~/widgets/Header";

type CybersportLiveHubProps = {
  initialSport?: string;
  disciplineSlug?: CyberDisciplineSlug;
};

/** /cybersport/{discipline}/live — same layout as /live. */
export function CybersportLiveHub({ initialSport, disciplineSlug }: CybersportLiveHubProps) {
  const { t } = useLocale();
  const { sport, hydrated } = useCyberSportPreference(initialSport);
  const sportFilter = sport || undefined;

  const {
    leagues,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
  } = useCybersportFeed(sportFilter, "live");

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const showLoader =
    isFetchingNextPage
    || ((isLoading || !hydrated) && leagues.length === 0);

  return (
    <div className={gamesStyles.Games}>
      <div className={shellStyles.pageShell}>
        <div className={shellStyles.pageHeaderSlot}>
          <Header />
        </div>
        <div className={shellStyles.pageFlow}>
          <div className={shellStyles.sidebarColumn}>
            <aside className={shellStyles.sportsSidebar}>
              <div className={shellStyles.sidebarControls}>
                <div className={shellStyles.sidebarSearchSlot}>
                  <Search sport={sportFilter} />
                </div>
              </div>
              <div className={shellStyles.sidebarMenuScroll}>
                <CybersportSidebarMenu
                  className={cn(sportFilter && shellStyles.sportsMenuSlot_mobileHidden)}
                  discipline={disciplineSlug}
                  layout="sidebar"
                  mode="live"
                  sport={sportFilter}
                />
                {sportFilter ? (
                  <CybersportLeagueMenu layout="sidebar" type="live" />
                ) : null}
              </div>
            </aside>
          </div>

          <div className={shellStyles.pageMain}>
            <div className={shellStyles.pageMainLead}>
              <LuckyDriveBanner compact placement="live" />
            </div>
            <div className={shellStyles.pageMainBody}>
              <Search hideOnDesktop sport={sportFilter} />
              <InfiniteScroll
                className={gamesStyles.Games}
                element="div"
                hasMore={Boolean(hasNextPage) && !isFetchingNextPage}
                loadMore={loadMore}
                pageStart={0}
                threshold={250}
                useWindow
              >
                {error ? (
                  <div className="p-4 text-center bg-red-500/10 text-red-500">
                    {t("common.gamesLoadError")}
                  </div>
                ) : null}

                {hydrated
                  && !isLoading
                  && !error
                  && leagues.length === 0 ? (
                  <p className="p-4 text-center bg-white/5">
                    {t("common.gamesNotFound")}
                  </p>
                ) : null}

                {leagues.map((league, index) => (
                  <TournamentTable
                    gameLinkPrefix="/cybersport/game/"
                    games={league.games}
                    isLive
                    key={`${league.leagueName}-${index}`}
                    league={league.leagueName}
                    sport={league.games[0]?.sport ?? sportFilter ?? "esports.cs"}
                  />
                ))}

                {showLoader ? (
                  <LoadingSpinner className={gamesStyles.loading} key="cyber-live-hub-loading" />
                ) : null}
              </InfiniteScroll>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
