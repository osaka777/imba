"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import { getBets } from "~/entities/bet/api";
import { formatBetDisplayId } from "~/entities/bet/lib/formatBetDisplayId";
import { formatCouponMoney } from "~/entities/bet/lib/formatCouponMoney";
import { formatCouponPlacedAt, truncateLeagueName } from "~/entities/bet/lib/formatCouponBetMeta";
import { formatOpenBetHeaderDate, formatOpenBetKickoff } from "~/entities/bet/lib/formatOpenBetDates";
import {
  buildOpenBetEntries,
  filterOpenBetEntries,
  isFreshOpenBet,
  type OpenBetFilter,
} from "~/entities/bet/lib/openBetFilters";
import { getLegacyOpenBetScoreDisplay } from "~/entities/bet/lib/openBetScoreDisplay";
import { getMyWcBetsGrouped } from "~/entities/wc-odds/api/getMyWcBets";
import { WcExpressOpenBetCard } from "~/entities/wc-odds/ui/WcExpressOpenBetCard";
import { WcOpenBetCard } from "~/entities/wc-odds/ui/WcOpenBetCard";
import { useWcCashoutQuotes } from "~/entities/wc-odds/lib/useWcCashoutQuotes";
import { gamesList, getSportLabel } from "~/entities/game";
import { LoadingSpinner } from "~/shared/ui";
import type { MessageKey, TranslateParams } from "~/shared/i18n/messages";
import { useLocale } from "~/shared/model/useLocale";

import { createTitleForBet } from "../../lib";
import { OpenBetSlipCard, OpenBetSlipExpressLeg } from "./OpenBetSlipCard";
import styles from "./OpenTab.module.css";

const FILTER_IDS: OpenBetFilter[] = ["all", "live", "line", "today"];

type TranslateFn = (key: MessageKey, params?: TranslateParams) => string;

function filterLabel(id: OpenBetFilter, t: TranslateFn) {
  if (id === "all") return t("coupon.all");
  if (id === "live") return t("coupon.live");
  if (id === "line") return t("coupon.line");
  return t("coupon.today");
}

function eventWord(count: number, t: TranslateFn) {
  if (count === 1) return t("coupon.eventWord1");
  if (count < 5) return t("coupon.eventWord2");
  return t("coupon.eventWord5");
}

function getBetNameFromApiResponse(
  bet: Record<string, unknown>,
  t: TranslateFn,
  betIndex?: number,
): string {
  try {
    const raw = bet?.betApiResponse;
    if (!raw) return createTitleForBet(bet.betInfo as string, bet.betType as string, t);

    const apiResponse = typeof raw === "string" ? JSON.parse(raw) : raw;
    const list = apiResponse?.BetsContentDataList;
    if (Array.isArray(list)) {
      const dataIndex = betIndex ?? 0;
      const betData = list[dataIndex];
      if (betData?.BetName) return betData.BetName;
    }
    return createTitleForBet(bet.betInfo as string, bet.betType as string, t);
  } catch {
    return createTitleForBet(bet.betInfo as string, bet.betType as string, t);
  }
}

function getTeamsFromApiResponse(
  bet: Record<string, unknown>,
  t: TranslateFn,
  betIndex?: number,
): string {
  try {
    const raw = bet?.betApiResponse;
    if (raw) {
      const apiResponse = typeof raw === "string" ? JSON.parse(raw) : raw;
      const list = apiResponse?.BetsContentDataList;
      if (Array.isArray(list)) {
        const dataIndex = betIndex ?? 0;
        const betData = list[dataIndex];
        if (betData?.Teams) return betData.Teams;
      }
    }
    const game = bet.game as Record<string, unknown> | undefined;
    return (game?.eventName as string) || t("coupon.matchDefault");
  } catch {
    const game = bet.game as Record<string, unknown> | undefined;
    return (game?.eventName as string) || t("coupon.matchDefault");
  }
}

function isLegacyGameLive(game: Record<string, unknown> | undefined): boolean {
  if (!game) return false;
  const ps = game.parsedScore as { liveScore?: { active?: number } } | undefined;
  return Boolean(
    ps?.liveScore?.active
    || game.status === "LIVE"
    || game.status === "IN_PLAY"
    || game.live === true,
  );
}

function renderLegacyOrdiCard(bet: Record<string, unknown>, t: TranslateFn) {
  const game = bet.game as Record<string, unknown> | undefined;
  const isLive = isLegacyGameLive(game);
  const ticketId = formatBetDisplayId(Number(bet.id));
  const isFresh = isFreshOpenBet(String(bet.createdAt ?? ""));
  const amount = Number(bet.amount);
  const cf = Number(bet.cf).toFixed(2);
  const currencyCode = String(bet.currencyCode ?? "KZT");
  const href = `/game/${(bet.parentEventId as string) || bet.gameId}`;
  const sportMeta = game?.sport ? gamesList[game.sport as string] : undefined;
  const SportIcon = sportMeta?.Icon;
  const { main: scoreMain, detail: scoreDetail } = getLegacyOpenBetScoreDisplay(
    game as Parameters<typeof getLegacyOpenBetScoreDisplay>[0],
  );
  const bonusProgress = (bet as { bonusProgress?: { current: number; total: number } }).bonusProgress;
  const kickoffRaw = game?.commenceTime ?? game?.startTime;

  return (
    <OpenBetSlipCard
      coef={cf}
      dataKey={`r-${bet.id}`}
      footerRightLabel={bonusProgress ? t("coupon.bonusProgress") : t("coupon.potentialWinShort")}
      footerRightValue={
        bonusProgress
          ? `${bonusProgress.current}/${bonusProgress.total}`
          : formatCouponMoney(amount * Number(bet.cf), currencyCode)
      }
      footerRightWin={!bonusProgress}
      headerDate={formatOpenBetHeaderDate(String(bet.createdAt ?? ""))}
      highlight={isFresh}
      isLive={isLive}
      key={`r-${bet.id}`}
      kindLabel={t("coupon.ordinar")}
      kickoffLabel={
        !isLive && kickoffRaw
          ? formatOpenBetKickoff(String(kickoffRaw))
          : null
      }
      league={
        game?.leagueName ? truncateLeagueName(String(game.leagueName)) : null
      }
      matchHref={href}
      matchLinkText={t("coupon.goToEvent")}
      outcome={getBetNameFromApiResponse(bet, t)}
      placedAt={formatCouponPlacedAt(String(bet.createdAt ?? ""))}
      scoreDetail={scoreDetail}
      scoreMain={scoreMain}
      sportIcon={SportIcon}
      stakeLabel={formatCouponMoney(amount, currencyCode)}
      teamsLabel={getTeamsFromApiResponse(bet, t)}
      ticketId={ticketId}
      winLabel={formatCouponMoney(amount * Number(bet.cf), currencyCode)}
    />
  );
}

function renderExpressCard(bet: Record<string, unknown>, t: TranslateFn) {
  const legs = (bet.bets as Array<Record<string, unknown>>) ?? [];
  const ticketId = formatBetDisplayId(Number(bet.id));
  const isLive = legs.some((leg) => isLegacyGameLive(leg.game as Record<string, unknown> | undefined));
  const isFresh = isFreshOpenBet(String(bet.createdAt ?? ""));
  const amount = Number(bet.amount);
  const cf = Number(bet.cf).toFixed(2);
  const currencyCode = String(bet.currencyCode ?? "KZT");
  const bonusProgress = (bet as { bonusProgress?: { current: number; total: number } }).bonusProgress;

  return (
    <OpenBetSlipCard
      coef={cf}
      dataKey={`e-${bet.id}`}
      footerRightLabel={bonusProgress ? t("coupon.bonusProgress") : t("coupon.potentialWinShort")}
      footerRightValue={
        bonusProgress
          ? `${bonusProgress.current}/${bonusProgress.total}`
          : formatCouponMoney(amount * Number(bet.cf), currencyCode)
      }
      footerRightWin={!bonusProgress}
      headerDate={formatOpenBetHeaderDate(String(bet.createdAt ?? ""))}
      highlight={isFresh}
      isLive={isLive}
      key={`e-${bet.id}`}
      kindLabel={t("coupon.express")}
      matchHref="#"
      outcome={`${legs.length} ${eventWord(legs.length, t)}`}
      placedAt={formatCouponPlacedAt(String(bet.createdAt ?? ""))}
      stakeLabel={formatCouponMoney(amount, currencyCode)}
      teamsLabel=""
      ticketId={ticketId}
      winLabel={formatCouponMoney(amount * Number(bet.cf), currencyCode)}
    >
      <div className={styles.openBetExpressBlock}>
        {legs.map((leg, index) => {
          const game = leg.game as Record<string, unknown> | undefined;
          const href = `/game/${(leg.parentEventId as string) || leg.gameId}`;
          const { detail: scoreDetail } = getLegacyOpenBetScoreDisplay(
            game as Parameters<typeof getLegacyOpenBetScoreDisplay>[0],
          );
          const sportLabel = game?.sport
            ? getSportLabel(String(game.sport), t)
            : undefined;

          return (
            <OpenBetSlipExpressLeg
              coef={String(leg.cf)}
              key={String(leg.id ?? index)}
              matchHref={href}
              outcome={getBetNameFromApiResponse(bet, t, index)}
              scoreDetail={scoreDetail}
              sportLabel={sportLabel}
              teamsLabel={getTeamsFromApiResponse(bet, t, index)}
            />
          );
        })}
      </div>
    </OpenBetSlipCard>
  );
}

export const OpenTab = ({ isActive = true }: { isActive?: boolean }) => {
  const { t } = useLocale();
  const [filter, setFilter] = useState<OpenBetFilter>("all");
  const listRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryFn: () => getBets(),
    queryKey: ["bets", "open"],
    staleTime: 4_000,
  });

  const { data: wcGrouped = { ordinar: [], express: [] }, isLoading: wcLoading } = useQuery({
    queryFn: () => getMyWcBetsGrouped("PENDING"),
    queryKey: ["wc-bets", "pending"],
    staleTime: 4_000,
  });

  const wcBets = wcGrouped.ordinar;
  const wcExpressBets = wcGrouped.express;

  const pendingWcBetIds = useMemo(
    () => wcBets.map((bet) => bet.id),
    [wcBets],
  );
  const { data: cashoutQuotes = {}, isLoading: cashoutLoading } = useWcCashoutQuotes(
    pendingWcBetIds,
    isActive && pendingWcBetIds.length > 0,
  );

  const filteredData = data
    ? {
        ordinar: data.ordinar?.filter((bet) => bet.status === "PENDING") ?? [],
        express: data.express?.filter((bet) => bet.status === "PENDING") ?? [],
      }
    : { ordinar: [], express: [] };

  const allEntries = useMemo(
    () =>
      buildOpenBetEntries(
        wcBets,
        wcExpressBets,
        filteredData.ordinar as unknown as Array<Record<string, unknown>>,
        filteredData.express as unknown as Array<Record<string, unknown>>,
      ),
    [wcBets, wcExpressBets, filteredData.ordinar, filteredData.express],
  );

  const visibleEntries = useMemo(
    () => filterOpenBetEntries(allEntries, filter),
    [allEntries, filter],
  );

  const filterCounts = useMemo(
    () => ({
      all: allEntries.length,
      live: allEntries.filter((e) => e.isLive).length,
      line: allEntries.filter((e) => e.isLine).length,
      today: allEntries.filter((e) => e.isToday).length,
    }),
    [allEntries],
  );

  useEffect(() => {
    const fresh = allEntries.find((entry) => isFreshOpenBet(entry.createdAt));
    if (!fresh) return;
    const node = listRef.current?.querySelector(`[data-open-bet-key="${fresh.key}"]`);
    node?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [allEntries.length, wcBets.length, wcExpressBets.length]);

  return (
    <div className={styles.openTab} data-open-bets-panel ref={listRef}>
      <div className={styles.filterBar}>
        {FILTER_IDS.map((id) => (
          <button
            className={`${styles.filterChip} ${filter === id ? styles.filterChipActive : ""}`}
            key={id}
            onClick={() => setFilter(id)}
            type="button"
          >
            {filterLabel(id, t)}
            {filterCounts[id] > 0 ? ` · ${filterCounts[id]}` : ""}
          </button>
        ))}
      </div>

      {(isLoading || wcLoading) && <LoadingSpinner />}

      {visibleEntries.map((entry) => {
        if (entry.kind === "wc-express" && entry.wcExpressBet) {
          return (
            <WcExpressOpenBetCard
              bet={entry.wcExpressBet}
              highlight={isFreshOpenBet(entry.createdAt)}
              key={entry.key}
            />
          );
        }
        if (entry.kind === "wc" && entry.wcBet) {
          return (
            <WcOpenBetCard
              bet={entry.wcBet}
              cashoutQuote={cashoutQuotes[entry.wcBet.id]}
              highlight={isFreshOpenBet(entry.createdAt)}
              key={entry.key}
              quotesLoading={cashoutLoading}
            />
          );
        }
        if (entry.kind === "ordinar" && entry.ordinarBet) {
          return renderLegacyOrdiCard(entry.ordinarBet, t);
        }
        if (entry.kind === "express" && entry.expressBet) {
          return renderExpressCard(entry.expressBet, t);
        }
        return null;
      })}

      {visibleEntries.length === 0 && !isLoading && !wcLoading && (
        <div className={styles.notFound}>
          {filter === "all"
            ? t("coupon.emptyOpenBets")
            : (
              <>
                {t("coupon.emptyFilter", { filter: filterLabel(filter, t) })}
                {allEntries.length > 0 ? (
                  <button
                    className={styles.filterResetBtn}
                    onClick={() => setFilter("all")}
                    type="button"
                  >
                    {t("coupon.showAll")}
                  </button>
                ) : null}
              </>
            )}
        </div>
      )}
    </div>
  );
};
