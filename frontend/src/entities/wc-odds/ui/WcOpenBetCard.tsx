"use client";

import type { WcBet } from "~/entities/wc-odds/api/client";
import { buildWcGameHref } from "~/entities/wc-odds/lib/wcSlug";
import { getWcBetLabel } from "~/entities/wc-odds/lib/wcRate";
import { gamesList } from "~/entities/game";
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
import {
  isFreshOpenBet,
  isWcBetLive,
} from "~/entities/bet/lib/openBetFilters";
import { getWcOpenBetScoreDisplay } from "~/entities/bet/lib/openBetScoreDisplay";

import { OpenBetSlipCard } from "~/entities/bet/ui/Coupon/OpenBetSlipCard";
import { WcCashoutButton } from "~/entities/wc-odds/ui/WcCashoutButton";
import { WcBetShareButton } from "~/entities/wc-odds/ui/WcBetShareButton";

type WcOpenBetCardProps = {
  bet: WcBet;
  highlight?: boolean;
};

export function WcOpenBetCard({ bet, highlight }: WcOpenBetCardProps) {
  const cf = Number(bet.odds).toFixed(2);
  const placedAt = formatCouponPlacedAt(bet.createdAt);
  const headerDate = formatOpenBetHeaderDate(bet.createdAt);
  const sportMeta = bet.event.sport ? gamesList[bet.event.sport] : undefined;
  const SportIcon = sportMeta?.Icon;
  const isLive = isWcBetLive(bet);
  const isFresh = highlight ?? isFreshOpenBet(bet.createdAt);
  const { main: scoreMain, detail: scoreDetail } = getWcOpenBetScoreDisplay(bet);
  const ticketId = formatBetDisplayId(bet.id);
  const teamsLabel = `${bet.event.homeTeam} — ${bet.event.awayTeam}`;

  const href = bet.event.slug
    ? buildWcGameHref({
        slug: bet.event.slug,
        id: bet.event.id || "",
        homeTeam: bet.event.homeTeam,
        awayTeam: bet.event.awayTeam,
      })
    : "/line/soccer";

  const kickoffLabel = !isLive && bet.event.commenceTime
    ? formatOpenBetKickoff(bet.event.commenceTime)
    : null;

  return (
    <OpenBetSlipCard
      coef={cf}
      dataKey={`wc-${bet.id}`}
      headerDate={headerDate}
      highlight={isFresh}
      isLive={isLive}
      kindLabel="Ординар"
      kickoffLabel={kickoffLabel}
      league={bet.event.leagueName ? truncateLeagueName(bet.event.leagueName) : null}
      matchHref={href}
      outcome={getWcBetLabel(bet)}
      placedAt={placedAt}
      scoreDetail={scoreDetail}
      scoreMain={scoreMain}
      sportIcon={SportIcon}
      stakeLabel={formatCouponMoney(bet.stake, bet.currencyCode)}
      teamsLabel={teamsLabel}
      ticketId={ticketId}
      winLabel={formatCouponMoney(bet.potentialPayout, bet.currencyCode)}
    >
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <WcCashoutButton bet={bet} />
        <WcBetShareButton betId={bet.id} />
      </div>
    </OpenBetSlipCard>
  );
}
