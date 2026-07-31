"use client";

import { components } from "~/shared/api";
import { formatTennisGameScore } from "~/entities/wc-odds/lib/wcLiveScore";
import { formatWcCompactOdd } from "~/entities/wc-odds/lib/wcCompactFormat";
import { WcHomeOddCell } from "~/entities/wc-odds/ui/WcHomeOddCell";
import { WcTeamImage } from "~/entities/wc-odds/ui/WcTeamImage";
import {
  cyberGameSupportsWcBetting,
  cyberGameToWcEvent,
} from "~/entities/cybersport/lib/cyberGameToWcEvent";
import { FireIcon, TimeIcon, BroadcastIcon } from "~/shared/assets";
import { cn } from "~/shared/lib";
import { useLocale } from "~/shared/model/useLocale";
import { Button } from "~/shared/ui";
import { Game } from "~/entities/game/types";
import {  SubGameDto } from "../SubGames";

import { MatchFieldsRow } from "./MatchFieldsRow";
import styles from "./MatchRow.module.css";
import { useMatchRow } from "./useMatchRow";
import { isEsportsApiSport } from "~/entities/cybersport/lib/cyberDisciplineCatalog";
import { useMemo } from "react";
import { useRouter } from "next/navigation";

const ESPORTS_WINNER_FIELDS = ["WIN__P1", "WIN__P2"] as const;

const matchFields: Record<string, string[]> = {
  basketball: ["WIN_OT__P1", "WIN_RT__PX", "WIN_OT__P2"],
  hockey: ["WIN_RT__P1", "WIN_RT__PX", "WIN_RT__P2"],
  soccer: ["WIN__P1", "WIN__PX", "WIN__P2", "WIN__1X", "WIN__12", "WIN__X2"],
  "table-tennis": ["WIN__P1", "WIN__P2"],
  tennis: ["WIN__P1", "WIN__P2"],
  volleyball: ["WIN__P1", "WIN__P2"],
};

function fieldsForSport(sport: string): string[] | undefined {
  if (isEsportsApiSport(sport)) return [...ESPORTS_WINNER_FIELDS];
  return matchFields[sport];
}


type MatchRowProps = {
  isLive: boolean;
  gameLinkPrefix?: string;
  matchData: (components["schemas"]["GameDtoWithGroupedMarkets"] | Game) & {
    meta?: {
      raw_start_at?: string;
      betApiStatus?: number;
      betApiBody?: any[];
    };
    priority?: number;
    sport: string;
    status?: string;
    sub_games?: SubGameDto[];
  };
};

export const MatchRow: React.FC<MatchRowProps> = ({
  isLive,
  gameLinkPrefix = "/game/",
  matchData,
}) => {
  const { t } = useLocale();
  const { markets, marketsCount, score } = useMatchRow(matchData) as {
    markets: any;
    marketsCount: number;
    score: any;
  };

  const wcEvent = useMemo(
    () => (cyberGameSupportsWcBetting(matchData) ? cyberGameToWcEvent(matchData) : null),
    [matchData],
  );
  const isTwoWayWc = Boolean(wcEvent && wcEvent.oddsDraw == null);
  const wcHasLiveOdds = Boolean(
    wcEvent
    && (
      (wcEvent.oddsHome ?? 0) > 1
      || (wcEvent.oddsAway ?? 0) > 1
      || (wcEvent.oddsDraw ?? 0) > 1
    ),
  );
  const hasPrematchOdds = Boolean(
    fieldsForSport(matchData.sport)?.some((field) => (markets?.[field]?.cf ?? 0) > 1),
  );
  const showPrematchBadge = isLive && Boolean(wcEvent) && !wcHasLiveOdds && hasPrematchOdds;
  const router = useRouter();
  const isCyberRow = String(matchData.eventId ?? "").startsWith("cyber-");
  const cyberMeta = (matchData.meta ?? {}) as {
    wcEventRef?: string;
    hasBroadcast?: boolean;
    wcHasBroadcast?: boolean;
  };
  const cyberBroadcastRef = wcEvent?.id ?? cyberMeta.wcEventRef ?? "";
  const cyberHasBroadcast = Boolean(
    wcEvent?.hasBroadcast || cyberMeta.hasBroadcast || cyberMeta.wcHasBroadcast,
  );
  const showCyberBroadcast = isCyberRow && cyberHasBroadcast && Boolean(cyberBroadcastRef);
  
  return (
    <div className={styles.MatchRow}>
      <div className={styles.matchInfo}>
        <Button
          className={styles.matchInfoLink}
          elementType="link"
          href={`${gameLinkPrefix}${matchData.eventId}`}
        >
          {matchData.meta?.raw_start_at ? (
            <div className={styles.startAt}>{matchData.meta.raw_start_at}</div>
          ) : null}
          <div className={styles.matchSeparator}></div>
          <div className={styles.matchTeamsBlock}>
            <div className={styles.matchTeams}>
              <div className={styles.team}>
                <div className={styles.teamWithIcon}>
                  {matchData.team1Icon ? (
                    <span className={styles.teamIcon}>
                      <WcTeamImage
                        iconUrl={matchData.team1Icon}
                        size={18}
                        teamName={matchData.team1 ?? ""}
                      />
                    </span>
                  ) : null}
                  <div className={styles.teamName}>{matchData.team1}</div>
                </div>
                {score?.liveScore?.active === 1 && (
                  <div className={styles.teamBadge} />
                )}
              </div>
              <div className={styles.team}>
                <div className={styles.teamWithIcon}>
                  {matchData.team2Icon ? (
                    <span className={styles.teamIcon}>
                      <WcTeamImage
                        iconUrl={matchData.team2Icon}
                        size={18}
                        teamName={matchData.team2 ?? ""}
                      />
                    </span>
                  ) : null}
                  <div className={styles.teamName}>{matchData.team2}</div>
                </div>
                {score?.liveScore?.active === 2 && (
                  <div className={styles.teamBadge} />
                )}
                {/* Убираем отображение иконки статистики, так как stat_list содержит коэффициенты */}
              </div>
            </div>

            <div className={styles.matchStatisticsContainer}>
              <div className={styles.statusIcons}>
                {(matchData.priority ?? 0) > 0 && (
                  <div className={styles.statusIconsContainer}>
                    <FireIcon className={styles.priority} />
                  </div>
                )}
                {showPrematchBadge && (
                  <span className={styles.prematchBadge} title={t("common.lineFromPrematch")}>
                    {t("common.lineBadge")}
                  </span>
                )}
                {showCyberBroadcast && (
                  <button
                    className={styles.broadcastIconBtn}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      if (!cyberBroadcastRef) return;
                      router.push(`${gameLinkPrefix}${matchData.eventId}`);
                    }}
                    title={t("cyber.broadcast")}
                    type="button"
                  >
                    <BroadcastIcon className={styles.broadcastIcon} />
                  </button>
                )}
                {marketsCount > 1 && (
                <span className={styles.marketsCount}>{`+${marketsCount}`}</span>
                )}
              </div>
              <div className={styles.matchStatistics}>
                <p className={styles.matchStatisticsLine}>
                  <span className={styles.matchScoreTotal}>
                    {score?.text?.currentScore}
                  </span>
                  <span className={styles.tennisScores}>
                    <span className={styles.matchScorePeriods}>
                      {score?.text?.details ? `(${score.text.details})` : "-"}
                    </span>
                    {matchData.sport === "tennis" && (
                      <span
                        className={cn(
                          styles.matchScoreTotal,
                          styles.matchAdditionalDetails,
                        )}
                      >
                        {score?.text?.liveScore
                          ? `(${formatTennisGameScore(score.text.liveScore) ?? score.text.liveScore})`
                          : "-"}
                      </span>
                    )}
                  </span>
                </p>
                {score?.text?.time && matchData.sport !== "tennis" && (
                  <p className={styles.matchStatisticsLine}>
                    <span className={styles.time}>
                      <TimeIcon className={styles.timeIcon} />
                      <span
                        className={styles.timeText}
                        suppressHydrationWarning
                      >
                        {score.text.time}
                      </span>
                    </span>
                  </p>
                )}
              </div>
            </div>
          </div>
        </Button>
      </div>
    
      <div className={styles.cellsWrapper}>
        <div className={styles.cells}>
          {wcEvent ? (
            <>
              <WcHomeOddCell
                event={wcEvent}
                pick="HOME"
                value={formatWcCompactOdd(wcEvent.oddsHome, "--")}
              />
              {!isTwoWayWc && (
                <WcHomeOddCell
                  event={wcEvent}
                  pick="DRAW"
                  value={formatWcCompactOdd(wcEvent.oddsDraw, "--")}
                />
              )}
              <WcHomeOddCell
                event={wcEvent}
                pick="AWAY"
                value={formatWcCompactOdd(wcEvent.oddsAway, "--")}
              />
            </>
          ) : (
            <MatchFieldsRow
              eventId={matchData.eventId}
              eventName={matchData.eventName}
              fields={
                markets && fieldsForSport(matchData.sport)
                  ? fieldsForSport(matchData.sport)!.map((field) => ({
                      coef: markets[field]?.cf || "--",
                      groupedMarket: markets[field]?.groupedMarket || {
                        cf: 0,
                        isOpen: false,
                        market: field,
                      },
                      isOpen: markets[field]?.isOpen || false,
                      market: field,
                    }))
                  : []
              }
              sport={matchData.sport}
              isLive={isLive}
            />
          )}
        </div>
      </div>
    </div>
  );
};
