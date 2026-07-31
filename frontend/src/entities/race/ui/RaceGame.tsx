"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import NumberFlow, { continuous } from "@number-flow/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { useAuth } from "~/app/providers/AuthProvider";
import {
  playBetClickSound,
  unlockBetClickSound,
} from "~/entities/btc-updown/lib/bet-sfx";
import {
  formatMoneyAmount,
  holdStakeStepForCurrency,
  maxStakeForCurrency,
  ScrubMoney,
  stakeStepForCurrency,
} from "~/entities/btc-updown/ui/FlipDigits";
import { useCurrency } from "~/shared/model/useCurrency";
import { useLocale } from "~/shared/model/useLocale";

import { fetchRaceState, placeRaceBet, type RaceBetDto, type RaceTick } from "../api/client";
import { RACE_PAIRS, racePairFromKey, type RacePairMeta } from "../lib/pairs";
import { RaceChart } from "./RaceChart";

import styles from "./RaceGame.module.css";

const FLOW_PLUGINS = [continuous];
const FLOW_SPIN = {
  duration: 420,
  easing: "cubic-bezier(0.16, 0.84, 0.22, 1)",
} as const;

const ROUND_OPTIONS = [
  { ms: 300_000, label: "5м" },
  { ms: 900_000, label: "15м" },
];

function mergeRaceTicks(
  prev: RaceTick[],
  incoming: RaceTick[] | undefined,
  live: number | null | undefined,
  keepMs: number,
): RaceTick[] {
  const now = Date.now();
  const map = new Map<number, number>();
  for (const t of prev) {
    if (t.t < now - keepMs) continue;
    if (
      live != null &&
      Number.isFinite(live) &&
      live > 0 &&
      Math.abs(t.p - live) / live > 0.25
    ) {
      continue;
    }
    map.set(t.t, t.p);
  }
  if (incoming?.length) {
    for (const t of incoming) map.set(t.t, t.p);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([t, p]) => ({ t, p }));
}

function presetsForCurrency(cur: string): number[] {
  const c = cur.toUpperCase();
  if (c === "USD" || c === "USDT") return [1, 5, 25, 100];
  if (c === "RUB") return [200, 500, 1500, 5000];
  return [1000, 2500, 10000, 25000];
}

function priceDigits(n: number): number {
  if (n >= 100) return 2;
  if (n >= 1) return 4;
  if (n >= 0.01) return 6;
  return 8;
}

function moneyDigits(cur: string, n: number): number {
  const c = cur.toUpperCase();
  if (c === "USD" || c === "USDT") return Number.isInteger(n) ? 0 : 2;
  return 0;
}

function FlowPrice({ value }: { value: number | null }) {
  if (value == null || !Number.isFinite(value)) {
    return <span className={styles.flowFallback}>—</span>;
  }
  const digits = priceDigits(value);
  return (
    <NumberFlow
      className={styles.flowNum}
      value={value}
      locales="en-US"
      prefix="$"
      format={{
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
        useGrouping: true,
      }}
      plugins={FLOW_PLUGINS}
      willChange
      spinTiming={FLOW_SPIN}
      transformTiming={FLOW_SPIN}
      opacityTiming={{ duration: 180, easing: "ease-out" }}
    />
  );
}

function FlowTimerPart({ value }: { value: string }) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return <span>{value}</span>;
  }
  return (
    <NumberFlow
      className={styles.flowNum}
      value={n}
      locales="en-US"
      format={{
        minimumIntegerDigits: 2,
        maximumFractionDigits: 0,
        useGrouping: false,
      }}
      plugins={FLOW_PLUGINS}
      willChange
      spinTiming={{ duration: 280, easing: "cubic-bezier(0.16, 0.84, 0.22, 1)" }}
      transformTiming={{
        duration: 280,
        easing: "cubic-bezier(0.16, 0.84, 0.22, 1)",
      }}
      opacityTiming={{ duration: 160, easing: "ease-out" }}
    />
  );
}

function formatTimerParts(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return {
    mm: m.toString().padStart(2, "0"),
    ss: r.toString().padStart(2, "0"),
  };
}

function fmtMoney(n: number, cur: string): string {
  const digits = moneyDigits(cur, n);
  return n.toLocaleString(
    cur.toUpperCase() === "USD" || cur.toUpperCase() === "USDT" ? "en-US" : "ru-RU",
    { minimumFractionDigits: digits, maximumFractionDigits: digits },
  );
}

function fmtMs(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function RaceGame({
  initialPairKey,
  initialRoundMs,
}: {
  initialPairKey: string;
  initialRoundMs?: number;
}) {
  const { isAuth } = useAuth();
  const { currency } = useCurrency();
  const { t } = useLocale();
  const cur = currency || "KZT";
  const queryClient = useQueryClient();
  const router = useRouter();

  const [pairKey, setPairKey] = useState(initialPairKey);
  const [roundMs, setRoundMs] = useState(
    initialRoundMs === 900_000 ? 900_000 : 300_000,
  );
  const stakeStep = stakeStepForCurrency(cur);
  const holdStakeStep = holdStakeStepForCurrency(cur);
  const maxStake = maxStakeForCurrency(cur);
  const minStake = stakeStep;
  const [stake, setStake] = useState(() => presetsForCurrency("KZT")[1] ?? 2500);
  const [stakeEditing, setStakeEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [mergedA, setMergedA] = useState<RaceTick[]>([]);
  const [mergedB, setMergedB] = useState<RaceTick[]>([]);

  const pair: RacePairMeta = racePairFromKey(pairKey) ?? RACE_PAIRS[0]!;

  const nudgeStake = useCallback(
    (dir: 1 | -1, step: number) => {
      setStake((s) => Math.min(maxStake, Math.max(minStake, s + dir * step)));
    },
    [maxStake, minStake],
  );

  const holdTimers = useRef<{ delay: number | null; tick: number | null }>({
    delay: null,
    tick: null,
  });

  const clearStakeHold = useCallback(() => {
    const h = holdTimers.current;
    if (h.delay != null) window.clearTimeout(h.delay);
    if (h.tick != null) window.clearInterval(h.tick);
    h.delay = null;
    h.tick = null;
  }, []);

  useEffect(() => () => clearStakeHold(), [clearStakeHold]);

  const onStakeHoldStart = useCallback(
    (dir: 1 | -1) => (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* older browsers */
      }
      clearStakeHold();
      nudgeStake(dir, stakeStep);
      holdTimers.current.delay = window.setTimeout(() => {
        holdTimers.current.tick = window.setInterval(() => {
          nudgeStake(dir, holdStakeStep);
        }, 55);
      }, 360);
    },
    [clearStakeHold, nudgeStake, stakeStep, holdStakeStep],
  );

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  // Keep stake on a valid preset when wallet currency changes.
  useEffect(() => {
    const next = presetsForCurrency(cur);
    setStake((s) => (next.includes(s) ? s : (next[1] ?? next[0]!)));
  }, [cur]);

  // Reset tick ink when market switches — never blend ARB into OP history.
  useEffect(() => {
    setMergedA([]);
    setMergedB([]);
  }, [pair.key, roundMs]);

  const stateQuery = useQuery({
    queryKey: ["race-state", pair.key, roundMs],
    queryFn: () => fetchRaceState(pair.key, roundMs),
    refetchInterval: 300,
    staleTime: 150,
  });
  const state = stateQuery.data;

  useEffect(() => {
    const keepMs = Math.max(roundMs + 60_000, 360_000);
    setMergedA((prev) =>
      mergeRaceTicks(prev, state?.ticksA, state?.priceA, keepMs),
    );
    setMergedB((prev) =>
      mergeRaceTicks(prev, state?.ticksB, state?.priceB, keepMs),
    );
  }, [
    state?.ticksA,
    state?.ticksB,
    state?.priceA,
    state?.priceB,
    state?.serverNow,
    pair.key,
    roundMs,
  ]);

  const nowSkew = useMemo(() => {
    if (!state?.serverNow) return 0;
    return Date.parse(state.serverNow) - Date.now();
  }, [state?.serverNow]);
  const liveNow = now + nowSkew;

  const startsAtMs = state?.round?.startsAt ? Date.parse(state.round.startsAt) : liveNow;
  const endsAtMs = state?.round?.endsAt ? Date.parse(state.round.endsAt) : liveNow;
  const lockAtMs = endsAtMs - (state?.lockMs ?? 15_000);
  const msToLock = Math.max(0, lockAtMs - liveNow);
  const msToEnd = Math.max(0, endsAtMs - liveNow);
  const bettingOpen = (state?.bettingOpen ?? false) && msToLock > 0;

  const placeMut = useMutation({
    mutationFn: (side: "A" | "B") =>
      placeRaceBet(pair.key, side, stake, cur, roundMs),
    onSuccess: (bet: RaceBetDto) => {
      setFlash(
        t("trading.raceBetAccepted", {
          side: bet.side === "A" ? pair.shortA : pair.shortB,
          stake: fmtMoney(bet.stake, cur),
          cur,
          payout: fmtMoney(bet.potentialPayout, cur),
        }),
      );
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["user"] });
      void queryClient.invalidateQueries({ queryKey: ["race-state", pair.key, roundMs] });
      window.setTimeout(() => setFlash(null), 4500);
    },
    onError: (err: Error) => {
      if (err.message === "RACE_AUTH_REQUIRED") {
        setError(t("trading.raceLoginBets"));
      } else {
        setError(err.message || t("trading.raceBetFailed"));
      }
    },
  });

  const placeBet = (side: "A" | "B") => {
    unlockBetClickSound();
    playBetClickSound();
    if (!isAuth) {
      setError(t("trading.raceLoginBets"));
      return;
    }
    if (!bettingOpen) {
      setError(t("trading.raceBetsClosed"));
      return;
    }
    if (placeMut.isPending) return;
    setError(null);
    placeMut.mutate(side);
  };

  const switchPair = (key: string) => {
    router.push(`/trading/race/${racePairFromKey(key)?.slug ?? pair.slug}?round=${roundMs}`);
    setPairKey(key);
  };

  const pendingBets = (state?.myBets ?? []).filter((b) => b.status === "PENDING");
  const timerMs = bettingOpen ? msToLock : msToEnd;
  const timer = formatTimerParts(timerMs);
  const timerUrgent = timerMs > 0 && timerMs <= 15_000;

  return (
    <div className={styles.game} style={{ "--a": pair.colorA, "--b": pair.colorB, "--a-rgb": pair.colorRgbA, "--b-rgb": pair.colorRgbB } as React.CSSProperties}>
      <div className={styles.pairTabs}>
        <Link href="/trading" className={styles.backLink}>
          {t("trading.raceBackTrading")}
        </Link>
        {RACE_PAIRS.map((p) => (
          <button
            key={p.key}
            type="button"
            className={`${styles.pairTab} ${p.key === pair.key ? styles.pairTabActive : ""}`}
            onClick={() => switchPair(p.key)}
          >
            <span className={styles.pairTabLogos}>
              <Image src={p.logoA} alt="" width={18} height={18} />
              <Image src={p.logoB} alt="" width={18} height={18} />
            </span>
            {p.shortA}/{p.shortB}
          </button>
        ))}
      </div>

      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <div className={styles.logos}>
            <Image src={pair.logoA} alt="" width={36} height={36} className={styles.logoA} />
            <Image src={pair.logoB} alt="" width={36} height={36} className={styles.logoB} />
          </div>
          <div>
            <div className={styles.name}>{pair.name}</div>
            <div className={styles.tagline}>{pair.tagline}</div>
          </div>
        </div>
        <div className={styles.roundChips}>
          {ROUND_OPTIONS.map((r) => (
            <button
              key={r.ms}
              type="button"
              className={`${styles.roundChip} ${r.ms === roundMs ? styles.roundChipActive : ""}`}
              onClick={() => setRoundMs(r.ms)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.timerRow}>
        <span className={styles.timerLabel}>
          {bettingOpen ? t("trading.raceAccepting") : t("trading.raceClosed")}
        </span>
        <div
          className={`${styles.timer} ${!bettingOpen ? styles.timerLocked : ""} ${
            timerUrgent ? styles.timerUrgent : ""
          }`}
          aria-label={fmtMs(timerMs)}
        >
          <div className={styles.timerUnit}>
            <strong className={styles.timerValue}>
              <FlowTimerPart value={timer.mm} />
            </strong>
            <span className={styles.timerUnitLabel}>{t("trading.min")}</span>
          </div>
          <div className={styles.timerUnit}>
            <strong className={styles.timerValue}>
              <FlowTimerPart value={timer.ss} />
            </strong>
            <span className={styles.timerUnitLabel}>{t("trading.sec")}</span>
          </div>
        </div>
      </div>

      <RaceChart
        ticksA={mergedA.length ? mergedA : (state?.ticksA ?? [])}
        ticksB={mergedB.length ? mergedB : (state?.ticksB ?? [])}
        openA={state?.openPriceA ?? null}
        openB={state?.openPriceB ?? null}
        liveA={state?.priceA ?? null}
        liveB={state?.priceB ?? null}
        startsAtMs={startsAtMs}
        endsAtMs={endsAtMs}
        nowMs={liveNow}
        colorA={pair.colorA}
        colorB={pair.colorB}
        shortA={pair.shortA}
        shortB={pair.shortB}
        logoA={pair.logoA}
        logoB={pair.logoB}
      />

      <div className={styles.priceRow}>
        <div className={styles.priceCell}>
          <Image
            className={styles.priceIcon}
            src={pair.logoA}
            alt={pair.shortA}
            width={22}
            height={22}
          />
          <span className={styles.priceValue}>
            <FlowPrice value={state?.priceA ?? null} />
          </span>
        </div>
        <div className={styles.priceCell}>
          <Image
            className={styles.priceIcon}
            src={pair.logoB}
            alt={pair.shortB}
            width={22}
            height={22}
          />
          <span className={styles.priceValue}>
            <FlowPrice value={state?.priceB ?? null} />
          </span>
        </div>
      </div>

      {!isAuth ? (
        <div className={styles.statusCard}>
          <p>{t("trading.raceLoginPairs")}</p>
          <a href="/login" className={styles.statusLink}>
            {t("trading.login")}
          </a>
        </div>
      ) : null}

      <div className={styles.sizeRow}>
        <button
          type="button"
          aria-label="−"
          className={styles.sizeBtn}
          onPointerDown={onStakeHoldStart(-1)}
          onPointerUp={clearStakeHold}
          onPointerCancel={clearStakeHold}
          onLostPointerCapture={clearStakeHold}
          onContextMenu={(e) => e.preventDefault()}
        >
          −
        </button>
        {stakeEditing ? (
          <input
            className={styles.sizeInput}
            type="number"
            min={minStake}
            max={maxStake}
            step={stakeStep}
            value={stake}
            autoFocus
            onChange={(e) => setStake(Number(e.target.value) || 0)}
            onBlur={() => {
              setStake((s) =>
                Math.min(maxStake, Math.max(minStake, s || minStake)),
              );
              setStakeEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                (e.target as HTMLInputElement).blur();
              }
            }}
          />
        ) : (
          <button
            type="button"
            className={styles.sizeValue}
            onClick={() => setStakeEditing(true)}
            aria-label={formatMoneyAmount(stake, cur)}
          >
            <ScrubMoney
              value={stake}
              currency={cur}
              fractionDigits={moneyDigits(cur, stake)}
              className={styles.flowNum}
            />
          </button>
        )}
        <button
          type="button"
          aria-label="+"
          className={styles.sizeBtn}
          onPointerDown={onStakeHoldStart(1)}
          onPointerUp={clearStakeHold}
          onPointerCancel={clearStakeHold}
          onLostPointerCapture={clearStakeHold}
          onContextMenu={(e) => e.preventDefault()}
        >
          +
        </button>
      </div>

      <div className={styles.betButtons}>
        <button
          type="button"
          className={styles.betBtnA}
          disabled={!bettingOpen || placeMut.isPending}
          onClick={() => placeBet("A")}
        >
          <span className={styles.betBtnAsset}>
            <Image src={pair.logoA} alt="" width={22} height={22} />
            {t("trading.raceOvertake", { side: pair.shortA })}
          </span>
        </button>
        <button
          type="button"
          className={styles.betBtnB}
          disabled={!bettingOpen || placeMut.isPending}
          onClick={() => placeBet("B")}
        >
          <span className={styles.betBtnAsset}>
            <Image src={pair.logoB} alt="" width={22} height={22} />
            {t("trading.raceOvertake", { side: pair.shortB })}
          </span>
        </button>
      </div>

      {error ? <div className={styles.errorCard}>{error}</div> : null}
      {flash ? <div className={styles.flashCard}>{flash}</div> : null}

      {pendingBets.length ? (
        <div className={styles.pendingList}>
          <div className={styles.pendingTitle}>{t("trading.raceYourBets")}</div>
          {pendingBets.map((b) => (
            <div key={b.id} className={styles.pendingItem}>
              <span className={b.side === "A" ? styles.dotA : styles.dotB}>●</span>
              <span>{b.side === "A" ? pair.shortA : pair.shortB}</span>
              <span className={styles.pendingStake}>
                <ScrubMoney
                  value={b.stake}
                  currency={b.currencyCode}
                  fractionDigits={moneyDigits(b.currencyCode, b.stake)}
                  className={styles.flowNum}
                />
              </span>
              <span className={styles.pendingPayout}>
                →{" "}
                <ScrubMoney
                  value={b.potentialPayout}
                  currency={b.currencyCode}
                  fractionDigits={moneyDigits(
                    b.currencyCode,
                    b.potentialPayout,
                  )}
                  className={styles.flowNum}
                />
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <div className={styles.rule}>
        <p>{t("trading.raceRuleWin")}</p>
        <p>{t("trading.raceRuleDraw")}</p>
      </div>
    </div>
  );
}
