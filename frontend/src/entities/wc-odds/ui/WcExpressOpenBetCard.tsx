"use client";

import type { WcExpressBet } from "~/entities/wc-odds/api/client";
import { buildWcGameHref } from "~/entities/wc-odds/lib/wcSlug";
import { getWcBetLabel } from "~/entities/wc-odds/lib/wcRate";
import { gamesList } from "~/entities/game";
import { formatBetDisplayId } from "~/entities/bet/lib/formatBetDisplayId";
import { formatCouponMoney } from "~/entities/bet/lib/formatCouponMoney";
import { formatCouponPlacedAt } from "~/entities/bet/lib/formatCouponBetMeta";
import { formatOpenBetHeaderDate } from "~/entities/bet/lib/formatOpenBetDates";
import {
  isFreshOpenBet,
  isWcBetLive,
} from "~/entities/bet/lib/openBetFilters";
import { getWcOpenBetScoreDisplay } from "~/entities/bet/lib/openBetScoreDisplay";

import {
  OpenBetSlipCard,
  OpenBetSlipExpressLeg,
} from "~/entities/bet/ui/Coupon/OpenBetSlipCard";
import styles from "~/entities/bet/ui/Coupon/OpenTab.module.css";
import { useLocale } from "~/shared/model/useLocale";

type WcExpressOpenBetCardProps = {
  bet: WcExpressBet;
  highlight?: boolean;
};

export function WcExpressOpenBetCard({ bet, highlight }: WcExpressOpenBetCardProps) {
  const { t } = useLocale();
  const cf = Number(bet.combinedOdds).toFixed(2);
  const placedAt = formatCouponPlacedAt(bet.createdAt);
  const headerDate = formatOpenBetHeaderDate(bet.createdAt);
  const isLive = bet.legs.some((leg) => isWcBetLive(leg));
  const isFresh = highlight ?? isFreshOpenBet(bet.createdAt);
  const ticketId = formatBetDisplayId(bet.id);
  const legCount = bet.legs.length;
  const eventWord =
    legCount === 1
      ? t("wc.eventWord1")
      : legCount < 5
        ? t("wc.eventWord2")
        : t("wc.eventWord5");
  const legLabel = `${legCount} ${eventWord}`;

  return (
    <OpenBetSlipCard
      coef={cf}
      dataKey={`wc-e-${bet.id}`}
      headerDate={headerDate}
      highlight={isFresh}
      isLive={isLive}
      kindLabel={t("coupon.express")}
      matchHref="#"
      outcome={legLabel}
      placedAt={placedAt}
      stakeLabel={formatCouponMoney(bet.stake, bet.currencyCode)}
      teamsLabel=""
      ticketId={ticketId}
      winLabel={formatCouponMoney(bet.potentialPayout, bet.currencyCode)}
    >
      <div className={styles.openBetExpressBlock}>
        {bet.legs.map((leg) => {
          const href = leg.event.slug
            ? buildWcGameHref({
                slug: leg.event.slug,
                id: leg.event.id || "",
                homeTeam: leg.event.homeTeam,
                awayTeam: leg.event.awayTeam,
              })
            : "/line/soccer";
          const { detail: scoreDetail } = getWcOpenBetScoreDisplay(leg);
          const sportMeta = leg.event.sport ? gamesList[leg.event.sport] : undefined;

          return (
            <OpenBetSlipExpressLeg
              coef={Number(leg.odds).toFixed(2)}
              key={leg.id}
              matchHref={href}
              outcome={getWcBetLabel({ ...leg, sport: leg.event.sport })}
              scoreDetail={scoreDetail}
              sportLabel={sportMeta?.label ?? leg.event.sport}
              teamsLabel={`${leg.event.homeTeam} — ${leg.event.awayTeam}`}
            />
          );
        })}
      </div>
    </OpenBetSlipCard>
  );
}
