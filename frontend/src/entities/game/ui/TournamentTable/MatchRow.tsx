"use client";

import { components } from "~/shared/api";
import { formatTennisGameScore } from "~/entities/wc-odds/lib/wcLiveScore";
import { FireIcon, TimeIcon } from "~/shared/assets";
import { cn } from "~/shared/lib";
import { Button } from "~/shared/ui";
import { Game } from "~/entities/game/types";
import {  SubGameDto } from "../SubGames";

import { MatchFieldsRow } from "./MatchFieldsRow";
import styles from "./MatchRow.module.css";
import { useMatchRow } from "./useMatchRow";
import { useState } from "react";

const matchFields: Record<string, string[]> = {
  basketball: ["WIN_OT__P1", "WIN_RT__PX", "WIN_OT__P2"],
  "esports.cs": ["WIN__P1", "WIN__P2"],
  "esports.dota2": ["WIN__P1", "WIN__P2"],
  "esports.valorant": ["WIN__P1", "WIN__P2"],
  hockey: ["WIN_RT__P1", "WIN_RT__PX", "WIN_RT__P2"],
  soccer: ["WIN__P1", "WIN__PX", "WIN__P2", "WIN__1X", "WIN__12", "WIN__X2"],
  "table-tennis": ["WIN__P1", "WIN__P2"],
  tennis: ["WIN__P1", "WIN__P2"],
  volleyball: ["WIN__P1", "WIN__P2"],
};


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
    sport: keyof typeof matchFields;
    status?: string;
    sub_games?: SubGameDto[];
  };
};

export const MatchRow: React.FC<MatchRowProps> = ({
  isLive,
  gameLinkPrefix = "/game/",
  matchData,
}) => {
  const { markets, marketsCount, score } = useMatchRow(matchData) as {
    markets: any;
    marketsCount: number;
    score: any;
  };
  
  
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
                <div className={styles.teamName}>{matchData.team1}</div>
                {score?.liveScore?.active === 1 && (
                  <div className={styles.teamBadge} />
                )}
              </div>
              <div className={styles.team}>
                <div className={styles.teamName}>{matchData.team2}</div>
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
                {marketsCount > 1 && (
                <span className={styles.marketsCount}>{`+${marketsCount}`}</span>
                )}
              </div>
              <div className={styles.matchStatistics}>
                <p className={styles.matchStatisticsLine}>
                  <span className={styles.matchScoreTotal}>
                    {score?.text.currentScore}
                  </span>
                  <span className={styles.tennisScores}>
                    <span className={styles.matchScorePeriods}>
                      {score?.text.details ? `(${score?.text.details})` : "-"}
                    </span>
                    {matchData.sport === "tennis" && (
                      <span
                        className={cn(
                          styles.matchScoreTotal,
                          styles.matchAdditionalDetails,
                        )}
                      >
                        {score?.text.liveScore
                          ? `(${formatTennisGameScore(score.text.liveScore) ?? score.text.liveScore})`
                          : "-"}
                      </span>
                    )}
                  </span>
                </p>
                {score?.text.time && matchData.sport !== "tennis" && (
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

          <MatchFieldsRow
            eventId={matchData.eventId}
            eventName={matchData.eventName}
            fields={
              markets && matchFields[matchData.sport]
                ? matchFields[matchData.sport].map((field) => ({
                    coef: markets[field]?.cf || "--",
                    groupedMarket: markets[field]?.groupedMarket || {
                      cf: 0,
                      isOpen: false,
                      market: field
                    },
                    isOpen: markets[field]?.isOpen || false,
                    market: field,
                  }))
                : []
            }
            sport={matchData.sport}
            isLive={isLive}
          />
        </div>
      </div>
    </div>
  );
};
