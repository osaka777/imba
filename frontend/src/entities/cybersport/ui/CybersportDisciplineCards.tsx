"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { useCybersportCounts } from "~/entities/cybersport/hooks/useCybersportCounts";
import {
  activeCyberDisciplines,
  countActiveCyberDisciplines,
  CYBER_CARD_DEFAULT_LIMIT,
  inactiveCyberDisciplines,
} from "~/entities/cybersport/lib/cyberDisciplineSort";
import {
  CYBER_DISCIPLINE_LIST,
  cyberDisciplineHubHref,
} from "~/entities/cybersport/lib/cyberDisciplineSlugs";
import { CyberSportGlyph } from "~/entities/cybersport/ui/CyberSportGlyph";
import { cn } from "~/shared/lib";
import { useLocale } from "~/shared/model/useLocale";

import styles from "./CybersportDisciplineCards.module.css";

function DisciplineCard({
  item,
  count,
  inactive = false,
}: {
  item: (typeof CYBER_DISCIPLINE_LIST)[number];
  count?: number;
  inactive?: boolean;
}) {
  const { label, slug, apiSport } = item;

  return (
    <Link
      className={cn(styles.card, inactive && styles.card_inactive)}
      href={cyberDisciplineHubHref(slug)}
      title={inactive ? label : count ? `${label} · ${count}` : label}
    >
      <div className={styles.cardIconWrap}>
        <CyberSportGlyph
          apiSport={apiSport}
          className={styles.cardIcon}
          label={label}
          size={22}
        />
        {!inactive && count != null && count > 0 ? (
          <span className={styles.cardCount}>{count}</span>
        ) : null}
      </div>
      <span className={styles.cardTitle}>{label}</span>
    </Link>
  );
}

export function CybersportDisciplineCards() {
  const { t } = useLocale();
  const { data: counts = {} } = useCybersportCounts();
  const [showAll, setShowAll] = useState(false);

  const active = useMemo(
    () => activeCyberDisciplines(CYBER_DISCIPLINE_LIST, counts),
    [counts],
  );
  const inactive = useMemo(
    () => inactiveCyberDisciplines(CYBER_DISCIPLINE_LIST, counts),
    [counts],
  );

  const featured = active.slice(0, CYBER_CARD_DEFAULT_LIMIT);
  const activeTotal = countActiveCyberDisciplines(counts);

  return (
    <section aria-label={t("cyber.disciplinesAria")} className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>{t("cyber.disciplines")}</h2>
        {activeTotal > 0 ? (
          <span className={styles.sectionMeta}>{t("cyber.inLineAndLive", { n: activeTotal })}</span>
        ) : null}
      </div>

      {featured.length > 0 ? (
        <nav className={styles.cards}>
          {featured.map((item) => (
            <DisciplineCard
              count={counts[item.apiSport]}
              item={item}
              key={item.slug}
            />
          ))}
        </nav>
      ) : (
        <p className={styles.emptyHint}>{t("cyber.noMatchesNow")}</p>
      )}

      {(active.length > CYBER_CARD_DEFAULT_LIMIT || inactive.length > 0) && (
        <div className={styles.footer}>
          {!showAll && active.length > CYBER_CARD_DEFAULT_LIMIT ? (
            <button
              className={styles.footerBtn}
              onClick={() => setShowAll(true)}
              type="button"
            >
              {t("cyber.moreWithMatches", { n: active.length - CYBER_CARD_DEFAULT_LIMIT })}
            </button>
          ) : null}

          {!showAll && inactive.length > 0 ? (
            <button
              className={styles.footerBtn}
              onClick={() => setShowAll(true)}
              type="button"
            >
              {t("cyber.allDisciplinesCount", { n: CYBER_DISCIPLINE_LIST.length })}
            </button>
          ) : null}

          {showAll ? (
            <>
              {active.length > CYBER_CARD_DEFAULT_LIMIT ? (
                <nav className={styles.cards}>
                  {active.slice(CYBER_CARD_DEFAULT_LIMIT).map((item) => (
                    <DisciplineCard
                      count={counts[item.apiSport]}
                      item={item}
                      key={item.slug}
                    />
                  ))}
                </nav>
              ) : null}

              {inactive.length > 0 ? (
                <>
                  <p className={styles.inactiveLabel}>{t("cyber.noMatchesNowShort")}</p>
                  <nav className={cn(styles.cards, styles.cards_muted)}>
                    {inactive.map((item) => (
                      <DisciplineCard inactive item={item} key={item.slug} />
                    ))}
                  </nav>
                </>
              ) : null}

              <button
                className={styles.footerBtn}
                onClick={() => setShowAll(false)}
                type="button"
              >
                {t("cyber.collapse")}
              </button>
            </>
          ) : null}
        </div>
      )}
    </section>
  );
}
