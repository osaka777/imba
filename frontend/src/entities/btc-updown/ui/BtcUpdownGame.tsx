"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "~/app/providers/AuthProvider";
import { useCurrency } from "~/shared/model/useCurrency";

import {
  fetchBtcBetHistory,
  fetchBtcDailyStats,
  fetchBtcQuote,
  fetchBtcState,
  placeBtcBet,
  type BtcQuoteDto,
  type BtcStateDto,
} from "../api/client";
import { BtcChart } from "./BtcChart";
import styles from "./BtcUpdownGame.module.css";

const PRESETS = [100, 500, 1000, 5000];
const SYMBOLS = [
  { id: "BTCUSDT", label: "BTC" },
  { id: "ETHUSDT", label: "ETH" },
  { id: "SOLUSDT", label: "SOL" },
] as const;
const ROUND_OPTIONS = [
  { ms: 60_000, label: "1M" },
  { ms: 300_000, label: "5M" },
  { ms: 900_000, label: "15M" },
] as const;
type ChartMode = "calm" | "detail" | "price";

function assetBase(symbol: string) {
  return symbol.replace("USDT", "");
}

function roundLabel(ms: number) {
  if (ms === 60_000) return "1M";
  if (ms === 900_000) return "15M";
  return "5M";
}

function formatMs(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function formatMoney(n: number) {
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 0 });
}

function formatPrice(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatClock(iso: string | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function BtcUpdownGame() {
  const { isAuth } = useAuth();
  const { currency } = useCurrency();
  const queryClient = useQueryClient();
  const cur = currency || "KZT";

  const [stake, setStake] = useState(500);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [nowSkew, setNowSkew] = useState(0);
  const [selected, setSelected] = useState<"UP" | "DOWN" | null>(null);
  const [tick, setTick] = useState(0);
  const [confirmSide, setConfirmSide] = useState<"UP" | "DOWN" | null>(null);
  const [quote, setQuote] = useState<BtcQuoteDto | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [chartMode, setChartMode] = useState<ChartMode>("calm");
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [roundMs, setRoundMs] = useState(300_000);
  const [dismissedResultId, setDismissedResultId] = useState<number | null>(null);

  const stateQuery = useQuery({
    queryKey: ["btc-updown-state", symbol, roundMs],
    queryFn: () => fetchBtcState(symbol, roundMs),
    refetchInterval: 350,
    staleTime: 200,
  });

  const state = stateQuery.data as BtcStateDto | undefined;
  const historyQuery = useQuery({
    queryKey: ["btc-updown-history"],
    queryFn: () => fetchBtcBetHistory(showHistory ? 30 : 8),
    enabled: isAuth,
    staleTime: 10_000,
    refetchInterval: showHistory ? 10_000 : false,
  });
  const statsQuery = useQuery({
    queryKey: ["btc-updown-daily", cur],
    queryFn: () => fetchBtcDailyStats(cur),
    enabled: isAuth,
    staleTime: 15_000,
    refetchInterval: 20_000,
  });

  useEffect(() => {
    if (!state?.serverNow) return;
    setNowSkew(Date.parse(state.serverNow) - Date.now());
  }, [state?.serverNow]);

  useEffect(() => {
    if (!state?.round?.id || !isAuth) return;
    void queryClient.invalidateQueries({ queryKey: ["btc-updown-history"] });
    void queryClient.invalidateQueries({ queryKey: ["btc-updown-daily"] });
  }, [state?.round?.id, isAuth, queryClient]);

  useEffect(() => {
    setDismissedResultId(null);
  }, [symbol, roundMs]);

  // smooth countdown
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 250);
    return () => window.clearInterval(id);
  }, []);

  const msToEnd = useMemo(() => {
    if (!state?.round?.endsAt) return 0;
    return Math.max(
      0,
      Date.parse(state.round.endsAt) - (Date.now() + nowSkew),
    );
  }, [state?.round?.endsAt, nowSkew, tick]);

  const msToLock = useMemo(() => {
    if (!state) return 0;
    const lockAt =
      Date.parse(state.round.endsAt) - (state.config?.lockMs ?? 15_000);
    return Math.max(0, lockAt - (Date.now() + nowSkew));
  }, [state, nowSkew, tick]);

  const bettingOpen = Boolean(state?.bettingOpen && msToLock > 0);
  const urgent =
    bettingOpen && msToLock < Math.min(45_000, Math.max(8_000, roundMs / 4));

  const odds = state?.config?.odds ?? 1.85;
  const potential = Math.floor(stake * odds);
  const profit = Math.max(0, potential - stake);
  const asset = assetBase(symbol);
  const marketTitle = `${asset}/USD · ${roundLabel(roundMs)}`;

  const placeMut = useMutation({
    mutationFn: (payload: { side: "UP" | "DOWN"; expectedPrice?: number }) =>
      placeBtcBet(
        payload.side,
        stake,
        cur,
        symbol,
        roundMs,
        payload.expectedPrice,
      ),
    onSuccess: (bet) => {
      setError(null);
      setSelected(bet.side);
      setConfirmSide(null);
      setQuote(null);
      setFlash(
        `Ставка принята · ${asset} ${bet.side === "UP" ? "ВВЕРХ" : "ВНИЗ"} · entry $${formatPrice(bet.entryPrice)} · ${formatMoney(bet.stake)} ${bet.currencyCode}`,
      );
      void queryClient.invalidateQueries({
        queryKey: ["btc-updown-state", symbol, roundMs],
      });
      void queryClient.invalidateQueries({ queryKey: ["btc-updown-history"] });
      void queryClient.invalidateQueries({ queryKey: ["btc-updown-daily"] });
      void queryClient.invalidateQueries({ queryKey: ["user"] });
      window.setTimeout(() => setFlash(null), 4200);
    },
    onError: (err: Error) => {
      setError(err.message || "Ошибка ставки");
    },
  });

  const loadQuote = async () => {
    setQuoteLoading(true);
    try {
      const next = await fetchBtcQuote(symbol, roundMs);
      setQuote(next);
      return next;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка котировки");
      return null;
    } finally {
      setQuoteLoading(false);
    }
  };

  const requestBet = async (side: "UP" | "DOWN") => {
    setSelected(side);
    if (!isAuth) {
      setError("Войдите, чтобы ставить");
      return;
    }
    if (!bettingOpen) {
      setError("Приём ставок закрыт — дождись следующего раунда");
      return;
    }
    setError(null);
    setConfirmSide(side);
    await loadQuote();
  };

  const confirmBet = async () => {
    if (!confirmSide) return;
    const fresh = quote ?? (await loadQuote());
    if (!fresh) return;
    if (Date.parse(fresh.validUntil) < Date.now()) {
      const refreshed = await loadQuote();
      if (!refreshed) return;
      placeMut.mutate({
        side: confirmSide,
        expectedPrice: refreshed.price,
      });
      return;
    }
    placeMut.mutate({
      side: confirmSide,
      expectedPrice: fresh.price,
    });
  };

  const openPrice = state?.openPrice ?? null;
  const livePrice = state?.price ?? null;

  const pendingBets = useMemo(() => {
    if (!state?.myBets?.length) return [];
    return state.myBets
      .filter((b) => b.status === "PENDING")
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  }, [state?.myBets]);

  const chartPositions = useMemo(() => {
    return pendingBets
      .map((b) => {
        const entry =
          b.entryPrice != null && Number.isFinite(b.entryPrice)
            ? b.entryPrice
            : openPrice;
        if (entry == null || livePrice == null) return null;
        const winning =
          b.side === "UP" ? livePrice >= entry : livePrice < entry;
        return {
          id: b.id,
          side: b.side,
          stake: b.stake,
          entryPrice: entry,
          placedAtMs: Date.parse(b.createdAt),
          winning,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);
  }, [pendingBets, openPrice, livePrice]);

  const activePosition = chartPositions.at(-1) ?? null;
  const activeMovePct =
    activePosition && livePrice != null
      ? ((livePrice - activePosition.entryPrice) / activePosition.entryPrice) *
        (activePosition.side === "UP" ? 100 : -100)
      : null;

  const latestResult = useMemo(() => {
    const result = historyQuery.data?.find(
      (bet) =>
        (bet.status === "WIN" || bet.status === "LOSE") &&
        bet.round.symbol === symbol &&
        (bet.round.roundMs ?? 300_000) === roundMs &&
        bet.settledAt != null &&
        Date.now() - Date.parse(bet.settledAt) < 30_000,
    );
    return result && result.id !== dismissedResultId ? result : null;
  }, [historyQuery.data, symbol, roundMs, dismissedResultId, tick]);

  const progress =
    state?.round?.startsAt && state?.round?.endsAt
      ? Math.min(
          1,
          Math.max(
            0,
            (Date.now() + nowSkew - Date.parse(state.round.startsAt)) /
              (Date.parse(state.round.endsAt) - Date.parse(state.round.startsAt)),
          ),
        )
      : 0;

  const roundStart = state?.round?.startsAt;
  const roundEnd = state?.round?.endsAt;
  const lockAtMs = state
    ? Date.parse(state.round.endsAt) - (state.config?.lockMs ?? 15_000)
    : Date.now();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        confirmSide ||
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelected("UP");
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelected("DOWN");
      } else if (event.key === "Enter" && selected) {
        event.preventDefault();
        requestBet(selected);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmSide, selected, bettingOpen, isAuth]);

  return (
    <div className={styles.page}>
      <header className={styles.marketBar}>
        <div className={styles.marketIdentity}>
          <Image
            src="/images/btc-logo.png"
            alt={asset}
            width={28}
            height={28}
            className={styles.btcIcon}
          />
          <div>
            <div className={styles.marketName}>
              {asset}/USD <span>{roundLabel(roundMs)}</span>
            </div>
            <div className={styles.marketSource}>
              <i aria-hidden /> Crypto Markets · Binance
            </div>
          </div>
        </div>
        <div className={styles.marketMetric}>
          <span>Последняя цена</span>
          <strong>{livePrice != null ? `$${formatPrice(livePrice)}` : "—"}</strong>
        </div>
        <div className={styles.marketMetric}>
          <span>Изменение</span>
          <strong className={(state?.changePct ?? 0) >= 0 ? styles.up : styles.down}>
            {state?.changePct != null
              ? `${state.changePct >= 0 ? "+" : ""}${state.changePct.toFixed(3)}%`
              : "—"}
          </strong>
        </div>
        <div className={styles.marketMetric}>
          <span>{bettingOpen ? "До закрытия" : "До финиша"}</span>
          <strong className={urgent ? styles.urgentClock : ""}>
            {formatMs(bettingOpen ? msToLock : msToEnd)}
          </strong>
        </div>
        <div className={styles.marketState}>
          <i className={bettingOpen ? styles.stateOpen : styles.stateLocked} />
          {bettingOpen
            ? "Приём ставок"
            : msToEnd > 0
              ? "Ставки закрыты"
              : "Новый раунд"}
        </div>
      </header>

      <div className={styles.marketSwitch}>
        <div className={styles.switchGroup} role="group" aria-label="Актив">
          {SYMBOLS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={symbol === item.id ? styles.switchOn : styles.switchBtn}
              onClick={() => setSymbol(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className={styles.switchGroup} role="group" aria-label="Таймфрейм">
          {ROUND_OPTIONS.map((item) => (
            <button
              key={item.ms}
              type="button"
              className={roundMs === item.ms ? styles.switchOn : styles.switchBtn}
              onClick={() => setRoundMs(item.ms)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {isAuth && statsQuery.data ? (
        <section className={styles.dailyStats}>
          <div>
            <span>Сегодня</span>
            <strong className={statsQuery.data.pnl >= 0 ? styles.up : styles.down}>
              {statsQuery.data.pnl >= 0 ? "+" : ""}
              {formatMoney(statsQuery.data.pnl)} {cur}
            </strong>
          </div>
          <div>
            <span>Ставок</span>
            <strong>{statsQuery.data.bets}</strong>
          </div>
          <div>
            <span>Winrate</span>
            <strong>
              {statsQuery.data.winRate != null
                ? `${statsQuery.data.winRate}%`
                : "—"}
            </strong>
          </div>
          <div>
            <span>Оборот</span>
            <strong>
              {formatMoney(statsQuery.data.stakeTotal)} {cur}
            </strong>
          </div>
        </section>
      ) : null}

      <section className={styles.mainGrid}>
        <div className={styles.leftCol}>
          <div className={styles.chartHead}>
            <div>
              <p>{marketTitle}</p>
              <h1>{asset} будет выше или ниже?</h1>
            </div>
            <div className={styles.chartControls} aria-label="Масштаб графика">
              <button
                type="button"
                className={chartMode === "calm" ? styles.chartControlOn : styles.chartControl}
                onClick={() => setChartMode("calm")}
              >
                Спокойно
              </button>
              <button
                type="button"
                className={chartMode === "detail" ? styles.chartControlOn : styles.chartControl}
                onClick={() => setChartMode("detail")}
              >
                Детально
              </button>
              <button
                type="button"
                className={chartMode === "price" ? styles.chartControlOn : styles.chartControl}
                onClick={() => setChartMode("price")}
              >
                Цена
              </button>
            </div>
          </div>
          <div className={styles.chartCard}>
            <BtcChart
              ticks={state?.ticks ?? []}
              openPrice={openPrice}
              livePrice={livePrice}
              changePct={state?.changePct ?? null}
              startsAtMs={state ? Date.parse(state.round.startsAt) : Date.now()}
              endsAtMs={
                state ? Date.parse(state.round.endsAt) : Date.now() + roundMs
              }
              lockAtMs={lockAtMs}
              msToLock={msToLock}
              msToEnd={msToEnd}
              bettingOpen={bettingOpen}
              urgent={urgent}
              progress={progress}
              roundStartLabel={formatClock(roundStart)}
              roundEndLabel={formatClock(roundEnd)}
              positions={chartPositions}
              mode={chartMode}
            />
            {latestResult ? (
              <section
                className={`${styles.resultMoment} ${
                  latestResult.status === "WIN" ? styles.resultWin : styles.resultLose
                }`}
                aria-live="assertive"
              >
                <button
                  type="button"
                  className={styles.resultClose}
                  aria-label="Закрыть результат"
                  onClick={() => setDismissedResultId(latestResult.id)}
                >
                  ×
                </button>
                <span className={styles.resultEyebrow}>Раунд завершён</span>
                <strong className={styles.resultTitle}>
                  {latestResult.status === "WIN" ? "WIN" : "LOSE"}
                </strong>
                <p>
                  ${formatPrice(latestResult.entryPrice)} → $
                  {formatPrice(latestResult.round.closePrice)}
                </p>
                <b>
                  {latestResult.status === "WIN" ? "+" : "−"}
                  {formatMoney(
                    latestResult.status === "WIN"
                      ? latestResult.potentialPayout - latestResult.stake
                      : latestResult.stake,
                  )}{" "}
                  {latestResult.currencyCode}
                </b>
                <button
                  type="button"
                  className={styles.repeatBet}
                  disabled={!bettingOpen}
                  onClick={() => {
                    setStake(latestResult.stake);
                    setSelected(latestResult.side);
                    setDismissedResultId(latestResult.id);
                    void requestBet(latestResult.side);
                  }}
                >
                  {bettingOpen ? "Повторить ставку" : "Ждём следующий раунд"}
                </button>
              </section>
            ) : null}
          </div>
          {activePosition ? (
            <section
              className={`${styles.positionRow} ${
                activePosition.winning ? styles.positionPositive : styles.positionNegative
              }`}
            >
              <div>
                <span>Открытая позиция</span>
                <strong>{activePosition.side === "UP" ? "ВВЕРХ" : "ВНИЗ"}</strong>
              </div>
              <div>
                <span>Вход</span>
                <strong>${formatPrice(activePosition.entryPrice)}</strong>
              </div>
              <div>
                <span>Сейчас</span>
                <strong>${formatPrice(livePrice)}</strong>
              </div>
              <div>
                <span>Предварительный исход</span>
                <strong>
                  {activeMovePct != null
                    ? `${activePosition.winning ? "В плюсе" : "В минусе"} · ${
                        activeMovePct >= 0 ? "+" : ""
                      }${activeMovePct.toFixed(3)}%`
                    : "—"}
                </strong>
              </div>
            </section>
          ) : null}
        </div>

        <aside className={styles.betDesk}>
        <div className={styles.ticketHead}>
          <div>
            <span>Новый прогноз</span>
            <strong>Направление цены</strong>
          </div>
          <b>×{odds.toFixed(2)}</b>
        </div>
        <div className={styles.directionTabs}>
          <button
            type="button"
            className={`${styles.directionUp} ${selected === "UP" ? styles.directionOn : ""}`}
            disabled={!bettingOpen || placeMut.isPending}
            onClick={() => setSelected("UP")}
          >
            <span>↑</span> Вверх
          </button>
          <button
            type="button"
            className={`${styles.directionDown} ${selected === "DOWN" ? styles.directionOn : ""}`}
            disabled={!bettingOpen || placeMut.isPending}
            onClick={() => setSelected("DOWN")}
          >
            <span>↓</span> Вниз
          </button>
        </div>
        <div className={styles.payoutBanner}>
          <div>
            <span>Возможный выигрыш</span>
            <strong>
              {formatMoney(potential)} {cur}
            </strong>
          </div>
          <div className={styles.profitTag}>
            +{formatMoney(profit)} {cur} чистыми
          </div>
        </div>

        <div className={styles.stakeBlock}>
          <div className={styles.stakeHead}>
            <span>Сумма ставки</span>
            <span className={styles.stakeCur}>{cur}</span>
          </div>

          <div className={styles.stakeControls}>
            <button
              type="button"
              className={styles.stakeBtn}
              onClick={() => setStake((s) => Math.max(state?.config?.minStake ?? 100, s - 100))}
              aria-label="Минус"
            >
              −
            </button>
            <input
              className={styles.stakeInput}
              type="number"
              min={state?.config?.minStake ?? 100}
              max={state?.config?.maxStake ?? 500000}
              step={100}
              value={stake}
              onChange={(e) => setStake(Number(e.target.value) || 0)}
            />
            <button
              type="button"
              className={styles.stakeBtn}
              onClick={() => setStake((s) => Math.min(state?.config?.maxStake ?? 500000, s + 100))}
              aria-label="Плюс"
            >
              +
            </button>
          </div>

          <div className={styles.presets}>
            {PRESETS.map((v) => (
              <button
                key={v}
                type="button"
                className={`${styles.preset} ${stake === v ? styles.presetOn : ""}`}
                onClick={() => setStake(v)}
              >
                {formatMoney(v)}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className={`${styles.submitBet} ${
            selected === "DOWN" ? styles.submitBetDown : ""
          }`}
          disabled={!bettingOpen || placeMut.isPending || selected == null}
          onClick={() => selected && requestBet(selected)}
        >
          {placeMut.isPending
            ? "Принятие ставки…"
            : selected === "UP"
              ? "Поставить на рост"
              : selected === "DOWN"
                ? "Поставить на падение"
                : "Выберите направление"}
        </button>

        {!bettingOpen ? (
          <p className={styles.lockNote}>
            Приём ставок закрыт · результат через {formatMs(msToEnd)}
          </p>
        ) : urgent ? (
          <p className={styles.urgentNote}>
            Успей поставить — окно закрывается через {formatMs(msToLock)}
          </p>
        ) : (
          <p className={styles.hint}>
            ↑/↓ выбрать направление · Enter подтвердить
          </p>
        )}

        {!isAuth ? (
          <p className={styles.authNote}>Войди или зарегистрируйся, чтобы ставить</p>
        ) : null}

        {error ? <p className={styles.error}>{error}</p> : null}
        {flash ? <p className={styles.flash}>{flash}</p> : null}
        </aside>
      </section>

      {state?.recentRounds?.length ? (
        <section className={styles.recentStrip}>
          <div className={styles.recentHead}>
            <h2>Последние раунды</h2>
            <span>серия исходов</span>
          </div>
          <div className={styles.recent}>
            {[...state.recentRounds].reverse().map((r) => (
              <span
                key={r.id}
                className={r.result === "UP" ? styles.dotUp : styles.dotDown}
                title={`${r.result} · ${r.startsAt}`}
              >
                {r.result === "UP" ? "▲" : "▼"}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {state?.myBets?.length ? (
        <section className={styles.myBets}>
          <h2>Мои ставки в раунде</h2>
          <ul>
            {state.myBets.map((b) => (
              <li key={b.id}>
                <span className={b.side === "UP" ? styles.up : styles.down}>
                  {b.side === "UP" ? "▲ Вверх" : "▼ Вниз"}
                </span>
                <span>
                  {formatMoney(b.stake)} {b.currencyCode}
                  {b.entryPrice != null ? (
                    <em style={{ opacity: 0.65, fontStyle: "normal" }}>
                      {" "}
                      @ ${formatPrice(b.entryPrice)}
                    </em>
                  ) : null}
                </span>
                <span className={styles[`st_${b.status}`]}>
                  {b.status === "PENDING"
                    ? "В игре"
                    : b.status === "WIN"
                      ? "Выигрыш"
                      : b.status === "LOSE"
                        ? "Проигрыш"
                        : "Возврат"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {isAuth ? (
        <section className={styles.historyPanel}>
          <button
            type="button"
            className={styles.historyToggle}
            onClick={() => setShowHistory((value) => !value)}
          >
            <span>История сделок</span>
            <span>{showHistory ? "Скрыть" : "Показать"}</span>
          </button>
          {showHistory ? (
            <div className={styles.historyTable}>
              <div className={styles.historyHead}>
                <span>Направление</span>
                <span>Вход / выход</span>
                <span>Сумма</span>
                <span>Результат</span>
              </div>
              {historyQuery.isLoading ? (
                <p className={styles.historyEmpty}>Загружаем сделки…</p>
              ) : historyQuery.data?.length ? (
                historyQuery.data.map((bet) => {
                  const result =
                    bet.status === "WIN"
                      ? bet.potentialPayout - bet.stake
                      : bet.status === "LOSE"
                        ? -bet.stake
                        : null;
                  return (
                    <div className={styles.historyItem} key={bet.id}>
                      <span className={bet.side === "UP" ? styles.up : styles.down}>
                        {assetBase(bet.round.symbol)}{" "}
                        {bet.side === "UP" ? "↑" : "↓"}{" "}
                        {roundLabel(bet.round.roundMs ?? 300_000)}
                      </span>
                      <span>
                        ${formatPrice(bet.entryPrice)}
                        {bet.round.closePrice != null
                          ? ` → $${formatPrice(bet.round.closePrice)}`
                          : " · ожидаем"}
                        {bet.audit?.reason ? (
                          <em className={styles.auditReason}>{bet.audit.reason}</em>
                        ) : null}
                      </span>
                      <span>
                        {formatMoney(bet.stake)} {bet.currencyCode}
                      </span>
                      <strong
                        className={
                          result == null ? "" : result >= 0 ? styles.up : styles.down
                        }
                      >
                        {result == null
                          ? "В игре"
                          : `${result >= 0 ? "+" : ""}${formatMoney(result)} ${bet.currencyCode}`}
                      </strong>
                    </div>
                  );
                })
              ) : (
                <p className={styles.historyEmpty}>Пока нет сделок по Crypto Markets.</p>
              )}
            </div>
          ) : null}
        </section>
      ) : null}

      <footer className={styles.footerNote}>
        {marketTitle} · Binance · ×{odds.toFixed(2)} · UP: close ≥ entry · DOWN: close &lt;
        entry · slip ≤ {state?.config?.slippageBps ?? 5} bps
      </footer>

      {confirmSide ? (
        <div
          className={styles.dialogBackdrop}
          role="presentation"
          onMouseDown={() => {
            setConfirmSide(null);
            setQuote(null);
          }}
        >
          <section
            className={styles.confirmDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="btc-confirm-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.confirmTop}>
              <div>
                <span>Подтверждение сделки</span>
                <h2 id="btc-confirm-title">
                  {confirmSide === "UP"
                    ? `Ставка на рост ${asset}`
                    : `Ставка на падение ${asset}`}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setConfirmSide(null);
                  setQuote(null);
                }}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            <div className={styles.confirmGrid}>
              <span>
                Сумма{" "}
                <b>
                  {formatMoney(stake)} {cur}
                </b>
              </span>
              <span>
                Quote{" "}
                <b>
                  $
                  {formatPrice(quote?.price ?? livePrice)}
                </b>
              </span>
              <span>
                Выплата{" "}
                <b>
                  {formatMoney(potential)} {cur}
                </b>
              </span>
              <span>
                Slippage{" "}
                <b>≤ {quote?.slippageBps ?? state?.config?.slippageBps ?? 5} bps</b>
              </span>
            </div>
            <p>
              Entry фиксируется по live-цене в момент подтверждения. Если цена
              уйдёт дальше допустимого slippage — ставка отклонится, можно
              обновить quote.
            </p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.cancelConfirm}
                onClick={() => void loadQuote()}
                disabled={quoteLoading || placeMut.isPending}
              >
                {quoteLoading ? "Котировка…" : "Обновить quote"}
              </button>
              <button
                type="button"
                className={
                  confirmSide === "UP" ? styles.confirmUp : styles.confirmDown
                }
                onClick={() => void confirmBet()}
                disabled={placeMut.isPending || quoteLoading}
              >
                {placeMut.isPending ? "Принимаем…" : "Подтвердить ставку"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
