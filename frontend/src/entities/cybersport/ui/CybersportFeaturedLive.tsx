"use client";

import Link from "next/link";
import { useMemo } from "react";

import { useCybersportFeaturedLive } from "~/entities/cybersport/hooks/useCybersportFeaturedLive";
import { apiSportToDisciplineSlug } from "~/entities/cybersport/lib/cyberDisciplineSlugs";
import { maskCybersportLabel } from "~/entities/cybersport/lib/maskCybersportLabel";
import { FeaturedLiveQuickOdds } from "~/entities/cybersport/ui/FeaturedLiveQuickOdds";
import { WcTeamImage } from "~/entities/wc-odds/ui/WcTeamImage";

import styles from "./CybersportFeaturedLive.module.css";

type CybersportFeaturedLiveProps = {
  sport?: string;
  limit?: number;
  title?: string;
};

function formatScore(game: {
  parsedScore?: { currentScore?: number[] };
  score?: string;
}): string {
  const current = game.parsedScore?.currentScore;
  if (Array.isArray(current) && current.length >= 2) {
    return `${current[0]}:${current[1]}`;
  }
  return game.score?.replace(/\s/g, "")?.trim() || "0:0";
}

function FeaturedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className={styles.skeletonTrack}>
      {Array.from({ length: count }, (_, i) => (
        <div className={styles.skeletonCard} key={i}>
          <div className={styles.skeletonPreview}>
            <span className={styles.skeletonAvatar} />
            <span className={styles.skeletonPlay} />
            <span className={styles.skeletonAvatar} />
          </div>
          <div className={styles.skeletonOdds}>
            <span className={styles.skeletonChip} />
            <span className={styles.skeletonChip} />
          </div>
          <div className={styles.skeletonMeta}>
            <div className={styles.skeletonLine} />
            <div className={styles.skeletonLineShort} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CybersportFeaturedLive({
  sport,
  limit = 5,
  title = "Прямой эфир",
}: CybersportFeaturedLiveProps) {
  const { data: games = [], isLoading } = useCybersportFeaturedLive(limit, sport);

  const viewAllHref = useMemo(() => {
    if (!sport) return "/cybersport/live";
    const slug = apiSportToDisciplineSlug(sport);
    return slug ? `/cybersport/${slug}/live` : `/cybersport/live?sport=${encodeURIComponent(sport)}`;
  }, [sport]);

  if (isLoading) {
    return (
      <section aria-busy="true" aria-label="Live сейчас" className={styles.section}>
        <div className={styles.head}>
          <h2 className={styles.title}>
            <span className={styles.livePill}>LIVE</span>
            {title}
          </h2>
        </div>
        <FeaturedSkeleton count={Math.min(limit, 3)} />
      </section>
    );
  }

  if (games.length === 0) {
    return (
      <section aria-label="Live сейчас" className={styles.section}>
        <div className={styles.head}>
          <h2 className={styles.title}>
            <span className={styles.livePill}>LIVE</span>
            {title}
          </h2>
        </div>
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>Сейчас нет live-матчей</p>
          <Link className={styles.emptyLink} href="/cybersport/line">
            Смотреть линию →
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Live сейчас" className={styles.section}>
      <div className={styles.head}>
        <h2 className={styles.title}>
          <span className={styles.livePill}>LIVE</span>
          {title}
        </h2>
        <Link className={styles.viewAll} href={viewAllHref}>
          Смотреть все
        </Link>
      </div>

      <div className={styles.track}>
        {games.map((game) => {
          const href = `/cybersport/game/${game.eventId}`;
          const team1 = maskCybersportLabel(game.team1);
          const team2 = maskCybersportLabel(game.team2);

          return (
            <article className={styles.card} data-sport={game.sport} key={game.eventId}>
              <Link className={styles.previewLink} href={href}>
                <div className={styles.preview}>
                  <div className={styles.previewGlow} />
                  <div className={styles.previewTeams}>
                    <WcTeamImage
                      iconUrl={game.team1Icon}
                      size={40}
                      teamName={game.team1 ?? ""}
                    />
                    <span className={styles.previewScore}>{formatScore(game)}</span>
                    <WcTeamImage
                      iconUrl={game.team2Icon}
                      size={40}
                      teamName={game.team2 ?? ""}
                    />
                  </div>
                  <span aria-hidden className={styles.watchBtn}>
                    <svg className={styles.watchIcon} viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                  <span className={styles.previewLive}>LIVE</span>
                </div>
              </Link>

              <FeaturedLiveQuickOdds game={game} />

              <Link className={styles.meta} href={href}>
                <p className={styles.matchTitle}>
                  {team1}
                  <span className={styles.vs}> vs </span>
                  {team2}
                </p>
                <p className={styles.league}>
                  {maskCybersportLabel(game.leagueName)}
                </p>
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
