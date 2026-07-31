"use client";

import { useMemo } from "react";
import { useLocale } from "~/shared/model/useLocale";

import type { CyberGame } from "~/entities/cybersport/api/client";
import { readCyberWcMeta } from "~/entities/cybersport/lib/cyberGameToWcEvent";
import { cyberGameHasVideo } from "~/entities/cybersport/lib/cyberGameHasVideo";
import { gamesList, getSportLabel } from "~/entities/game/lib/gamesList";
import { formatWcCompactTime } from "~/entities/wc-odds/lib/wcCompactFormat";
import { WcTeamImage } from "~/entities/wc-odds/ui/WcTeamImage";
import { BroadcastIcon } from "~/shared/assets";
import { cn } from "~/shared/lib";

import styles from "~/entities/cybersport/ui/CyberScoreBoard.module.css";

type CyberScoreBoardProps = {
  game: CyberGame;
  hasBroadcast?: boolean;
  onBroadcastOpen?: () => void;
};

function isCyberLive(game: CyberGame): boolean {
  return (
    game.status === "IN_PROGRESS"
    || game.status === "LIVE"
    || game.status === "IN_PLAY"
    || game.status === "STARTING"
  );
}

function normalizeMapDetails(game: CyberGame): [number, number][] {
  const parsed = game.parsedScore;
  if (Array.isArray(parsed?.details) && parsed.details.length > 0) {
    return parsed.details.map((row) => {
      const [home, away] = row;
      return [Number(home) || 0, Number(away) || 0] as [number, number];
    });
  }

  const raw = parsed?.text?.details;
  if (typeof raw !== "string" || !raw.trim()) return [];

  return raw.split(",").map((part) => {
    const [homeRaw, awayRaw] = part.trim().split(":");
    return [Number(homeRaw) || 0, Number(awayRaw) || 0] as [number, number];
  });
}

function formatSeriesScore(game: CyberGame): string {
  const current = game.parsedScore?.currentScore;
  if (Array.isArray(current) && current.length >= 2) {
    return `${current[0]}:${current[1]}`;
  }
  return game.score?.trim() || "0:0";
}

export function CyberScoreBoard({
  game,
  hasBroadcast = false,
  onBroadcastOpen,
}: CyberScoreBoardProps) {
  const { locale, t } = useLocale();
  const isLive = isCyberLive(game);
  const meta = readCyberWcMeta(game);
  const showBroadcast = hasBroadcast || cyberGameHasVideo(game);
  const mapDetails = useMemo(() => normalizeMapDetails(game), [game]);
  const sportLabel = gamesList[game.sport as keyof typeof gamesList]
    ? getSportLabel(game.sport, t)
    : t("cyber.title");
  const commenceTime = meta.wcCommenceTime ?? meta.commenceTime ?? (game.meta as { commenceTime?: string })?.commenceTime;
  const kickoff = useMemo(
    () => (commenceTime ? formatWcCompactTime(commenceTime, locale) : null),
    [commenceTime, locale],
  );
  const activeMapIndex = mapDetails.length > 0 ? mapDetails.length - 1 : -1;
  const phase = game.parsedScore?.period;

  return (
    <section className={styles.board}>
      <div className={styles.metaBar}>
        <div className={styles.league}>{game.leagueName || sportLabel}</div>
        <div className={styles.metaRight}>
          {isLive && (
            <span className={styles.liveBadge}>
              <span className={styles.liveDot} />
              LIVE
            </span>
          )}
          {showBroadcast && onBroadcastOpen && (
            <button className={styles.broadcastBtn} onClick={onBroadcastOpen} type="button">
              <BroadcastIcon className={styles.broadcastIcon} />
              {t("cyber.broadcast")}
            </button>
          )}
        </div>
      </div>

      <div className={styles.main}>
        <div className={styles.teamsRow}>
          <div className={cn(styles.teamBlock, styles.teamBlock_home)}>
            <div className={styles.teamIdentity}>
              <WcTeamImage iconUrl={game.team1Icon} size={44} teamName={game.team1 ?? ""} />
              <div className={styles.teamName}>{game.team1}</div>
            </div>
          </div>

          <div className={styles.centerScore}>
            {isLive ? (
              <>
                <div className={styles.statusLabel}>{t("cyber.score")}</div>
                <div className={styles.seriesScore}>{formatSeriesScore(game)}</div>
                {phase != null && Number(phase) > 0 && (
                  <div className={styles.phaseLabel}>{t("cyber.roundN", { n: String(phase) })}</div>
                )}
              </>
            ) : kickoff ? (
              <>
                <div className={styles.statusLabel}>{t("cyber.kickoff")}</div>
                <div className={styles.prematchTime}>{kickoff.time}</div>
                <div className={styles.prematchDate}>{kickoff.date}</div>
              </>
            ) : (
              <>
                <div className={styles.statusLabel}>{t("cyber.match")}</div>
                <div className={styles.seriesScore}>VS</div>
              </>
            )}
          </div>

          <div className={cn(styles.teamBlock, styles.teamBlock_away)}>
            <div className={styles.teamIdentity}>
              <WcTeamImage iconUrl={game.team2Icon} size={44} teamName={game.team2 ?? ""} />
              <div className={styles.teamName}>{game.team2}</div>
            </div>
          </div>
        </div>

        {mapDetails.length > 0 && (
          <div
            className={styles.mapsTable}
            style={{ ["--map-cols" as string]: String(mapDetails.length) }}
          >
            <div className={styles.mapsHeader}>
              <div className={styles.mapsHeaderCell}>{t("cyber.team")}</div>
              {mapDetails.map((_, index) => (
                <div className={styles.mapsHeaderCell} key={`map-head-${index}`}>
                  {t("cyber.mapShort", { n: index + 1 })}
                </div>
              ))}
            </div>
            <div className={styles.mapsRow}>
              <div className={styles.mapsTeamCell}>{game.team1}</div>
              {mapDetails.map(([home], index) => (
                <div
                  className={cn(styles.mapsCell, index === activeMapIndex && styles.mapsCell_active)}
                  key={`map-home-${index}`}
                >
                  {home}
                </div>
              ))}
            </div>
            <div className={styles.mapsRow}>
              <div className={styles.mapsTeamCell}>{game.team2}</div>
              {mapDetails.map(([, away], index) => (
                <div
                  className={cn(styles.mapsCell, index === activeMapIndex && styles.mapsCell_active)}
                  key={`map-away-${index}`}
                >
                  {away}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
