"use client";

import { useRef, useState } from "react";
import { useDebounceCallback } from "usehooks-ts";

import { fetchWcSearchEvents, type WcEvent } from "~/entities/wc-odds/api/client";
import { buildWcGameHref } from "~/entities/wc-odds/lib/wcSlug";
import { isWcPriorityEvent } from "~/entities/wc-odds/lib/wcPriority";
import { FireIcon, LiveIcon, QuestionIcon } from "~/shared/assets";
import { Button, Input } from "~/shared/ui";
import { cn } from "~/shared/lib";

import { gamesList } from "../../lib";
import styles from "./Search.module.css";

type SearchProps = {
  sport?: string;
  className?: string;
  layout?: "default" | "toolbar";
  hideOnDesktop?: boolean;
};

export const Search: React.FC<SearchProps> = ({ sport, className, layout = "default", hideOnDesktop }) => {
  const [res, setRes] = useState<WcEvent[] | null>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);

  const loadResult = useDebounceCallback(async (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setRes([]);
      setLoading(false);
      return;
    }

    const reqId = ++requestIdRef.current;
    setLoading(true);
    try {
      const result = await fetchWcSearchEvents(trimmed, sport);
      if (reqId !== requestIdRef.current) return;
      setRes(result.length === 0 ? null : result);
    } catch {
      if (reqId !== requestIdRef.current) return;
      setRes(null);
    } finally {
      if (reqId === requestIdRef.current) setLoading(false);
    }
  }, 400);

  const inputOnChangeHandler = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setInputValue(value);
    if (value.trim().length < 2) {
      requestIdRef.current += 1;
      setRes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    loadResult(value);
  };

  return (
    <div className={cn(styles.Search, layout === "toolbar" && styles.Search_toolbar, hideOnDesktop && styles.Search_hiddenOnDesktop, className)}>
      <div className={styles.bar}>
        <Input
          onChange={inputOnChangeHandler}
          placeholder="Поиск..."
          type="search"
          value={inputValue}
        />
        {loading && <span className={styles.loader}>...</span>}
      </div>

      {res === null ? (
        <div className={styles.err}>Матчи по данному запросу не найдены</div>
      ) : res.length > 0 ? (
        <div className={styles.result}>
          {res.map((event) => {
            const Icon = gamesList[event.sport]?.Icon || QuestionIcon;
            const label = `${event.homeTeam} — ${event.awayTeam}`;
            return (
              <Button
                className={styles.game}
                elementType="link"
                href={buildWcGameHref(event)}
                key={event.id}
              >
                <div className={styles.text}>
                  <div className={styles.separator} />
                  <Icon className={styles.icon} />
                  {event.leagueName}
                </div>
                <p className={styles.text}>
                  {label}
                  {event.phase === "live" && (
                    <LiveIcon className={styles.statusIconsLive} />
                  )}
                  {isWcPriorityEvent(event) && (
                    <FireIcon className={styles.priority} />
                  )}
                </p>
              </Button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};
