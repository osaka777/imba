"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "~/app/providers/AuthProvider";
import {
  cashoutSnakeRound,
  crashSnakeRound,
  fetchActiveSnakeRound,
  fetchSnakeConfig,
  fetchSnakeHistory,
  heartbeatSnakeRound,
  placeSnakeRound,
  type SnakeConfig,
  type SnakeRoundDto,
} from "~/entities/snake/api/client";
import { computeSnakeMultiplier, computeSnakePayout } from "~/entities/snake/lib/multiplier";
import {
  computeBoostBurnAmount,
  createWorld,
  drawMinimap,
  drawWorld,
  startWorld,
  tickWorld,
  type SnakeWorld,
} from "~/entities/snake/lib/snakeEngine";
import {
  isSnakeMusicOn,
  isSnakeMuted,
  playBoostTickSound,
  playDieSound,
  playEatSound,
  playWinSound,
  setSnakeMusic,
  setSnakeMuted,
  unlockSnakeAudio,
} from "~/entities/snake/lib/sfx";
import { useCurrency } from "~/shared/model/useCurrency";

import styles from "./SnakeGame.module.css";
import { toIntlLocale } from "~/shared/i18n/format";
import { useLocale } from "~/shared/model/useLocale";

type Phase = "idle" | "playing" | "cashed" | "lost";

const PRESETS = [100, 500, 1000, 5000];

function syncWorldClock(world: SnakeWorld, round: SnakeRoundDto) {
  const serverNow = round.serverNow ? Date.parse(round.serverNow) : Date.now();
  const started = Date.parse(round.startedAt);
  const elapsed = Math.max(0, serverNow - started);
  world.startedAt = performance.now() - elapsed;
}

export function SnakeGame() {
  const { t, locale } = useLocale();
  const { isAuth } = useAuth();
  const { currency } = useCurrency();
  const queryClient = useQueryClient();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<SnakeWorld | null>(null);
  const roundRef = useRef<SnakeRoundDto | null>(null);
  const phaseRef = useRef<Phase>("idle");
  const stakeRef = useRef(500);
  const rafRef = useRef(0);
  const lastTs = useRef(0);
  const settlingRef = useRef(false);
  const viewSize = useRef({ w: 800, h: 600 });
  const hudTick = useRef(0);
  const boostSfxAcc = useRef(0);
  const keysBoost = useRef(false);
  const heartbeatAcc = useRef(0);
  const lastStats = useRef({ length: 16, kills: 0, boostMs: 0, burned: 0, mult: 1, payout: 0 });

  const [config, setConfig] = useState<SnakeConfig | null>(null);
  const [stake, setStake] = useState(500);
  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState<SnakeRoundDto | null>(null);
  const [mult, setMult] = useState(1);
  const [payoutPreview, setPayoutPreview] = useState(0);
  const [burnedPreview, setBurnedPreview] = useState(0);
  const [length, setLength] = useState(16);
  const [kills, setKills] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingResume, setPendingResume] = useState<SnakeRoundDto | null>(null);
  const [history, setHistory] = useState<SnakeRoundDto[]>([]);
  const [soundOn, setSoundOn] = useState(!isSnakeMuted());
  const [musicOn, setMusicOnState] = useState(isSnakeMusicOn());
  const [board, setBoard] = useState<{ name: string; len: number; you: boolean }[]>([]);
  const [endStats, setEndStats] = useState<{
    mult: number;
    length: number;
    kills: number;
    burned: number;
    payout: number;
    stake: number;
    won: boolean;
  } | null>(null);

  const reloadHistory = useCallback(() => {
    if (!isAuth) return;
    fetchSnakeHistory(5).then(setHistory).catch(() => undefined);
  }, [isAuth]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    roundRef.current = round;
  }, [round]);
  useEffect(() => {
    stakeRef.current = stake;
  }, [stake]);

  useEffect(() => {
    fetchSnakeConfig()
      .then((c) => {
        setConfig(c);
        setStake((s) => Math.max(c.minStake, Math.min(c.maxStake, s)));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    reloadHistory();
  }, [reloadHistory]);

  const beginLocalGame = useCallback((active: SnakeRoundDto) => {
    unlockSnakeAudio();
    const world = createWorld();
    startWorld(world, active.stake);
    syncWorldClock(world, active);
    world.aimX = 120;
    world.aimY = 0;
    worldRef.current = world;
    setRound(active);
    roundRef.current = active;
    setPhase("playing");
    phaseRef.current = "playing";
    setPendingResume(null);
    setError(null);
    setEndStats(null);
    setStake(active.stake);
    setBurnedPreview(0);
    const elapsed = performance.now() - world.startedAt;
    const m = computeSnakeMultiplier(elapsed, world.player.segments.length, 0);
    setMult(m);
    setPayoutPreview(computeSnakePayout(active.stake, m, 0, elapsed));
    setLength(world.player.segments.length);
    setKills(0);
    settlingRef.current = false;
    heartbeatAcc.current = 0;
  }, []);

  useEffect(() => {
    if (!isAuth) {
      setPendingResume(null);
      return;
    }
    let cancelled = false;
    fetchActiveSnakeRound()
      .then((active) => {
        if (cancelled || !active || active.status !== "PENDING") return;
        setPendingResume(active);
        setStake(active.stake);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isAuth]);

  const finishRoundUi = useCallback((
    res: SnakeRoundDto,
    kind: "cashed" | "lost",
    world: SnakeWorld | null,
  ) => {
    const stakeAmt = res.stake;
    const m = res.multiplier ?? lastStats.current.mult;
    const len = res.lengthAtEnd ?? world?.player.segments.length ?? lastStats.current.length;
    const k = res.killsAtEnd ?? world?.player.killCount ?? lastStats.current.kills;
    const burned = computeBoostBurnAmount(
      stakeAmt,
      Math.min(0.85, ((res.boostMs ?? world?.boostMs ?? 0) / 1000) * 0.08),
    );
    setRound(res);
    roundRef.current = res;
    setPhase(kind);
    phaseRef.current = kind;
    setPendingResume(null);
    setMult(m);
    setEndStats({
      mult: m,
      length: len,
      kills: k,
      burned,
      payout: res.payout ?? 0,
      stake: stakeAmt,
      won: kind === "cashed",
    });
    reloadHistory();
    void queryClient.invalidateQueries({ queryKey: ["user"] });
  }, [queryClient, reloadHistory]);

  const reportCrash = useCallback(async (world: SnakeWorld, active: SnakeRoundDto) => {
    if (settlingRef.current) return;
    settlingRef.current = true;
    playDieSound();
    try {
      const res = await crashSnakeRound(
        active.id,
        world.player.segments.length,
        world.player.killCount,
        Math.floor(world.boostMs),
      );
      finishRoundUi(res, "lost", world);
    } catch (e) {
      setError((e as Error).message);
      settlingRef.current = false;
    }
  }, [finishRoundUi]);

  const onForfeit = async () => {
    const active = pendingResume || roundRef.current;
    if (!active || active.status !== "PENDING") return;
    setBusy(true);
    setError(null);
    try {
      const res = await crashSnakeRound(active.id, 14, 0, 0);
      if (worldRef.current) {
        worldRef.current.running = false;
        worldRef.current.ended = true;
      }
      finishRoundUi(res, "lost", worldRef.current);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const updateAimFromClient = useCallback((clientX: number, clientY: number) => {
    const stage = stageRef.current;
    const world = worldRef.current;
    if (!stage || !world) return;
    const rect = stage.getBoundingClientRect();
    world.aimX = clientX - (rect.left + rect.width / 2);
    world.aimY = clientY - (rect.top + rect.height / 2);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    if (!worldRef.current) worldRef.current = createWorld();

    const resize = () => {
      const w = stage.clientWidth || window.innerWidth;
      const h = stage.clientHeight || window.innerHeight;
      viewSize.current = { w, h };
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const onMove = (e: PointerEvent) => updateAimFromClient(e.clientX, e.clientY);
    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("button, input, a, label")) return;
      unlockSnakeAudio();
      updateAimFromClient(e.clientX, e.clientY);
      const world = worldRef.current;
      if (world && phaseRef.current === "playing") world.boosting = true;
    };
    const onUp = () => {
      const world = worldRef.current;
      if (world) world.boosting = keysBoost.current;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const world = worldRef.current;
      if (e.code === "Space") {
        e.preventDefault();
        keysBoost.current = true;
        if (world && phaseRef.current === "playing") world.boosting = true;
        return;
      }
      if (!world || phaseRef.current !== "playing") return;
      const step = 120;
      if (e.code === "KeyW" || e.code === "ArrowUp") world.aimY = -step;
      if (e.code === "KeyS" || e.code === "ArrowDown") world.aimY = step;
      if (e.code === "KeyA" || e.code === "ArrowLeft") world.aimX = -step;
      if (e.code === "KeyD" || e.code === "ArrowRight") world.aimX = step;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        keysBoost.current = false;
        const world = worldRef.current;
        if (world) world.boosting = false;
      }
    };

    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("blur", onUp);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    const loop = (ts: number) => {
      const world = worldRef.current;
      const ctx = canvas.getContext("2d");
      if (!world || !ctx) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      const dt = lastTs.current ? Math.min(34, ts - lastTs.current) : 16;
      lastTs.current = ts;

      if (world.running) {
        tickWorld(world, dt);
        if (world.eatsPending > 0) {
          const n = Math.min(world.eatsPending, 4);
          for (let i = 0; i < n; i++) playEatSound();
          world.eatsPending = 0;
        }
        if (world.boosting) {
          boostSfxAcc.current += dt;
          if (boostSfxAcc.current > 140) {
            boostSfxAcc.current = 0;
            playBoostTickSound();
          }
        }
        heartbeatAcc.current += dt;
        if (heartbeatAcc.current > 450 && roundRef.current?.status === "PENDING") {
          heartbeatAcc.current = 0;
          const r = roundRef.current;
          void heartbeatSnakeRound(
            r.id,
            world.boosting,
            world.player.segments.length,
            world.player.killCount,
          ).catch(() => undefined);
        }
        hudTick.current += dt;
        if (hudTick.current > 80) {
          hudTick.current = 0;
          const elapsed = performance.now() - world.startedAt;
          const len = world.player.segments.length;
          const k = world.player.killCount;
          const m = computeSnakeMultiplier(elapsed, len, k);
          const stakeNow = roundRef.current?.stake ?? stakeRef.current;
          const burn = computeBoostBurnAmount(stakeNow, world.burnFraction);
          const pay = computeSnakePayout(stakeNow, m, world.boostMs, elapsed);
          lastStats.current = {
            length: len,
            kills: k,
            boostMs: world.boostMs,
            burned: burn,
            mult: m,
            payout: pay,
          };
          setMult(m);
          setLength(len);
          setKills(k);
          setBurnedPreview(burn);
          setPayoutPreview(pay);
          setBoard(
            [
              { name: "You", len, you: true },
              ...world.bots
                .filter((b) => b.alive)
                .map((b) => ({ name: b.name, len: b.segments.length, you: false })),
            ]
              .sort((a, b) => b.len - a.len)
              .slice(0, 8),
          );
        }
        if (world.ended && roundRef.current?.status === "PENDING") {
          void reportCrash(world, roundRef.current);
        }
      }

      drawWorld(ctx, world, viewSize.current.w, viewSize.current.h);
      if (phaseRef.current === "playing") {
        drawMinimap(ctx, world, viewSize.current.w, viewSize.current.h);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("resize", resize);
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("blur", onUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      cancelAnimationFrame(rafRef.current);
    };
  }, [reportCrash, updateAimFromClient]);

  const onPlay = async () => {
    setError(null);
    setEndStats(null);
    unlockSnakeAudio();
    if (!isAuth) {
      setError(t("promo.snakeLoginRequired"));
      return;
    }
    if (pendingResume) {
      beginLocalGame(pendingResume);
      return;
    }
    setBusy(true);
    settlingRef.current = false;
    try {
      const placed = await placeSnakeRound(stake, currency || "KZT");
      beginLocalGame(placed);
      void queryClient.invalidateQueries({ queryKey: ["user"] });
    } catch (e) {
      const msg = (e as Error).message;
      if (/active Snake round/i.test(msg)) {
        try {
          const active = await fetchActiveSnakeRound();
          if (active) {
            setPendingResume(active);
            setStake(active.stake);
            setError(null);
            return;
          }
        } catch {
          /* ignore */
        }
      }
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const onCashout = async () => {
    const active = roundRef.current;
    const world = worldRef.current;
    if (!active || phaseRef.current !== "playing" || !world) return;
    if (settlingRef.current) return;
    settlingRef.current = true;
    setBusy(true);
    setError(null);
    try {
      world.running = false;
      const res = await cashoutSnakeRound(
        active.id,
        world.player.segments.length,
        world.player.killCount,
        Math.floor(world.boostMs),
      );
      playWinSound();
      finishRoundUi(res, "cashed", world);
    } catch (e) {
      setError((e as Error).message);
      if (worldRef.current) worldRef.current.running = true;
      settlingRef.current = false;
    } finally {
      setBusy(false);
    }
  };

  const onPlayAgain = () => {
    setEndStats(null);
    setPhase("idle");
    phaseRef.current = "idle";
    setRound(null);
    roundRef.current = null;
    settlingRef.current = false;
    void onPlay();
  };

  const minStake = config?.minStake ?? 100;
  const showResume = Boolean(pendingResume) && phase !== "playing";
  const showLobby = phase !== "playing" && !endStats;

  return (
    <div className={styles.root}>
      <div
        ref={stageRef}
        className={styles.stage}
        onContextMenu={(e) => e.preventDefault()}
      >
        <canvas ref={canvasRef} className={styles.canvas} />

        <button
          type="button"
          className={`${styles.muteFab} ${soundOn ? styles.muteOn : ""}`}
          onClick={() => {
            const next = !soundOn;
            setSoundOn(next);
            setSnakeMuted(!next);
            unlockSnakeAudio();
          }}
          aria-label={t("promo.snakeSoundAria")}
        >
          {soundOn ? "♪" : "🔇"}
        </button>

        {phase === "playing" && (
          <>
            <div className={styles.lb}>
              {board.slice(0, 6).map((row, idx) => (
                <div key={`${row.name}-${idx}`} className={row.you ? styles.lbYou : undefined}>
                  <i>{idx + 1}</i>
                  <span>{row.name}</span>
                  <b>{row.len}</b>
                </div>
              ))}
            </div>

            <div className={styles.hudCenter}>
              <div className={styles.x}>×{mult.toFixed(2)}</div>
              <div className={styles.money}>
                {payoutPreview.toLocaleString("ru-RU")} {currency || "KZT"}
              </div>
              {burnedPreview > 0 && (
                <div className={styles.burn}>−{burnedPreview.toLocaleString("ru-RU")}</div>
              )}
            </div>

            <div className={styles.hudBottom}>
              <div className={styles.chips}>
                <span>{length}</span>
                <span>{kills} kills</span>
              </div>
              <button
                type="button"
                className={styles.cash}
                disabled={busy}
                onClick={() => void onCashout()}
              >
                Cash out
              </button>
            </div>
          </>
        )}

        {endStats && (
          <div className={styles.end}>
            <div className={styles.endInner}>
              <p className={styles.endEyebrow}>{endStats.won ? "Cashed out" : "Dead"}</p>
              <h2 className={styles.endX}>×{endStats.mult.toFixed(2)}</h2>
              <p className={styles.endPay}>
                {endStats.won
                  ? `+${endStats.payout.toLocaleString("ru-RU")} ${currency || "KZT"}`
                  : `−${endStats.stake.toLocaleString("ru-RU")} ${currency || "KZT"}`}
              </p>
              <div className={styles.endMeta}>
                <span>len {endStats.length}</span>
                <span>kills {endStats.kills}</span>
                {endStats.burned > 0 && <span>burn −{endStats.burned.toLocaleString("ru-RU")}</span>}
              </div>
              <button
                type="button"
                className={styles.again}
                disabled={busy}
                onClick={() => onPlayAgain()}
              >
                Play again
              </button>
              <button
                type="button"
                className={styles.ghost}
                onClick={() => {
                  setEndStats(null);
                  setPhase("idle");
                  phaseRef.current = "idle";
                }}
              >
                Change bet
              </button>
            </div>
          </div>
        )}

        {showLobby && (
          <div className={styles.lobby}>
            <h1 className={styles.logo}>snake<span>.bet</span></h1>

            <div className={styles.panel}>
              {showResume ? (
                <div className={styles.resumeBox}>
                  <p>{t("promo.snakeOpenRound", { stake: stake.toLocaleString(toIntlLocale(locale)), currency: currency || "KZT" })}</p>
                  <div className={styles.resumeActions}>
                    <button
                      type="button"
                      className={styles.play}
                      disabled={busy}
                      onClick={() => beginLocalGame(pendingResume!)}
                    >
                      Continue
                    </button>
                    <button
                      type="button"
                      className={styles.ghost}
                      disabled={busy}
                      onClick={() => void onForfeit()}
                    >
                      Forfeit
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className={styles.stakeRow}>
                    <input
                      className={styles.stakeInput}
                      type="number"
                      min={minStake}
                      max={config?.maxStake ?? 1_000_000}
                      value={stake}
                      disabled={busy}
                      onChange={(e) => setStake(Number(e.target.value))}
                      aria-label={t("promo.snakeStakeAria")}
                    />
                    <span className={styles.ccy}>{currency || "KZT"}</span>
                  </div>
                  <div className={styles.presets}>
                    {PRESETS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={stake === p ? styles.presetOn : undefined}
                        disabled={busy}
                        onClick={() => setStake(p)}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className={styles.play}
                    disabled={busy}
                    onClick={() => void onPlay()}
                  >
                    {busy ? "…" : "Play"}
                  </button>
                </>
              )}

              {error && <p className={styles.err}>{error}</p>}
            </div>

            <p className={styles.hint}>Hold click / Space to boost · burns cash</p>

            {history.length > 0 && (
              <div className={styles.hist}>
                {history.map((h) => (
                  <span
                    key={h.id}
                    className={h.status === "CASHED_OUT" ? styles.hWin : styles.hLose}
                  >
                    {h.status === "CASHED_OUT" ? "+" : "−"}
                    {(h.status === "CASHED_OUT" ? h.payout : h.stake)?.toLocaleString("ru-RU")}
                  </span>
                ))}
              </div>
            )}

            <button
              type="button"
              className={styles.musicTiny}
              onClick={() => {
                const next = !musicOn;
                setMusicOnState(next);
                setSnakeMusic(next);
              }}
            >
              {musicOn ? "Music on" : "Music off"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
