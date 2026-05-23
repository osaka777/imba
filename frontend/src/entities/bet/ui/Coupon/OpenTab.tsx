import { useQuery } from "@tanstack/react-query";

import { getBets } from "~/entities/bet/api";
import { Button, LoadingSpinner } from "~/shared/ui";

import { createTitleForBet } from "../../lib";
import styles from "./OpenTab.module.css";
import { gamesList } from "~/entities/game";
import { components } from "~/shared/api";
import { ImbaImage } from "~/shared/assets/images";

// Функция для получения названия ставки из betApiResponse
function getBetNameFromApiResponse(bet: any, betIndex?: number): string {
  try {
    // Проверяем наличие betApiResponse
    if (bet?.betApiResponse) {
      let apiResponse;

      // Парсим JSON если это строка
      if (typeof bet.betApiResponse === 'string') {
        apiResponse = JSON.parse(bet.betApiResponse);
      } else {
        apiResponse = bet.betApiResponse;
      }

      // Ищем BetName в BetsContentDataList
      if (apiResponse?.BetsContentDataList && Array.isArray(apiResponse.BetsContentDataList)) {
        // Для экспресс-ставок используем индекс, для ординара - первую ставку
        const dataIndex = betIndex !== undefined ? betIndex : 0;
        const betData = apiResponse.BetsContentDataList[dataIndex];

        if (betData?.BetName) {
          return betData.BetName;
        }
      }
    }

    // Fallback к старому методу
    return createTitleForBet(bet.betInfo, bet.betType);
  } catch (error) {
    console.error('Error parsing betApiResponse:', error);
    return createTitleForBet(bet.betInfo, bet.betType);
  }
}

// Функция для получения информации о команде/событии из betApiResponse
function getTeamsFromApiResponse(bet: any, betIndex?: number): string {
  try {
    if (bet?.betApiResponse) {
      let apiResponse;

      if (typeof bet.betApiResponse === 'string') {
        apiResponse = JSON.parse(bet.betApiResponse);
      } else {
        apiResponse = bet.betApiResponse;
      }

      if (apiResponse?.BetsContentDataList && Array.isArray(apiResponse.BetsContentDataList)) {
        const dataIndex = betIndex !== undefined ? betIndex : 0;
        const betData = apiResponse.BetsContentDataList[dataIndex];

        if (betData?.Teams) {
          return betData.Teams;
        }
      }
    }

    // Fallback к данным из game
    return (bet as any)?.game?.eventName || 'Матч';
  } catch (error) {
    console.error('Error parsing betApiResponse for teams:', error);
    return (bet as any)?.game?.eventName || 'Матч';
  }
}


export const OpenTab = () => {
  const { data, isLoading } = useQuery({
    queryFn: () => getBets(), // Запрашиваем все ставки без фильтра статуса
    queryKey: ["bets", "open"],
    refetchInterval: 3000, // Обновляем каждые 5 секунд
    refetchIntervalInBackground: true,
    staleTime: 0, // Данные всегда считаются устаревшими
  });

  // Фильтруем только открытые ставки (PENDING) на фронтенде
  const filteredData = data ? {
    ordinar: data.ordinar?.filter(bet => bet.status === 'PENDING') ?? [],
    express: data.express?.filter(bet => bet.status === 'PENDING') ?? []
  } : { ordinar: [], express: [] };

  const counter = (filteredData?.ordinar?.length ?? 0) + (filteredData?.express?.length ?? 0);


  function getScore(game: any) {
    // 1) Предпочитаем структурированный parsedScore, если он есть
    const ps = game?.parsedScore;
    const psText = ps?.text;
    if (psText?.currentScore) {
      const timePart = psText?.time ? ` ${psText.time}` : "";
      return `Счёт: ${psText.currentScore}${timePart}`.trim();
    }

    // 2) Если есть live-флаги, показываем, что матч идет
    const isLive = ps?.liveScore?.active || game?.status === 'LIVE' || game?.status === 'IN_PLAY' || game?.live === true;
    if (isLive) {
      const time = psText?.time || game?.time || "";
      return `Матч идёт${time ? ` (${time})` : ''}`;
    }

    // 3) Fallback: строковый score
    if (game?.score && game.score !== "0-0") {
      const mainScore = game.score.split(' ')[0].split('(')[0].trim();
      return `Счёт: ${mainScore}`;
    }

    // 4) Старт по расписанию не определен
    return "Матч не начался";
  }
  console.log('filteredData',filteredData  );
  const ordinars = filteredData?.ordinar?.map((ordinarBet) => {

    return (
      <div className={styles.bets} key={ordinarBet.id}>

        <div className={styles.coupon_wrapper}>
          <div style={{
            background: `url(${ImbaImage.src}) no-repeat center center / 250px auto`,
            width: '250px',
            aspectRatio: `${ImbaImage.width} / ${ImbaImage.height}`,
            position: 'absolute',
            top: '100px',
            left: '50%',
            transform: 'translateX(-50%) rotate(-20deg)',
            opacity: 0.3,
            pointerEvents: 'none',
          }}>
          </div>
          <div className={styles.header}>
            <div className={styles.header_type}>
              Ординар <span className={styles.id}>(ID R{ordinarBet.id})</span>
            </div>
          </div>

          <div className={styles.coupon_padding}>

            <div className={styles.coefficient_wrapper}>
              <div className={styles.coefficient_name}>
                <p>{(ordinarBet as any)?.game?.sport && gamesList[(ordinarBet as any).game.sport]
                  ? gamesList[(ordinarBet as any).game.sport].label
                  : (ordinarBet as any)?.game?.sport
                } </p>
                <p>{getBetNameFromApiResponse(ordinarBet)}</p>
              </div>
              <div className={styles.coefficient}>{ordinarBet.cf}</div>
            </div>
            <div className={styles.betInfo}>
              <div className="">
                <p className={styles.coupon_name}>{getTeamsFromApiResponse(ordinarBet)}</p>
                <p className={styles.coupon_name}>{getScore((ordinarBet as any)?.game)}</p>
              </div>
              <div>
                <p className={styles.coupon_subname}>
                  ({(ordinarBet as any)?.game?.leagueName || 'Лига'})
                </p>
              </div>
              <Button
                className={styles.goToEvent}
                elementType={"link"}
                href={`/game/${(ordinarBet as any).parentEventId || ordinarBet.gameId}`}
              >{`Перейти к событию`}</Button>
            </div>
          </div>
        </div>

        <div className={styles.coupon_active}>
          <div className={styles.coupon_active_info}>
            <div className={styles.info_wrapper}>
              <p className={styles.coupon_info_title}>Ставка</p>
              <p className={styles.coupon_info_value}>
                {ordinarBet.amount} {ordinarBet.currencyCode}
              </p>
            </div>
            <div className={styles.info_wrapper}>
              <p className={styles.coupon_info_title}>Коэф</p>
              <p className={styles.coupon_info_value}>{ordinarBet.cf}</p>
            </div>
            <div className={styles.win_wrapper}>
              {(ordinarBet as any)?.bonusProgress ? (
                <>
                  <p className={styles.coupon_info_value}>Прогресс к бонусу</p>
                  <p className={styles.coupon_info_value}>
                    {(ordinarBet as any).bonusProgress.current}/{(ordinarBet as any).bonusProgress.total}
                  </p>
                </>
              ) : (
                <>
                  <p className={styles.coupon_info_value}>Возм. выигрыш</p>
                  <p className={styles.coupon_info_value}>
                    {(Number(ordinarBet.amount) * Number(ordinarBet.cf)).toFixed(2)}{" "}
                    {ordinarBet.currencyCode}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  });

  const expresses = filteredData?.express?.map((expressBet) => {
    return (

      <div className={styles.bets} key={expressBet.id}>
        {expressBet.bets.map((bet, index) => {
          return (
            <div className={styles.coupon_wrapper} key={bet.id}>
              {index === 0 && (
                <div className={styles.header}>
                  <div className={styles.header_type}>
                    Экспресс{" "}
                    <span className={styles.id}>(ID E{expressBet.id})</span>
                  </div>
                </div>
              )}
              <div className={styles.coupon_padding}>
                <div className={styles.coefficient_wrapper}>
                  <div className={styles.coefficient_name}>
                    <p>
                      {(bet as any)?.game?.sport && gamesList[(bet as any).game.sport]
                        ? gamesList[(bet as any).game.sport].label
                        : (bet as any)?.game?.sport
                      } </p>

                    <p>{getBetNameFromApiResponse(expressBet, index)}</p>
                  </div>
                  <div className={styles.coefficient}>{bet.cf}</div>
                </div>
                <div className={styles.betInfo}>
                  <div>
                    <p className={styles.coupon_name}>{getTeamsFromApiResponse(expressBet, index)}</p>
                    <p className={styles.coupon_name}>{getScore((bet as any)?.game)}</p>
                  </div>
                  <div>
                    <p className={styles.coupon_subname}>({(bet as any)?.game?.leagueName || 'Лига'})</p>
                  </div>
                  <Button
                    className={styles.goToEvent}
                    elementType={"link"}
                    href={`/game/${(bet as any).parentEventId || bet.gameId}`}
                  >{`Перейти к событию`}</Button>
                </div>
              </div>
            </div>
          );
        })}

        <div className={styles.coupon_active}>
          <div className={styles.coupon_active_info}>
            <div className={styles.info_wrapper}>
              <p className={styles.coupon_info_title}>Ставка</p>
              <p className={styles.coupon_info_value}>
                {expressBet.amount} {expressBet.currencyCode}
              </p>
            </div>
            <div className={styles.info_wrapper}>
              <p className={styles.coupon_info_title}>Коэф</p>
              <p className={styles.coupon_info_value}>{expressBet.cf}</p>
            </div>
            <div className={styles.win_wrapper}>
              {(expressBet as any)?.bonusProgress ? (
                <>
                  <p className={styles.coupon_info_value}>Прогресс к бонусу</p>
                  <p className={styles.coupon_info_value}>
                    {(expressBet as any).bonusProgress.current}/{(expressBet as any).bonusProgress.total}
                  </p>
                </>
              ) : (
                <>
                  <p className={styles.coupon_info_value}>Возм. выигрыш</p>
                  <p className={styles.coupon_info_value}>
                    {(Number(expressBet.amount) * Number(expressBet.cf)).toFixed(2)}{" "}
                    {expressBet.currencyCode}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  });

  return (
    <div className={styles.openTab}>
     
      {isLoading && <LoadingSpinner />}
      {ordinars}
      {expresses}
      {counter === 0 && (
        <div className={styles.notFound}>Вы не сделали ни одной ставки</div>
      )}
    </div>
  );
};
