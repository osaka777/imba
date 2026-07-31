"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";

import { useCybersportCounts } from "~/entities/cybersport/hooks/useCybersportCounts";
import { activeCyberDisciplines } from "~/entities/cybersport/lib/cyberDisciplineSort";
import {
  type CyberDisciplineSlug,
  CYBER_DISCIPLINE_LIST,
  cyberDisciplineHubHref,
  cyberDisciplineLineHref,
  cyberDisciplineLiveHref,
  disciplineFromPathname,
} from "~/entities/cybersport/lib/cyberDisciplineSlugs";
import { CyberSportGlyph } from "~/entities/cybersport/ui/CyberSportGlyph";
import { cn } from "~/shared/lib";
import { useLocale } from "~/shared/model/useLocale";

import styles from "./CybersportMenu.module.css";

type CybersportMenuProps = {
  sport?: string;
  discipline?: CyberDisciplineSlug;
  mode: "live" | "line";
};

export function CybersportMenu({ sport, discipline, mode }: CybersportMenuProps) {
  const { t } = useLocale();
  const pathname = usePathname();
  const pathnameDiscipline = disciplineFromPathname(pathname);
  const { data: counts = {} } = useCybersportCounts();

  const visibleDisciplines = useMemo(
    () => activeCyberDisciplines(CYBER_DISCIPLINE_LIST, counts),
    [counts],
  );

  return (
    <div className={styles.menu}>
      {visibleDisciplines.map(({ label, slug, apiSport }) => {
        const href =
          mode === "live"
            ? cyberDisciplineLiveHref(slug)
            : cyberDisciplineLineHref(slug);
        const active =
          discipline === slug
          || pathnameDiscipline === slug
          || sport === apiSport;
        const count = counts[apiSport] ?? 0;

        return (
          <Link
            className={cn(styles.item, active && styles.item_active)}
            href={href}
            key={slug}
          >
            <CyberSportGlyph
              apiSport={apiSport}
              className={styles.icon}
              label={label}
            />
            <span>{label}</span>
            {count > 0 ? <span className={styles.count}>{count}</span> : null}
          </Link>
        );
      })}
      <Link
        className={cn(
          styles.item,
          styles.item_hub,
          pathname === "/cybersport" && styles.item_active,
        )}
        href="/cybersport"
      >
        <span>{t("common.all")}</span>
      </Link>
    </div>
  );
}
