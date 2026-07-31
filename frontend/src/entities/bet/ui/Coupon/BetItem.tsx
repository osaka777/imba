"use client";

import getSymbolFromCurrency from "currency-symbol-map";
import Link from "next/link";

import { convertToFixed } from "~/entities/game/lib";
import { gamesList } from "~/entities/game";
import { AccessIcon, CloseIcon } from "~/shared/assets";
import { Button } from "~/shared/ui";
import { cn } from "~/shared/lib";
import { useFlashOnChange } from "~/shared/lib/useFlashOnChange";
import { useLocale } from "~/shared/model/useLocale";

import { createTitleForBet } from "../../lib";
import {
  formatCouponWinLine,
  getCouponMatchHref,
  getCouponMatchTimeLine,
  getCouponPhaseBadge,
  getCouponTeamsLine,
  truncateLeagueName,
} from "../../lib/formatCouponBetMeta";
import type { Rate } from "../../types";
import openStyles from "./OpenTab.module.css";
import styles from "./BetTab.module.css";

const ORDINAR_BRAND_LOGO = "/imbalogo.png";

type BetItemProps = {
  deleteButtonOnClickHandler: (item: Rate) => void;
  rate: Rate;
  variant: "express" | "ordinar" | "series";
  stakeAmount?: number;
  currencyCode?: string;
};

export const BetItem: React.FC<BetItemProps> = ({
  deleteButtonOnClickHandler,
  rate,
  variant,
  stakeAmount = 0,
  currencyCode,
}) => {
  const { t } = useLocale();
  const coefNotANumber = rate.coef === `--`;
  const locked = !rate.isOpen || coefNotANumber;
  const outcomeTitle =
    rate.title
    || (rate.groupedMarket ? createTitleForBet(rate.groupedMarket, rate.market, t) : null)
    || rate.market
    || t("coupon.betLabel");

  const sportMeta = rate.sport ? gamesList[rate.sport] : undefined;
  const SportIcon = sportMeta?.Icon;
  const phaseBadge = getCouponPhaseBadge(rate);
  const matchTimeLine = getCouponMatchTimeLine(rate);
  const teamsLine = getCouponTeamsLine(rate);
  const currencySymbol = currencyCode ? getSymbolFromCurrency(currencyCode) || currencyCode : "";
  const coefNum = Number(rate.coef);
  const coefStr = convertToFixed(rate.coef);
  const coefFlash = useFlashOnChange(coefStr);
  const scoreMain =
    rate.homeScore != null && rate.awayScore != null
      ? `${rate.homeScore}:${rate.awayScore}`
      : null;
  const scoreFlash = useFlashOnChange(scoreMain);
  const matchHref = getCouponMatchHref(rate);
  const isLive = phaseBadge.tone === "live";
  const winLine =
    variant === "ordinar" && stakeAmount > 0
      ? formatCouponWinLine(stakeAmount, coefNum, currencySymbol)
      : null;

  return (
    <div
      className={cn(
        openStyles.openBetCard,
        styles.couponBetCard,
        locked && styles.couponBetCardLocked,
      )}
      key={(rate.eventId || "") + (rate.market || "")}
    >
      {locked ? <AccessIcon className={styles.couponBetLock} /> : null}

      <div className={openStyles.openBetHeaderBar}>
        <div className={openStyles.openBetHeaderLeft}>
          {phaseBadge.label ? (
            <span
              className={cn(
                openStyles.openBetHeaderPhase,
                isLive && openStyles.openBetHeaderPhase_live,
              )}
            >
              {phaseBadge.label}
            </span>
          ) : null}
          {matchTimeLine ? (
            <span className={openStyles.openBetHeaderScore}>{matchTimeLine}</span>
          ) : null}
          {!phaseBadge.label && !matchTimeLine ? (
            <span className={openStyles.openBetHeaderDate}>{t("coupon.couponLabel")}</span>
          ) : null}
        </div>
        <div className={openStyles.openBetHeaderCenter}>
          {variant === "ordinar" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt="Imba.bet"
              className={openStyles.openBetHeaderBrandLogo}
              height={18}
              src={ORDINAR_BRAND_LOGO}
              width={72}
            />
          ) : (
            <span className={openStyles.openBetHeaderBrand}>{t("coupon.express")}</span>
          )}
        </div>
        <Button
          aria-label={t("coupon.removeFromSlip")}
          className={styles.couponBetCloseBtn}
          onClick={() => deleteButtonOnClickHandler(rate)}
          type="button"
        >
          <CloseIcon className={styles.couponBetCloseIcon} />
        </Button>
      </div>

      <div className={openStyles.openBetSlip}>
        {isLive ? (
          <span className={openStyles.openBetLiveRibbon}>
            <span className={openStyles.openBetLiveDot} aria-hidden />
            Live
          </span>
        ) : (
          <span className={openStyles.openBetLineRibbon}>{t("coupon.lineLabel")}</span>
        )}

        <div className={openStyles.openBetPickRow}>
          <div
            className={cn(
              openStyles.openBetCoefPill,
              coefFlash === "up" && openStyles.openBetCoefPillUp,
              coefFlash === "down" && openStyles.openBetCoefPillDown,
            )}
          >
            {coefStr}
          </div>
          <p className={openStyles.openBetOutcome}>{outcomeTitle}</p>
        </div>

        {teamsLine ? (
          <>
            <Link className={openStyles.openBetMatchRowLink} href={matchHref}>
              <div className={openStyles.openBetMatchRow}>
                <div className={openStyles.openBetMatchTeams}>
                  {SportIcon ? <SportIcon className={openStyles.openBetSportIcon} /> : null}
                  <span className={openStyles.openBetTeamsText}>{teamsLine}</span>
                </div>
                {scoreMain ? (
                  <span
                    className={cn(
                      openStyles.openBetScoreMain,
                      scoreFlash && openStyles.openBetScoreFlash,
                    )}
                  >
                    {scoreMain}
                  </span>
                ) : null}
              </div>
            </Link>

            {rate.leagueName ? (
              <div className={openStyles.openBetMetaRow}>
                <span className={openStyles.openBetLeague}>
                  {truncateLeagueName(rate.leagueName)}
                </span>
              </div>
            ) : null}
          </>
        ) : null}

        {winLine ? <p className={styles.couponWinLineHero}>{winLine}</p> : null}
        {variant === "express" && ratesExpressHint(coefNum)}
      </div>
    </div>
  );
};

function ratesExpressHint(coef: number) {
  if (!Number.isFinite(coef) || coef <= 0) return null;
  return (
    <p className={styles.couponExpressHint}>
      {t("coupon.expressInCoupon", { coef: coef.toFixed(2) })}
    </p>
  );
}
