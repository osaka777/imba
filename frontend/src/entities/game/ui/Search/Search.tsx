import { useRef, useState } from "react";
import { useDebounceCallback } from "usehooks-ts";

import { FireIcon, LiveIcon, QuestionIcon } from "~/shared/assets";
import { Button, Input } from "~/shared/ui";

import { getGamesByParams } from "../../api";
import { gamesList } from "../../lib";
import { Games } from "../../types";
import styles from "./Search.module.css";

export const Search: React.FC = () => {
  const [res, setRes] = useState<Games | null>([]);
  const [inputValue, setInputValue] = useState("");
  const ref = useRef<HTMLInputElement | null>(null);

  const loadResult = useDebounceCallback(async (value: string) => {
    if (!value.length) return setRes([]);
    if (value.length < 3) return setRes([]);

    if (ref.current && ref.current.value.length < 3) return setRes([]);
    const result = await getGamesByParams({ eventName: value, league: value });

    if (!result) return setRes(null);
    result.length === 0
      ? setRes(null)
      : setRes(result.sort((resA, resB) => resB.priority - resA.priority));
  }, 1000);

  const inputOnChangeHandler = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = event.target.value;

    setInputValue(value);

    loadResult(value.toLocaleLowerCase());
  };

  return (
    <div className={styles.Search}>
      <div className={styles.bar}>
        <Input
          onChange={inputOnChangeHandler}
          placeholder={`Поиск...`}
          ref={ref}
          type={`search`}
          value={inputValue}
        />
      </div>

      {res === null ? (
        <div
          className={styles.err}
        >{`Матчи по данному запросу не найдены :(`}</div>
      ) : res.length > 0 ? (
        <div className={styles.result}>
          {res.map((game) => {
            const Icon = gamesList[game.sport]?.Icon || QuestionIcon;
            return (
              <Button
                className={styles.game}
                elementType={`link`}
                href={`/game/${game.eventId}`}
                key={game.eventId}
              >
                <div className={styles.text}>
                  <div className={styles.separator}></div>
                  <Icon className={styles.icon} />
                  {game.leagueName}
                </div>
                <p className={styles.text}>
                  {game.eventName}
                  {game.status === "IN_PROGRESS" ? (
                    <LiveIcon className={styles.statusIconsLive} />
                  ) : null}
                  {game.priority > 0 ? (
                    <>
                      {/* <p className={styles.statusIconsText}>{`Популярное`}</p> */}
                      <FireIcon className={styles.priority} />
                    </>
                  ) : null}
                </p>

                {/* <p className={styles.text}>{`ID:${game.eventId}`}</p> */}
              </Button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};
