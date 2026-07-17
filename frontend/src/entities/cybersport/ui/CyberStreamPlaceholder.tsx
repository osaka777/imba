"use client";

import type { CyberGame } from "~/entities/cybersport/api/client";
import { maskCybersportLabel } from "~/entities/cybersport/lib/maskCybersportLabel";
import { readCyberWcMeta } from "~/entities/cybersport/lib/cyberGameToWcEvent";
import { cn } from "~/shared/lib";
import { WcTeamImage } from "~/entities/wc-odds/ui/WcTeamImage";

import styles from "./CyberStreamPlaceholder.module.css";

type CyberStreamPlaceholderProps = {
  game: CyberGame;
  isLive: boolean;
  isFinished?: boolean;
};

function formatScore(game: CyberGame): string {
  const current = game.parsedScore?.currentScore;
  if (Array.isArray(current) && current.length >= 2) {
    return `${current[0]}:${current[1]}`;
  }
  return game.score?.replace(/\s/g, "")?.trim() || "0:0";
}

function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M6 4h12v3a6 6 0 0 1-12 0V4Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M6 5H3.5v1.5A3 3 0 0 0 6 9.4M18 5h2.5v1.5A3 3 0 0 1 18 9.4M12 13v3m-3.5 4h7m-5.5 0 .8-4h3.4l.8 4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function FinishedBoard({ game }: { game: CyberGame }) {
  const team1 = maskCybersportLabel(game.team1);
  const team2 = maskCybersportLabel(game.team2);

  const score = game.parsedScore;
  const details: [number, number][] = (score?.details ?? []).map((row) => [
    Number(row?.[0]) || 0,
    Number(row?.[1]) || 0,
  ]);

  let seriesHome = Number(score?.currentScore?.[0]);
  let seriesAway = Number(score?.currentScore?.[1]);
  if (details.length > 0) {
    seriesHome = details.filter(([h, a]) => h > a).length;
    seriesAway = details.filter(([h, a]) => a > h).length;
  }
  if (!Number.isFinite(seriesHome) || !Number.isFinite(seriesAway)) {
    const [h, a] = formatScore(game).split(":");
    seriesHome = Number(h) || 0;
    seriesAway = Number(a) || 0;
  }

  const homeWin = seriesHome > seriesAway;
  const awayWin = seriesAway > seriesHome;
  const winnerName = homeWin ? team1 : awayWin ? team2 : null;

  return (
    <div className={cn(styles.frame, styles.finishedFrame)} data-sport={game.sport}>
      <div className={styles.glow} aria-hidden />
      <div aria-hidden className={styles.finishedGrid} />

      <span className={styles.finishedBadge}>
        <TrophyIcon className={styles.finishedBadgeIcon} />
        Матч окончен
      </span>

      <div className={styles.finishedHero}>
        <div className={cn(styles.finishedTeam, homeWin && styles.finishedTeam_win)}>
          <span className={styles.finishedLogoWrap}>
            {homeWin ? <TrophyIcon className={styles.finishedCrown} /> : null}
            <WcTeamImage iconUrl={game.team1Icon} rounded size={52} teamName={game.team1 ?? ""} />
          </span>
          <span className={styles.finishedTeamName}>{team1}</span>
        </div>

        <div className={styles.finishedScore}>
          <span className={cn(styles.finishedNum, homeWin && styles.finishedNum_win)}>
            {seriesHome}
          </span>
          <span className={styles.finishedColon}>:</span>
          <span className={cn(styles.finishedNum, awayWin && styles.finishedNum_win)}>
            {seriesAway}
          </span>
        </div>

        <div className={cn(styles.finishedTeam, awayWin && styles.finishedTeam_win)}>
          <span className={styles.finishedLogoWrap}>
            {awayWin ? <TrophyIcon className={styles.finishedCrown} /> : null}
            <WcTeamImage iconUrl={game.team2Icon} rounded size={52} teamName={game.team2 ?? ""} />
          </span>
          <span className={styles.finishedTeamName}>{team2}</span>
        </div>
      </div>

      <span className={styles.finishedCaption}>
        {winnerName ? (
          <>
            Победа · <strong className={styles.finishedWinner}>{winnerName}</strong>
          </>
        ) : (
          "Ничья · итог по картам"
        )}
      </span>

      {details.length > 0 ? (
        <div className={styles.finishedMaps}>
          {details.map(([home, away], index) => {
            const homeMap = home > away;
            const awayMap = away > home;
            return (
              <div className={styles.finishedMapChip} key={`fin-map-${index}`}>
                <span className={styles.finishedMapLabel}>К{index + 1}</span>
                <span className={styles.finishedMapScore}>
                  <span className={cn(homeMap && styles.finishedMapWin)}>{home}</span>
                  <span className={styles.finishedMapColon}>:</span>
                  <span className={cn(awayMap && styles.finishedMapWin)}>{away}</span>
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function CyberStreamPlaceholder({
  game,
  isLive,
  isFinished,
}: CyberStreamPlaceholderProps) {
  if (isFinished) {
    return <FinishedBoard game={game} />;
  }

  const team1 = maskCybersportLabel(game.team1);
  const team2 = maskCybersportLabel(game.team2);
  const meta = readCyberWcMeta(game);
  const hasBroadcast = Boolean(
    meta.wcHasBroadcast
    || meta.hasBroadcast
    || (game.meta as { hasBroadcast?: boolean } | undefined)?.hasBroadcast,
  );

  const liveHint = isLive
    ? hasBroadcast
      ? "Подключаем трансляцию…"
      : "У поставщика нет эфира для этого турнира"
    : "Превью матча · трансляция до начала";

  return (
    <div className={styles.frame} data-sport={game.sport}>
      <div className={styles.glow} aria-hidden />
      <div className={styles.teams}>
        <WcTeamImage iconUrl={game.team1Icon} size={48} teamName={game.team1 ?? ""} />
        <div className={styles.center}>
          {isLive ? <span className={styles.livePill}>LIVE</span> : null}
          <span className={styles.score}>{formatScore(game)}</span>
          {!isLive && (game as { meta?: { raw_start_at?: string } }).meta?.raw_start_at ? (
            <span className={styles.startTime}>
              {(game as { meta?: { raw_start_at?: string } }).meta?.raw_start_at}
            </span>
          ) : null}
        </div>
        <WcTeamImage iconUrl={game.team2Icon} size={48} teamName={game.team2 ?? ""} />
      </div>
      <p className={styles.hint}>
        {liveHint}
      </p>
      <p className={styles.matchLine}>
        {team1}
        <span className={styles.vs}> vs </span>
        {team2}
      </p>
    </div>
  );
}
