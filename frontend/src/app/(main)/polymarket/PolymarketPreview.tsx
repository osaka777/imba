"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import styles from "./PolymarketPreview.module.css";

type OutcomeView = {
  name: string;
  price: number;
};

type MarketView = {
  id: string;
  question: string;
  outcomes: OutcomeView[];
  volume: number;
};

type EventView = {
  id: string;
  title: string;
  slug: string;
  image: string | null;
  volume24hr: number;
  volume: number;
  liquidity: number;
  endDate: string | null;
  markets: MarketView[];
  url: string;
};

type ApiResponse = {
  events: EventView[];
  fetchedAt?: string;
  error?: string;
  order?: string;
};

type SortMode = "volume" | "liquidity";

function formatUsd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${Math.round(value)}`;
}

function formatPct(price: number): string {
  return `${Math.round(price * 100)}%`;
}

async function fetchEvents(order: SortMode): Promise<ApiResponse> {
  const response = await fetch(`/polymarket/feed?order=${order}&limit=24`, {
    cache: "no-store",
  });
  const data = (await response.json()) as ApiResponse;
  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return data;
}

export function PolymarketPreview() {
  const [order, setOrder] = useState<SortMode>("volume");

  const { data, error, isLoading, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ["polymarket-preview", order],
    queryFn: () => fetchEvents(order),
    refetchInterval: 60_000,
    staleTime: 45_000,
  });

  const events = data?.events ?? [];
  const updatedLabel = useMemo(() => {
    const ts = dataUpdatedAt || (data?.fetchedAt ? Date.parse(data.fetchedAt) : 0);
    if (!ts) return null;
    return new Date(ts).toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }, [data?.fetchedAt, dataUpdatedAt]);

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.badgeRow}>
          <span className={styles.badge}>Preview</span>
          <span className={styles.badgeMuted}>Polymarket · free Gamma API</span>
        </div>
        <h1 className={styles.title}>Рынок говорит</h1>
        <p className={styles.lead}>
          Живые вероятности и объёмы с Polymarket. Не ставки Imba — внешние prediction
          markets: Yes/No = вероятность события по цене акции.
        </p>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.tabs} role="tablist" aria-label="Сортировка">
          <button
            className={`${styles.tab} ${order === "volume" ? styles.tabActive : ""}`}
            onClick={() => setOrder("volume")}
            role="tab"
            type="button"
          >
            Volume 24h
          </button>
          <button
            className={`${styles.tab} ${order === "liquidity" ? styles.tabActive : ""}`}
            onClick={() => setOrder("liquidity")}
            role="tab"
            type="button"
          >
            Liquidity
          </button>
        </div>
        <div className={styles.meta}>
          {isFetching ? "Обновление…" : updatedLabel ? `обновлено ${updatedLabel}` : null}
        </div>
      </div>

      <div className={styles.grid}>
        {isLoading ? (
          <div className={styles.stateBox}>Загрузка рынков…</div>
        ) : error ? (
          <div className={`${styles.stateBox} ${styles.error}`}>
            Не удалось загрузить Polymarket:{" "}
            {error instanceof Error ? error.message : "ошибка"}
          </div>
        ) : events.length === 0 ? (
          <div className={styles.stateBox}>Сейчас нет активных рынков с ценами</div>
        ) : (
          events.map((event) => (
            <article className={styles.card} key={event.id}>
              <div className={styles.cardHead}>
                {event.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt=""
                    className={styles.thumb}
                    decoding="async"
                    loading="lazy"
                    src={event.image}
                  />
                ) : (
                  <div className={styles.thumb} />
                )}
                <div style={{ minWidth: 0 }}>
                  <h2 className={styles.cardTitle}>{event.title}</h2>
                  <div className={styles.stats}>
                    <span className={styles.stat}>
                      24h {formatUsd(event.volume24hr)}
                    </span>
                    <span className={styles.stat}>
                      vol {formatUsd(event.volume)}
                    </span>
                    <span className={styles.stat}>
                      liq {formatUsd(event.liquidity)}
                    </span>
                  </div>
                </div>
              </div>

              <div className={styles.markets}>
                {event.markets.slice(0, 4).map((market) => (
                  <div className={styles.market} key={market.id || market.question}>
                    <p className={styles.marketQ}>{market.question}</p>
                    <div className={styles.outcomes}>
                      {market.outcomes.slice(0, 4).map((outcome) => (
                        <div className={styles.outcome} key={`${market.id}-${outcome.name}`}>
                          <div className={styles.barTrack}>
                            <div
                              className={styles.barFill}
                              style={{ width: `${Math.max(outcome.price * 100, 2)}%` }}
                            />
                            <span className={styles.barLabel}>{outcome.name}</span>
                          </div>
                          <span className={styles.pct}>{formatPct(outcome.price)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className={styles.cardFoot}>
                <a
                  className={styles.link}
                  href={event.url}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Открыть на Polymarket →
                </a>
              </div>
            </article>
          ))
        )}
      </div>

      <p className={styles.disclaimer}>
        Демо-страница для оценки UX. Данные с публичного API Polymarket, ставки здесь
        не принимаются. Не путать с линией Imba (Olimpbet).
      </p>
    </div>
  );
}
