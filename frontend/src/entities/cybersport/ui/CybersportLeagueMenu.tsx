"use client";

import { useSearchParams } from "next/navigation";
import React, { useMemo } from "react";

import { CYBER_SPORT_LABELS } from "~/entities/cybersport/lib/cyberDisciplineCatalog";
import { useCybersportLeagues } from "~/entities/cybersport/hooks/useCybersportLeagues";
import { isEsportsSport } from "~/entities/cybersport/lib/isEsportsSport";
import {
  pathSlugFromApiSport,
} from "~/entities/cybersport/lib/cyberSportPaths";
import { CyberSportGlyph } from "~/entities/cybersport/ui/CyberSportGlyph";
import { useSportFilter } from "~/entities/game/lib/useSportFilter";
import { ArrowIcon } from "~/shared/assets";
import { cn } from "~/shared/lib";
import { useLocale } from "~/shared/model/useLocale";
import { Button } from "~/shared/ui";

import styles from "./CybersportLeagueMenu.module.css";

type CybersportLeagueMenuProps = {
  type: "live" | "prematch";
  layout?: "horizontal" | "sidebar";
};

function cyberModeBasePath(type: "live" | "prematch", apiSport: string): string {
  const slug = pathSlugFromApiSport(apiSport);
  if (slug) {
    return type === "live" ? `/cybersport/${slug}/live` : `/cybersport/${slug}/line`;
  }
  return type === "live" ? "/cybersport/live" : "/cybersport/line";
}

export const CybersportLeagueMenu = React.memo(function CybersportLeagueMenu({
  type,
  layout = "horizontal",
}: CybersportLeagueMenuProps) {
  const { t } = useLocale();
  const sport = useSportFilter();
  const searchParams = useSearchParams();
  const activeLeague = searchParams.get("league");
  const mode = type === "live" ? "live" : "line";

  const { data: leagues = [], isLoading } = useCybersportLeagues(sport, mode);

  const sportDef = useMemo(
    () =>
      sport
        ? { label: CYBER_SPORT_LABELS[sport] ?? sport }
        : undefined,
    [sport],
  );

  const backPath = type === "live" ? "/cybersport/live" : "/cybersport/line";
  const sportBase = sport ? cyberModeBasePath(type, sport) : backPath;
  const sportAllHref = sport
    ? `${sportBase}?sport=${encodeURIComponent(sport)}`
    : backPath;

  const totalCount = useMemo(
    () => leagues.reduce((sum, item) => sum + item.count, 0),
    [leagues],
  );

  if (!sport || !isEsportsSport(sport)) return null;

  if (isLoading) {
    return (
      <div className={cn(styles.menu, layout === "sidebar" && styles.menu_sidebar)}>
        <div className={styles.wrapper}>
          <div className={styles.loading}>{t("common.loadingTournaments")}</div>
        </div>
      </div>
    );
  }

  const isSidebar = layout === "sidebar";
  const isAllActive = !activeLeague;

  const leagueHref = (
    tournamentId: number | null | undefined,
    leagueName: string,
  ) => {
    const params = new URLSearchParams({ sport: sport ?? "" });
    if (tournamentId != null) params.set("tournament", String(tournamentId));
    if (leagueName) params.set("league", leagueName);
    return `${sportBase}?${params.toString()}`;
  };

  return (
    <div className={cn(styles.menu, isSidebar && styles.menu_sidebar)}>
      <div className={styles.wrapper}>
        <Button className={styles.backButton} elementType="link" href={backPath}>
          <ArrowIcon className={styles.backIcon} />
          <span>Hub</span>
        </Button>

        {sport ? (
          <div className={styles.currentSport}>
            <CyberSportGlyph
              apiSport={sport}
              className={styles.sportIcon}
              label={sportDef?.label ?? sport}
            />
            <span className={styles.sportName}>{sportDef?.label ?? sport}</span>
          </div>
        ) : null}

        {isSidebar ? <span className={styles.sectionLabel}>{t("common.tournaments")}</span> : null}

        <Button
          className={cn(styles.item, isAllActive && styles.item_active)}
          elementType="link"
          href={sportAllHref}
          scroll={isSidebar ? false : undefined}
        >
          <p className={styles.text}>
            {t("common.all")}
            {totalCount > 0 ? <span className={styles.count}>{totalCount}</span> : null}
          </p>
        </Button>

        {leagues.map(({ leagueName, count, href, tournamentId }) => {
          const itemHref =
            href
            ?? leagueHref(tournamentId, leagueName);
          const active =
            activeLeague === leagueName
            || (searchParams.get("tournament") != null
              && tournamentId != null
              && searchParams.get("tournament") === String(tournamentId));

          return (
            <Button
              className={cn(styles.item, active && styles.item_active)}
              elementType="link"
              href={itemHref}
              key={leagueName}
              scroll={isSidebar ? false : undefined}
              title={leagueName}
            >
              <p className={styles.text}>
                {leagueName}
                {count > 0 ? <span className={styles.count}>{count}</span> : null}
              </p>
            </Button>
          );
        })}
      </div>
    </div>
  );
});
