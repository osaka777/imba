import getSymbolFromCurrency from "currency-symbol-map";
import dayjs from "dayjs";
import { useState } from "react";

import { createTitleForBet } from "~/entities/bet/lib";
import { gamesList, getSportLabel } from "~/entities/game";
import { components } from "~/shared/api";
import { toIntlLocale } from "~/shared/i18n/format";
import { useLocale } from "~/shared/model/useLocale";

import styles from "./BetsHistoryItem.module.css";

type BetDto = components["schemas"]["BetDto"];
type ExpressBetDto = components["schemas"]["ExpressBetDto"];

export const useBetHistoryItem = (
  bet: BetDto | ExpressBetDto,
) => {
  const { t, locale } = useLocale();
  const date = dayjs(bet.createdAt).format("DD.MM.YY / HH:mm");

  let statusClassName = ``;
  let statusText = ``;
  switch (bet.status) {
    case "WIN": {
      statusClassName = styles.indicator_win;
      statusText = t("coupon.statusVictory");
      break;
    }
    case "LOSE": {
      statusClassName = styles.indicator_lose;
      statusText = t("coupon.historyLose");
      break;
    }
    case "PENDING": {
      statusClassName = styles.indicator_pending;
      statusText = t("coupon.statusWaiting");
      break;
    }
    case "RETURN": {
      statusClassName = styles.indicator_return;
      statusText = t("coupon.historyReturn");
      break;
    }
    default: {
      statusClassName = styles.indicator_unknown || styles.indicator_pending;
      statusText = bet.status ? `${bet.status}` : t("coupon.statusProcessing");
      break;
    }
  }

  const currency = getSymbolFromCurrency(bet.currencyCode);
  const amount = Intl.NumberFormat(toIntlLocale(locale), {
    minimumFractionDigits: 2,
  }).format(Number(bet.amount));

  const money = `${amount}${currency}`;

  const [open, setOpen] = useState(false);

  const isExpressBet = "bets" in bet && Array.isArray(bet.bets);
  const isOrdinariBet = "game" in bet && bet.game;

  const betTitle = isOrdinariBet ? createTitleForBet(bet.betInfo, undefined, t) : null;
  const betTitles = isExpressBet
    ? bet.bets.map((betItem) => createTitleForBet(betItem.betInfo, undefined, t))
    : [];

  const getSportFromBet = (betItem: any) => {
    return betItem.sport || betItem.game?.sport;
  };

  const BetIcon =
    isOrdinariBet && getSportFromBet(bet) && gamesList[getSportFromBet(bet)]
      ? gamesList[getSportFromBet(bet)].Icon
      : null;
  const betIcons = isExpressBet
    ? bet.bets
        .map((betItem) => getSportFromBet(betItem))
        .map((sport) => gamesList[sport]?.Icon)
        .filter(Boolean)
    : [];

  const sportKey = isOrdinariBet ? getSportFromBet(bet) : null;
  const sport =
    sportKey && gamesList[sportKey]
      ? getSportLabel(sportKey, t)
      : null;
  const sports = isExpressBet
    ? bet.bets
        .map((betItem) => getSportFromBet(betItem))
        .map((itemSport) =>
          itemSport && gamesList[itemSport]
            ? getSportLabel(itemSport, t)
            : null,
        )
        .filter(Boolean)
    : [];

  const getScoreFromBet = (betItem: any) => {
    const score = betItem.score || betItem.game?.score;
    return score && score !== "N/A" ? score.split(" ")[0] : "N/A";
  };

  const score = isOrdinariBet ? getScoreFromBet(bet) : null;
  const scores = isExpressBet
    ? bet.bets.map((betItem) => getScoreFromBet(betItem)).filter(Boolean)
    : [];
  return {
    BetIcon,
    betIcons,
    betTitle,
    betTitles,
    date,
    money,
    open,
    score,
    scores,
    setOpen,
    sport,
    sports,
    statusClassName,
    statusText,
  };
};
