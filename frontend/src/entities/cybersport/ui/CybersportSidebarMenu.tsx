"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useCybersportCounts } from "~/entities/cybersport/hooks/useCybersportCounts";
import {
  activeCyberDisciplines,
  sortCyberDisciplines,
} from "~/entities/cybersport/lib/cyberDisciplineSort";
import {
  CYBER_DISCIPLINE_LIST,
  type CyberDisciplineSlug,
  cyberDisciplineLineHref,
  cyberDisciplineLiveHref,
  disciplineFromPathname,
} from "~/entities/cybersport/lib/cyberDisciplineSlugs";
import { CyberSportGlyph } from "~/entities/cybersport/ui/CyberSportGlyph";
import { cn } from "~/shared/lib";
import { useLocale } from "~/shared/model/useLocale";

import menuStyles from "~/entities/game/ui/Games/Menu.module.css";

type CybersportSidebarMenuProps = {
  /** Active apiSport key (`esports.cs`, …). Empty / undefined = all (home). */
  sport?: string;
  discipline?: CyberDisciplineSlug;
  /** live/line hubs navigate; home filters in place via onSportChange. */
  mode: "live" | "line" | "home";
  layout?: "sidebar" | "horizontal";
  className?: string;
  onSportChange?: (apiSport: string) => void;
  showBroadcastFilter?: boolean;
};

/**
 * Left sport menu for cybersport — same chrome as /live|/line Menu sidebar,
 * but only cyber disciplines and links that stay under /cybersport.
 */
export function CybersportSidebarMenu({
  sport,
  discipline,
  mode,
  layout = "sidebar",
  className,
  onSportChange,
  showBroadcastFilter = true,
}: CybersportSidebarMenuProps) {
  const { t } = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathnameDiscipline = disciplineFromPathname(pathname);
  const { data: counts = {}, isFetched: countsReady } = useCybersportCounts();

  const broadcastOnly =
    searchParams.get("broadcast") === "1" || searchParams.get("broadcast") === "true";

  const rows = useMemo(() => {
    if (countsReady && Object.keys(counts).length > 0) {
      const active = activeCyberDisciplines(CYBER_DISCIPLINE_LIST, counts);
      if (active.length > 0) return active;
    }
    return sortCyberDisciplines(CYBER_DISCIPLINE_LIST, counts);
  }, [counts, countsReady]);

  const totalCount = useMemo(
    () => Object.values(counts).reduce((sum, n) => sum + (n || 0), 0),
    [counts],
  );

  const isSidebar = layout === "sidebar";
  const allSelected = mode === "home" && !sport;

  const toggleBroadcast = () => {
    const next = new URLSearchParams(searchParams.toString());
    if (broadcastOnly) next.delete("broadcast");
    else next.set("broadcast", "1");
    const q = next.toString();
    router.push(q ? `${pathname}?${q}` : pathname, { scroll: false });
  };

  const hrefFor = (slug: CyberDisciplineSlug) => {
    if (mode === "line") return cyberDisciplineLineHref(slug);
    if (mode === "live") return cyberDisciplineLiveHref(slug);
    return `/cybersport/${slug}`;
  };

  return (
    <div
      className={cn(
        menuStyles.Menu,
        isSidebar && menuStyles.Menu_sidebar,
        className,
      )}
    >
      <div className={menuStyles.wrapper}>
        {showBroadcastFilter ? (
          <>
            <div className={menuStyles.broadcastFilter}>
              <button
                type="button"
                className={cn(
                  menuStyles.broadcastToggle,
                  broadcastOnly && menuStyles.broadcastToggle_active,
                )}
                role="switch"
                aria-checked={broadcastOnly}
                aria-label={t("cyber.withBroadcasts")}
                onClick={toggleBroadcast}
              >
                <span className={menuStyles.broadcastKnob} />
              </button>
              <span className={menuStyles.broadcastLabel}>{t("cyber.withBroadcasts")}</span>
            </div>
            <span className={menuStyles.divider} aria-hidden />
          </>
        ) : null}

        {mode === "home" && onSportChange ? (
          <button
            type="button"
            className={cn(menuStyles.item, allSelected && menuStyles.item_active)}
            onClick={() => onSportChange("")}
          >
            <p className={menuStyles.text}>
              {t("cyber.all")}
              {totalCount > 0 ? (
                <span className={menuStyles.count}>{totalCount}</span>
              ) : null}
            </p>
          </button>
        ) : (
          <Link
            className={cn(
              menuStyles.item,
              pathname === "/cybersport" && menuStyles.item_active,
            )}
            href="/cybersport"
            scroll={false}
          >
            <p className={menuStyles.text}>
              {t("cyber.hub")}
              {totalCount > 0 ? (
                <span className={menuStyles.count}>{totalCount}</span>
              ) : null}
            </p>
          </Link>
        )}

        {rows.map(({ label, slug, apiSport }) => {
          const count = counts[apiSport] ?? 0;
          const active =
            !allSelected
            && (discipline === slug
              || pathnameDiscipline === slug
              || sport === apiSport);

          if (mode === "home" && onSportChange) {
            return (
              <button
                type="button"
                className={cn(menuStyles.item, active && menuStyles.item_active)}
                key={slug}
                onClick={() => onSportChange(apiSport)}
              >
                <CyberSportGlyph
                  apiSport={apiSport}
                  className={menuStyles.icon}
                  label={label}
                />
                <p className={menuStyles.text}>
                  {label}
                  {count > 0 ? (
                    <span className={menuStyles.count}>{count}</span>
                  ) : null}
                </p>
              </button>
            );
          }

          return (
            <Link
              className={cn(menuStyles.item, active && menuStyles.item_active)}
              href={hrefFor(slug)}
              key={slug}
              scroll={false}
            >
              <CyberSportGlyph
                apiSport={apiSport}
                className={menuStyles.icon}
                label={label}
              />
              <p className={menuStyles.text}>
                {label}
                {count > 0 ? (
                  <span className={menuStyles.count}>{count}</span>
                ) : null}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
