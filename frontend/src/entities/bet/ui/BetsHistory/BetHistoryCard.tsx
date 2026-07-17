"use client";

import { useRouter } from "next/navigation";

import {
  getBetGameStatus,
  getBetNameFromApiResponse,
  getHistoryFooter,
  getHistoryRibbon,
  getTeamsFromApiResponse,
  isLegacyGameLive,
  type BetHistoryStatus,
} from "~/entities/bet/lib/betHistoryDisplay";
import { formatBetDisplayId } from "~/entities/bet/lib/formatBetDisplayId";
import { formatCouponMoney } from "~/entities/bet/lib/formatCouponMoney";
import {
  formatCouponPlacedAt,
  truncateLeagueName,
} from "~/entities/bet/lib/formatCouponBetMeta";
import {
  formatOpenBetHeaderDate,
  formatOpenBetKickoff,
} from "~/entities/bet/lib/formatOpenBetDates";
import { getLegacyOpenBetScoreDisplay } from "~/entities/bet/lib/openBetScoreDisplay";
import type { WcHistoryExpressBet } from "~/entities/wc-odds/lib/mapWcExpressForHistory";
import type { WcHistoryOrdinarBet } from "~/entities/wc-odds/lib/mapWcBetsForHistory";
import { gamesList } from "~/entities/game";
import { components } from "~/shared/api";
import type { MessageKey } from "~/shared/i18n/messages";
import { useLocale } from "~/shared/model/useLocale";

import {
  OpenBetSlipCard,
  OpenBetSlipExpressLeg,
} from "../Coupon/OpenBetSlipCard";
import openStyles from "../Coupon/OpenTab.module.css";
import styles from "./BetsHistoryPage.module.css";

function pluralEvents(count: number, t: (key: MessageKey) => string): string {
  if (count === 1) return t("coupon.eventWord1");
  if (count < 5) return t("coupon.eventWord2");
  return t("coupon.eventWord5");
}

type BetDto = components["schemas"]["BetDto"];
type ExpressBetDto = components["schemas"]["ExpressBetDto"];
type AnyHistoryBet = BetDto | ExpressBetDto | WcHistoryOrdinarBet;

function getBetStatus(bet: AnyHistoryBet): BetHistoryStatus {
  const status = bet.status as BetHistoryStatus;
  if (
    status === "WIN"
    || status === "LOSE"
    || status === "RETURN"
    || status === "PENDING"
    || status === "CASHOUT"
  ) {
    return status;
  }
  return "PENDING";
}

function OrdinarBetHistoryCard({ bet }: { bet: BetDto | WcHistoryOrdinarBet }) {
  const { t } = useLocale();
  const router = useRouter();
  const status = getBetStatus(bet);
  const gameStatus = getBetGameStatus(bet as Record<string, unknown>);
  const amount = Number(bet.amount);
  const cf = Number(bet.cf);
  const currencyCode = String(bet.currencyCode ?? "KZT");
  const payoutOverride =
    (bet as WcHistoryOrdinarBet).isWcBet && (bet as WcHistoryOrdinarBet).status === "CASHOUT"
      ? Number((bet as WcHistoryOrdinarBet).payout)
      : undefined;
  const footer = getHistoryFooter(status, amount, cf, currencyCode, payoutOverride);
  const ribbon = getHistoryRibbon(status, gameStatus);
  const ticketId = formatBetDisplayId(
    (bet as WcHistoryOrdinarBet).isWcBet
      ? (bet as WcHistoryOrdinarBet).wcBetId
      : Number(bet.id),
  );

  if ((bet as WcHistoryOrdinarBet).isWcBet) {
    const wcBet = bet as WcHistoryOrdinarBet;
    const href = wcBet.wcGameHref || "/line/soccer";
    const sportMeta = wcBet.sport ? gamesList[wcBet.sport] : undefined;
    const SportIcon = sportMeta?.Icon;

    return (
      <div
        className={styles.historyCardWrap}
        onClick={() => router.push(href)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") router.push(href);
        }}
        role="link"
        tabIndex={0}
      >
        <OpenBetSlipCard
          coef={wcBet.cf}
          dataKey={`wh-wc-${wcBet.wcBetId}`}
          footerRightDanger={footer.footerRightDanger}
          footerRightLabel={footer.footerRightLabel}
          footerRightValue={footer.footerRightValue}
          footerRightWin={footer.footerRightWin}
          headerDate={formatOpenBetHeaderDate(wcBet.createdAt)}
          isLive={gameStatus.isLive}
          kindLabel={t("coupon.ordinar")}
          league={
            wcBet.leagueName ? truncateLeagueName(wcBet.leagueName) : null
          }
          matchHref={href}
          outcome={wcBet.betInfo}
          placedAt={formatCouponPlacedAt(wcBet.createdAt)}
          ribbon={ribbon}
          scoreMain={wcBet.score ?? null}
          sportIcon={SportIcon}
          stakeLabel={formatCouponMoney(amount, currencyCode)}
          teamsLabel={wcBet.eventName}
          ticketId={ticketId}
          winLabel={footer.footerRightValue}
        />
      </div>
    );
  }

  const legacyBet = bet as BetDto;
  const game = legacyBet.game as Record<string, unknown> | undefined;
  const isLive = isLegacyGameLive(game);
  const href = `/game/${legacyBet.parentEventId || legacyBet.gameId}`;
  const sportMeta = game?.sport ? gamesList[game.sport as string] : undefined;
  const SportIcon = sportMeta?.Icon;
  const { main: scoreMain, detail: scoreDetail } = getLegacyOpenBetScoreDisplay(
    game as Parameters<typeof getLegacyOpenBetScoreDisplay>[0],
  );
  const kickoffRaw = game?.commenceTime ?? game?.startTime;

  return (
    <div
      className={styles.historyCardWrap}
      onClick={() => router.push(href)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") router.push(href);
      }}
      role="link"
      tabIndex={0}
    >
      <OpenBetSlipCard
        coef={cf.toFixed(2)}
        dataKey={`wh-${legacyBet.id}`}
        footerRightDanger={footer.footerRightDanger}
        footerRightLabel={footer.footerRightLabel}
        footerRightValue={footer.footerRightValue}
        footerRightWin={footer.footerRightWin}
        headerDate={formatOpenBetHeaderDate(String(legacyBet.createdAt ?? ""))}
        isLive={isLive}
        kickoffLabel={
          !isLive && kickoffRaw
            ? formatOpenBetKickoff(String(kickoffRaw))
            : null
        }
        kindLabel={t("coupon.ordinar")}
        league={
          game?.leagueName ? truncateLeagueName(String(game.leagueName)) : null
        }
        matchHref={href}
        outcome={getBetNameFromApiResponse(legacyBet as Record<string, unknown>)}
        placedAt={formatCouponPlacedAt(String(legacyBet.createdAt ?? ""))}
        ribbon={ribbon}
        scoreDetail={scoreDetail}
        scoreMain={scoreMain}
        sportIcon={SportIcon}
        stakeLabel={formatCouponMoney(amount, currencyCode)}
        teamsLabel={getTeamsFromApiResponse(legacyBet as Record<string, unknown>)}
        ticketId={ticketId}
        winLabel={footer.footerRightValue}
      />
    </div>
  );
}

function WcExpressBetHistoryCard({ bet }: { bet: WcHistoryExpressBet }) {
  const { t } = useLocale();
  const router = useRouter();
  const legs = bet.bets;
  const status = bet.status as BetHistoryStatus;
  const gameStatus = getBetGameStatus(bet as unknown as Record<string, unknown>);
  const amount = Number(bet.amount);
  const cf = Number(bet.cf);
  const currencyCode = bet.currencyCode;
  const footer = getHistoryFooter(status, amount, cf, currencyCode);
  const ribbon = getHistoryRibbon(status, gameStatus);
  const ticketId = formatBetDisplayId(bet.wcExpressId);
  const isLive = gameStatus.isLive;
  const firstHref = legs[0]?.wcGameHref ?? "#";

  return (
    <div
      className={styles.historyCardWrap}
      onClick={() => {
        if (firstHref !== "#") router.push(firstHref);
      }}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && firstHref !== "#") {
          router.push(firstHref);
        }
      }}
      role="link"
      tabIndex={0}
    >
      <OpenBetSlipCard
        coef={cf.toFixed(2)}
        dataKey={`wh-wce-${bet.wcExpressId}`}
        footerRightDanger={footer.footerRightDanger}
        footerRightLabel={footer.footerRightLabel}
        footerRightValue={footer.footerRightValue}
        footerRightWin={footer.footerRightWin}
        headerDate={formatOpenBetHeaderDate(bet.createdAt)}
        isLive={isLive}
        kindLabel={t("coupon.express")}
        matchHref={firstHref}
        outcome={`${legs.length} ${pluralEvents(legs.length, t)}`}
        placedAt={formatCouponPlacedAt(bet.createdAt)}
        ribbon={ribbon}
        stakeLabel={formatCouponMoney(amount, currencyCode)}
        teamsLabel=""
        ticketId={ticketId}
        winLabel={footer.footerRightValue}
      >
        <div className={openStyles.openBetExpressBlock}>
          {legs.map((leg) => {
            const href = leg.wcGameHref ?? "#";
            const sportLabel =
              leg.sport && gamesList[leg.sport]
                ? gamesList[leg.sport].label
                : leg.sport;

            return (
              <div
                key={leg.id}
                onClick={(e) => {
                  e.stopPropagation();
                  if (href !== "#") router.push(href);
                }}
                role="presentation"
              >
                <OpenBetSlipExpressLeg
                  coef={leg.cf}
                  matchHref={href}
                  outcome={leg.betInfo}
                  scoreDetail={leg.score}
                  sportLabel={sportLabel}
                  teamsLabel={leg.eventName}
                />
              </div>
            );
          })}
        </div>
      </OpenBetSlipCard>
    </div>
  );
}

function ExpressBetHistoryCard({ bet }: { bet: ExpressBetDto }) {
  const { t } = useLocale();
  const router = useRouter();
  const legs = bet.bets ?? [];
  const status = getBetStatus(bet);
  const gameStatus = getBetGameStatus(bet as Record<string, unknown>);
  const amount = Number(bet.amount);
  const cf = Number(bet.cf);
  const currencyCode = String(bet.currencyCode ?? "KZT");
  const footer = getHistoryFooter(status, amount, cf, currencyCode);
  const ribbon = getHistoryRibbon(status, gameStatus);
  const ticketId = formatBetDisplayId(Number(bet.id));
  const isLive = legs.some((leg) =>
    isLegacyGameLive(leg.game as Record<string, unknown> | undefined),
  );

  const firstHref =
    legs.length > 0
      ? `/game/${legs[0].parentEventId || legs[0].gameId}`
      : "#";

  return (
    <div
      className={styles.historyCardWrap}
      onClick={() => {
        if (firstHref !== "#") router.push(firstHref);
      }}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && firstHref !== "#") {
          router.push(firstHref);
        }
      }}
      role="link"
      tabIndex={0}
    >
      <OpenBetSlipCard
        coef={cf.toFixed(2)}
        dataKey={`wh-e-${bet.id}`}
        footerRightDanger={footer.footerRightDanger}
        footerRightLabel={footer.footerRightLabel}
        footerRightValue={footer.footerRightValue}
        footerRightWin={footer.footerRightWin}
        headerDate={formatOpenBetHeaderDate(String(bet.createdAt ?? ""))}
        isLive={isLive}
        kindLabel={t("coupon.express")}
        matchHref={firstHref}
        outcome={`${legs.length} ${pluralEvents(legs.length, t)}`}
        placedAt={formatCouponPlacedAt(String(bet.createdAt ?? ""))}
        ribbon={ribbon}
        stakeLabel={formatCouponMoney(amount, currencyCode)}
        teamsLabel=""
        ticketId={ticketId}
        winLabel={footer.footerRightValue}
      >
        <div className={openStyles.openBetExpressBlock}>
          {legs.map((leg, index) => {
            const game = leg.game as Record<string, unknown> | undefined;
            const href = `/game/${leg.parentEventId || leg.gameId}`;
            const { detail: scoreDetail } = getLegacyOpenBetScoreDisplay(
              game as Parameters<typeof getLegacyOpenBetScoreDisplay>[0],
            );
            const sportLabel =
              game?.sport && gamesList[game.sport as string]
                ? gamesList[game.sport as string].label
                : (game?.sport as string);

            return (
              <div
                key={String(leg.id ?? index)}
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(href);
                }}
                role="presentation"
              >
                <OpenBetSlipExpressLeg
                  coef={String(leg.cf)}
                  matchHref={href}
                  outcome={getBetNameFromApiResponse(
                    leg as Record<string, unknown>,
                  )}
                  scoreDetail={scoreDetail}
                  sportLabel={sportLabel}
                  teamsLabel={getTeamsFromApiResponse(
                    leg as Record<string, unknown>,
                  )}
                />
              </div>
            );
          })}
        </div>
      </OpenBetSlipCard>
    </div>
  );
}

export function BetHistoryCard({ bet }: { bet: AnyHistoryBet }) {
  if ((bet as WcHistoryExpressBet).isWcExpress) {
    return <WcExpressBetHistoryCard bet={bet as WcHistoryExpressBet} />;
  }
  if ((bet as WcHistoryOrdinarBet).isWcBet) {
    return <OrdinarBetHistoryCard bet={bet as WcHistoryOrdinarBet} />;
  }
  if ("bets" in bet && Array.isArray((bet as ExpressBetDto).bets)) {
    return <ExpressBetHistoryCard bet={bet as ExpressBetDto} />;
  }
  return <OrdinarBetHistoryCard bet={bet as BetDto} />;
}
