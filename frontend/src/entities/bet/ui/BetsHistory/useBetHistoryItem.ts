import getSymbolFromCurrency from "currency-symbol-map";
import dayjs from "dayjs";
import { useState } from "react";

import { createTitleForBet } from "~/entities/bet/lib";
import { gamesList } from "~/entities/game";
import { components } from "~/shared/api";

import styles from "./BetsHistoryItem.module.css";

type BetDto = components["schemas"]["BetDto"];
type ExpressBetDto = components["schemas"]["ExpressBetDto"];

export const useBetHistoryItem = (
  bet: BetDto | ExpressBetDto,
) => {
  const date = dayjs(bet.createdAt).format("DD.MM.YY / HH:mm");

  let statusClassName = ``;
  let statusText = ``;
  switch (bet.status) {
    case "WIN": {
      statusClassName = styles.indicator_win;
      statusText = `Победа`;
      break;
    }
    case "LOSE": {
      statusClassName = styles.indicator_lose;
      statusText = `Проигрыш`;
      break;
    }
    case "PENDING": {
      statusClassName = styles.indicator_pending;
      statusText = `Ожидание`;
      break;
    }
    case "RETURN": {
      statusClassName = styles.indicator_return;
      statusText = `Возврат`;
      break;
    }
    default: {
      // Обработка неизвестных статусов или null
      statusClassName = styles.indicator_unknown || styles.indicator_pending;
      statusText = bet.status ? `${bet.status}` : `Обработка...`;
      break;
    }
  }
  
  const currency = getSymbolFromCurrency(bet.currencyCode);
  const amount = Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
  }).format(Number(bet.amount));

  const money = `${amount}${currency}`;

  const [open, setOpen] = useState(false);

  // Проверяем тип ставки
  const isExpressBet = 'bets' in bet && Array.isArray(bet.bets);
  const isOrdinariBet = 'game' in bet && bet.game;

  const betTitle =
    isOrdinariBet ? createTitleForBet(bet.betInfo) : null;
  const betTitles =
    isExpressBet
      ? bet.bets.map((betItem) => createTitleForBet(betItem.betInfo))
      : [];

  // Получаем спорт из новых полей backend или fallback на старые
  const getSportFromBet = (betItem: any) => {
    return betItem.sport || betItem.game?.sport;
  };

  const BetIcon =
    isOrdinariBet && getSportFromBet(bet) && gamesList[getSportFromBet(bet)] 
      ? gamesList[getSportFromBet(bet)].Icon 
      : null;
  const betIcons =
    isExpressBet
      ? bet.bets
          .map((betItem) => getSportFromBet(betItem))
          .map((sport) => gamesList[sport]?.Icon)
          .filter(Boolean)
      : [];

  const sport =
    isOrdinariBet && getSportFromBet(bet) && gamesList[getSportFromBet(bet)]
      ? gamesList[getSportFromBet(bet)].label 
      : null;
  const sports =
    isExpressBet
      ? bet.bets
          .map((betItem) => getSportFromBet(betItem))
          .map((sport) => gamesList[sport]?.label)
          .filter(Boolean)
      : [];

  // Получаем счет из новых полей backend или fallback на старые
  const getScoreFromBet = (betItem: any) => {
    const score = betItem.score || betItem.game?.score;
    return score && score !== 'N/A' ? score.split(" ")[0] : 'N/A';
  };

  const score =
    isOrdinariBet 
      ? getScoreFromBet(bet)
      : null;
  const scores =
    isExpressBet
      ? bet.bets
          .map((betItem) => getScoreFromBet(betItem))
          .filter(Boolean)
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
