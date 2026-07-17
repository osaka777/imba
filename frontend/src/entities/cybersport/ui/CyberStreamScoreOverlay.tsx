"use client";

import type { CyberGame } from "~/entities/cybersport/api/client";
import { maskCybersportLabel } from "~/entities/cybersport/lib/maskCybersportLabel";
import { WcTeamImage } from "~/entities/wc-odds/ui/WcTeamImage";

import styles from "./CyberStreamScoreOverlay.module.css";

type CyberStreamScoreOverlayProps = {
  game: CyberGame;
  isLive: boolean;
  onFullscreen?: () => void;
  showFullscreen?: boolean;
};

function formatScore(game: CyberGame): string {
  const current = game.parsedScore?.currentScore;
  if (Array.isArray(current) && current.length >= 2) {
    return `${current[0]}:${current[1]}`;
  }
  return game.score?.replace(/\s/g, "")?.trim() || "0:0";
}

function mapLabel(game: CyberGame): string | null {
  const parsed = game.parsedScore as {
    details?: [number, number][];
    mapScore?: number[];
    currentMap?: number;
  } | undefined;

  if (Array.isArray(parsed?.details) && parsed.details.length > 0) {
    const last = parsed.details[parsed.details.length - 1];
    const mapIndex = parsed.details.length;
    return `Map ${mapIndex} · ${last[0]}:${last[1]}`;
  }

  if (Array.isArray(parsed?.mapScore) && parsed.mapScore.length >= 2) {
    return `Map ${parsed.mapScore[0]}:${parsed.mapScore[1]}`;
  }
  if (typeof parsed?.currentMap === "number" && parsed.currentMap > 0) {
    return `Map ${parsed.currentMap}`;
  }
  return null;
}

export function CyberStreamScoreOverlay({
  game,
  isLive,
  onFullscreen,
  showFullscreen = false,
}: CyberStreamScoreOverlayProps) {
  const team1 = maskCybersportLabel(game.team1);
  const team2 = maskCybersportLabel(game.team2);
  const map = mapLabel(game);

  return (
    <div className={styles.overlay}>
      <div className={styles.gradient} />
      <div className={styles.content}>
        {isLive ? <span className={styles.livePill}>LIVE</span> : null}
        <div className={styles.teamsRow}>
          <div className={styles.team}>
            <WcTeamImage iconUrl={game.team1Icon} size={28} teamName={game.team1 ?? ""} />
            <span className={styles.teamName}>{team1}</span>
          </div>
          <div className={styles.center}>
            {map && isLive ? (
              <span className={styles.mapPrimary}>{map}</span>
            ) : null}
            <span className={styles.score}>{formatScore(game)}</span>
            {map && !isLive ? <span className={styles.map}>{map}</span> : null}
          </div>
          <div className={styles.team}>
            <WcTeamImage iconUrl={game.team2Icon} size={28} teamName={game.team2 ?? ""} />
            <span className={styles.teamName}>{team2}</span>
          </div>
        </div>
        {game.leagueName ? (
          <p className={styles.league}>{maskCybersportLabel(game.leagueName)}</p>
        ) : null}
        {(showFullscreen && onFullscreen) ? (
          <div className={styles.actions}>
            <button className={styles.fullscreenBtn} onClick={onFullscreen} type="button">
              На весь экран
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
