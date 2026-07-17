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
import { cn } from "~/shared/lib";

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
  const { Icon, label, slug } = item;

  return (
    <Link
      className={cn(styles.card, inactive && styles.card_inactive)}
      href={cyberDisciplineHubHref(slug)}
      title={inactive ? label : count ? `${label} · ${count}` : label}
    >
      <div className={styles.cardIconWrap}>
        <Icon className={styles.cardIcon} />
        {!inactive && count != null && count > 0 ? (
          <span className={styles.cardCount}>{count}</span>
        ) : null}
      </div>
      <span className={styles.cardTitle}>{label}</span>
    </Link>
  );
}

export function CybersportDisciplineCards() {
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
    <section aria-label="Дисциплины киберспорта" className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>Дисциплины</h2>
        {activeTotal > 0 ? (
          <span className={styles.sectionMeta}>{activeTotal} в линии и live</span>
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
        <p className={styles.emptyHint}>Сейчас нет матчей — загляните позже</p>
      )}

      {(active.length > CYBER_CARD_DEFAULT_LIMIT || inactive.length > 0) && (
        <div className={styles.footer}>
          {!showAll && active.length > CYBER_CARD_DEFAULT_LIMIT ? (
            <button
              className={styles.footerBtn}
              onClick={() => setShowAll(true)}
              type="button"
            >
              Ещё {active.length - CYBER_CARD_DEFAULT_LIMIT} с матчами
            </button>
          ) : null}

          {!showAll && inactive.length > 0 ? (
            <button
              className={styles.footerBtn}
              onClick={() => setShowAll(true)}
              type="button"
            >
              Все дисциплины ({CYBER_DISCIPLINE_LIST.length})
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
                  <p className={styles.inactiveLabel}>Без матчей сейчас</p>
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
                Свернуть
              </button>
            </>
          ) : null}
        </div>
      )}
    </section>
  );
}
