"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import { useAuth } from "~/app/providers/AuthProvider";
import { getUser } from "~/entities/user/api/getUser";
import { displayNameMax6 } from "~/entities/user/lib/nickname";
import { EditableAvatar } from "~/entities/user/ui/EditableAvatar/EditableAvatar";
import { toIntlLocale } from "~/shared/i18n/format";
import type { AppLocale } from "~/shared/i18n/locale";
import { safeToast } from "~/shared/lib/safeToast";
import { useCurrency } from "~/shared/model/useCurrency";
import { useLocale } from "~/shared/model/useLocale";

import { fetchBtcPublicTrader } from "../api/client";
import { ScrubMoney, formatMoneyAmount } from "./FlipDigits";
import {
  fetchPredictionPublicTrader,
  type PredictionPublicTraderDto,
} from "~/entities/prediction/api/client";
import { resolvePredictionMediaUrl } from "~/entities/prediction/lib/mediaUrl";
import { pickPredictionText } from "~/entities/prediction/lib/i18nText";

import styles from "./TraderProfile.module.css";

type PnlRange = "1d" | "1w" | "1m" | "1y" | "ytd" | "all";
type PnlPoint = { t: number; v: number };
type ProfileMode = "events" | "trading";
type PositionsFilter = "active" | "closed";
type EventsPanel = "positions" | "activity";

type ActivityBet = {
  id: number;
  side: string;
  symbol: string;
  roundMs: number;
  stake: number;
  payout: number;
  pnl: number;
  status: string;
  settledAt: string | null;
};

type DrumItem = ActivityBet & { key: string };

function samplePnl(points: PnlPoint[], fi: number): PnlPoint {
  const i0 = Math.max(0, Math.min(points.length - 1, Math.floor(fi)));
  const i1 = Math.min(points.length - 1, i0 + 1);
  const f = Math.max(0, Math.min(1, fi - i0));
  const a = points[i0]!;
  const b = points[i1]!;
  return {
    t: a.t + (b.t - a.t) * f,
    v: a.v + (b.v - a.v) * f,
  };
}

function formatPnlStamp(t: number, locale: AppLocale) {
  return new Date(t).toLocaleString(toIntlLocale(locale), {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function TraderPnlChart({
  points,
  scrubIndex,
  onScrub,
}: {
  points: PnlPoint[];
  scrubIndex: number | null;
  onScrub: (index: number | null) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const uid = useId().replace(/:/g, "");
  const w = 560;
  const h = 180;
  const pad = 6;
  const vals = points.length ? points.map((p) => p.v) : [0];
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = Math.max(1e-9, max - min);
  const coords =
    points.length < 2
      ? [
          [pad, h / 2] as const,
          [w - pad, h / 2] as const,
        ]
      : points.map((p, i) => {
          const x = pad + (i / Math.max(1, points.length - 1)) * (w - pad * 2);
          const y = pad + (1 - (p.v - min) / span) * (h - pad * 2);
          return [x, y] as const;
        });
  const d = coords
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const last = coords[coords.length - 1]!;
  const fill = `${d} L${last[0].toFixed(1)} ${h} L${coords[0]![0].toFixed(1)} ${h} Z`;

  const scrub = (() => {
    if (scrubIndex == null || coords.length === 0) return null;
    const i0 = Math.max(0, Math.min(coords.length - 1, Math.floor(scrubIndex)));
    const i1 = Math.min(coords.length - 1, i0 + 1);
    const f = Math.max(0, Math.min(1, scrubIndex - i0));
    const a = coords[i0]!;
    const b = coords[i1]!;
    const x = a[0] + (b[0] - a[0]) * f;
    const y = a[1] + (b[1] - a[1]) * f;
    return {
      x,
      left: (x / w) * 100,
      top: (y / h) * 100,
    };
  })();

  function indexFromClientX(clientX: number) {
    const el = wrapRef.current;
    if (!el || points.length < 2) return 0;
    const rect = el.getBoundingClientRect();
    const x = Math.max(
      0,
      Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)),
    );
    return x * (points.length - 1);
  }

  const lineGrad = `traderLineGrad-${uid}`;
  const fillGrad = `traderFillGrad-${uid}`;
  const clipId = `traderClip-${uid}`;

  return (
    <div
      ref={wrapRef}
      className={`${styles.chartWrap} ${scrub ? styles.chartScrubbing : ""}`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        onScrub(indexFromClientX(e.clientX));
      }}
      onPointerMove={(e) => {
        if (
          e.pointerType === "mouse" ||
          e.currentTarget.hasPointerCapture(e.pointerId)
        ) {
          onScrub(indexFromClientX(e.clientX));
        }
      }}
      onPointerUp={(e) => {
        if (e.pointerType !== "mouse") onScrub(null);
      }}
      onPointerLeave={() => onScrub(null)}
      onPointerCancel={() => onScrub(null)}
    >
      <svg
        className={styles.chart}
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id={lineGrad} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="55%" stopColor="#4f7fd6" />
            <stop offset="100%" stopColor="#6b5fd4" />
          </linearGradient>
          <linearGradient id={fillGrad} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(79, 127, 214, 0.28)" />
            <stop offset="100%" stopColor="rgba(30, 40, 63, 0.05)" />
          </linearGradient>
          {scrub ? (
            <clipPath id={clipId}>
              <rect x="0" y="0" width={scrub.x} height={h} />
            </clipPath>
          ) : null}
        </defs>

        {/* Ghost full path — visible while scrubbing (Polymarket fade-right). */}
        <g className={styles.chartGhost} opacity={scrub ? 0.2 : 1}>
          <path d={fill} fill={`url(#${fillGrad})`} />
          <path
            d={d}
            fill="none"
            stroke={`url(#${lineGrad})`}
            strokeWidth="2.2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>

        {/* Bright clipped portion up to cursor. */}
        {scrub ? (
          <g clipPath={`url(#${clipId})`}>
            <path d={fill} fill={`url(#${fillGrad})`} />
            <path
              d={d}
              fill="none"
              stroke={`url(#${lineGrad})`}
              strokeWidth="2.4"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ) : null}
      </svg>
      {scrub ? (
        <>
          <i
            className={styles.scrubLine}
            style={{ left: `${scrub.left}%` }}
            aria-hidden
          />
          <i
            className={styles.scrubDot}
            style={{
              left: `${scrub.left}%`,
              top: `${scrub.top}%`,
            }}
            aria-hidden
          />
        </>
      ) : null}
    </div>
  );
}

function assetShort(symbol: string) {
  return symbol.replace(/USDT$/i, "");
}

function roundLabel(ms: number, t: (k: string) => string) {
  if (ms <= 60_000) return t("trading.round1m");
  if (ms <= 300_000) return t("trading.round5m");
  return t("trading.round15m");
}

const DRUM_VISIBLE = 6;
const DRUM_BUFFER = 10;

function ActivityDrum({
  bets,
  currency,
  isUsd,
  locale,
  t,
}: {
  bets: ActivityBet[];
  currency: string;
  isUsd: boolean;
  locale: AppLocale;
  t: (k: string) => string;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const cursor = useRef(0);
  const paused = useRef(false);
  const [items, setItems] = useState<DrumItem[]>(() =>
    bets.slice(0, DRUM_BUFFER).map((b, i) => ({
      ...b,
      key: `${b.id}-i${i}`,
    })),
  );

  useEffect(() => {
    cursor.current = Math.min(DRUM_BUFFER, bets.length);
    setItems(
      bets.slice(0, DRUM_BUFFER).map((b, i) => ({
        ...b,
        key: `${b.id}-i${i}`,
      })),
    );
  }, [bets]);

  useEffect(() => {
    if (bets.length <= DRUM_VISIBLE) return;

    let timer = 0;
    let alive = true;
    let spinNo = 0;

    const nextBet = (): DrumItem => {
      const i = cursor.current % bets.length;
      cursor.current += 1;
      spinNo += 1;
      const b = bets[i]!;
      return { ...b, key: `${b.id}-s${spinNo}` };
    };

    const spin = (burst: number) => {
      if (paused.current) return;
      const list = listRef.current;
      if (!list) return;

      const first = list.firstElementChild as HTMLElement | null;
      const rowH = first?.offsetHeight ?? 52;
      const stylesCss = getComputedStyle(list);
      const gap =
        Number.parseFloat(stylesCss.rowGap || stylesCss.gap || "0") || 0;
      const step = (rowH + gap) * burst;

      list.style.transition = "none";
      list.style.transform = `translate3d(0, ${-step}px, 0)`;

      setItems((prev) => {
        const added = Array.from({ length: burst }, nextBet);
        return [...added, ...prev].slice(0, DRUM_BUFFER);
      });

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!alive || !listRef.current) return;
          listRef.current.style.transition =
            "transform 0.45s cubic-bezier(0.16, 0.86, 0.18, 1.05)";
          listRef.current.style.transform = "translate3d(0, 0, 0)";
        });
      });
    };

    const tick = () => {
      if (!alive) return;
      if (!paused.current) spin(1);
      timer = window.setTimeout(tick, 1600 + Math.random() * 900);
    };

    timer = window.setTimeout(tick, 900);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [bets]);

  return (
    <div
      className={styles.activityDrum}
      aria-label={t("trading.traderActivity")}
      onPointerEnter={() => {
        paused.current = true;
      }}
      onPointerLeave={() => {
        paused.current = false;
      }}
    >
      <ul ref={listRef} className={styles.activityList}>
        {items.map((b, i) => {
          const up = b.pnl >= 0;
          const tNorm = i / Math.max(items.length - 1, 1);
          const face = Math.cos((tNorm - 0.1) * Math.PI * 0.95);
          const o = Math.max(0.22, 0.38 + face * 0.62);
          const s = Math.max(0.9, 0.93 + face * 0.07);
          const blur = Math.max(0, (1 - face) * 0.45);
          return (
            <li
              key={b.key}
              className={`${styles.activityRow} ${i < 1 ? styles.activityFresh : ""}`}
              style={
                {
                  "--drum-o": o,
                  "--drum-s": s,
                  "--drum-b": `${blur}px`,
                } as CSSProperties
              }
            >
              <div className={styles.activityMain}>
                <span
                  className={b.side === "UP" ? styles.sideUp : styles.sideDown}
                >
                  {b.side === "UP" ? "↑" : "↓"} {assetShort(b.symbol)}
                </span>
                <span className={styles.activityMeta}>
                  {roundLabel(b.roundMs, t)} ·{" "}
                  {b.settledAt
                    ? new Date(b.settledAt).toLocaleString(
                        locale === "ru" ? "ru-RU" : "en-US",
                        {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )
                    : "—"}
                </span>
              </div>
              <span className={up ? styles.pnlUp : styles.pnlDown}>
                {formatMoneyAmount(Math.abs(b.pnl), currency, isUsd ? 2 : 0)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function TraderProfile({ idOrNick }: { idOrNick: string }) {
  const { t, locale } = useLocale();
  const { currency } = useCurrency();
  const { isAuth } = useAuth();
  const cur = (currency || "KZT").toUpperCase();
  const [mode, setMode] = useState<ProfileMode>("events");
  const [range, setRange] = useState<PnlRange>("1d");
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [eventsPanel, setEventsPanel] = useState<EventsPanel>("positions");
  const [posFilter, setPosFilter] = useState<PositionsFilter>("active");
  const isUsd = cur === "USD" || cur === "USDT";

  const meQuery = useQuery({
    queryKey: ["user-me-for-trader"],
    queryFn: getUser,
    enabled: isAuth,
    staleTime: 60_000,
  });

  const ranges = useMemo(
    () =>
      (
        [
          ["1d", "trading.pnlRange1d", "trading.pnlSub1d"],
          ["1w", "trading.pnlRange1w", "trading.pnlSub1w"],
          ["1m", "trading.pnlRange1m", "trading.pnlSub1m"],
          ["1y", "trading.pnlRange1y", "trading.pnlSub1y"],
          ["ytd", "trading.pnlRangeYtd", "trading.pnlSubYtd"],
          ["all", "trading.pnlRangeAll", "trading.pnlSubAll"],
        ] as const
      ).map(([id, labelKey, subKey]) => ({
        id: id as PnlRange,
        label: t(labelKey),
        sub: t(subKey),
      })),
    [t],
  );

  const tradingQuery = useQuery({
    queryKey: ["btc-trader", idOrNick, range, cur],
    queryFn: () => fetchBtcPublicTrader(idOrNick, range, cur),
    enabled: Boolean(idOrNick) && mode === "trading",
    staleTime: 8_000,
    refetchInterval: 20_000,
  });

  const eventsQuery = useQuery({
    queryKey: ["prediction-trader", idOrNick, range, cur],
    queryFn: () => fetchPredictionPublicTrader(idOrNick, range, cur),
    enabled: Boolean(idOrNick) && mode === "events",
    staleTime: 8_000,
    refetchInterval: 20_000,
  });

  /* Resolve user identity even when the inactive tab has no data yet. */
  const bootstrapQuery = useQuery({
    queryKey: ["prediction-trader-bootstrap", idOrNick, cur],
    queryFn: () => fetchPredictionPublicTrader(idOrNick, "all", cur),
    enabled: Boolean(idOrNick),
    staleTime: 30_000,
  });

  const data = mode === "events" ? eventsQuery.data : tradingQuery.data;
  const query = mode === "events" ? eventsQuery : tradingQuery;
  const eventsData = (eventsQuery.data ??
    bootstrapQuery.data) as PredictionPublicTraderDto | undefined;
  const summary = data?.summary;
  const points = data?.series ?? [];
  const total = summary?.pnl ?? 0;
  const scrubbed =
    scrubIndex != null && points.length > 1
      ? samplePnl(points, scrubIndex)
      : null;
  const display = scrubbed?.v ?? total;
  const positive = display >= 0;
  const meta = ranges.find((r) => r.id === range) ?? ranges[0]!;
  const sub =
    scrubbed != null ? formatPnlStamp(scrubbed.t, locale) : meta.sub;
  const user = data?.user ?? bootstrapQuery.data?.user ?? tradingQuery.data?.user;
  const liveSrc = avatarUrl ?? user?.avatarUrl ?? null;
  const displayName = displayNameMax6(user?.name);
  const isOwn = Boolean(
    isAuth && user?.id != null && meQuery.data?.id === user.id,
  );

  const shareProfile = async () => {
    const url =
      typeof window !== "undefined"
        ? window.location.href
        : `https://imba.bet/user/${encodeURIComponent(idOrNick)}`;
    const title = displayName || "Imba";
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title, text: title, url });
        return;
      }
    } catch {
      /* fall through to clipboard */
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 1800);
      safeToast.success(t("trading.copied"));
    } catch {
      safeToast.error(t("trading.copyFailed"));
    }
  };

  if (query.isError && bootstrapQuery.isError && tradingQuery.isError) {
    return (
      <div className={styles.page}>
        <div className={styles.empty}>
          <p>{t("trading.traderNotFound")}</p>
          <Link href="/markets" className={styles.backLink}>
            ← {t("prediction.brand")}
          </Link>
        </div>
      </div>
    );
  }

  const joined = user?.joinedAt
    ? new Date(user.joinedAt).toLocaleDateString(
        locale === "ru" ? "ru-RU" : "en-US",
        { year: "numeric", month: "short" },
      )
    : null;

  const eventsSummary = eventsData?.summary;
  const positions = eventsData?.positions ?? [];
  const closed = eventsData?.closed ?? [];
  const eventsRecent = eventsData?.recent ?? [];

  return (
    <div className={styles.page}>
      <Link href="/markets" className={styles.backLink}>
        ← {t("prediction.brand")}
      </Link>

      <div className={styles.modeTabs} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "events"}
          className={mode === "events" ? styles.modeOn : styles.modeBtn}
          onClick={() => {
            setMode("events");
            setScrubIndex(null);
          }}
        >
          {t("prediction.profileTabEvents")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "trading"}
          className={mode === "trading" ? styles.modeOn : styles.modeBtn}
          onClick={() => {
            setMode("trading");
            setScrubIndex(null);
          }}
        >
          {t("prediction.profileTabTrading")}
        </button>
      </div>

      <div className={styles.topGrid}>
        <section className={styles.infoCard}>
          <div className={styles.infoHead}>
            <EditableAvatar
              name={displayName || user?.name}
              preset={user?.avatarPreset}
              src={liveSrc}
              userId={user?.id}
              size={56}
              editable={isOwn}
              className={styles.heroAvatar}
              onAvatarChange={setAvatarUrl}
            />
            <div className={styles.infoText}>
              <div className={styles.nameRow}>
                <h1 className={styles.name}>{displayName || "…"}</h1>
                <div className={styles.infoActions}>
                  <button
                    type="button"
                    className={styles.shareBtn}
                    onClick={() => void shareProfile()}
                    aria-label={
                      shareCopied ? t("trading.copied") : t("trading.share")
                    }
                    title={
                      shareCopied ? t("trading.copied") : t("trading.share")
                    }
                  >
                    {shareCopied ? (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden
                      >
                        <path
                          d="M5 12.5 9.5 17 19 7.5"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden
                      >
                        <path
                          d="M12 3v12"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        <path
                          d="M7.5 7.5 12 3l4.5 4.5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M5 14v4.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V14"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              <p className={styles.joined}>
                {joined
                  ? t("trading.traderJoined", { date: joined })
                  : t("trading.publicPnlLoading")}
              </p>
            </div>
          </div>

          <div className={styles.stats}>
            {mode === "events" ? (
              <>
                <div className={styles.stat}>
                  <strong className={styles.statValue}>
                    {formatMoneyAmount(
                      eventsSummary?.positionsValue ?? 0,
                      cur,
                      isUsd ? 2 : 0,
                    )}
                  </strong>
                  <span className={styles.statLabel}>
                    {t("prediction.profilePositionsValue")}
                  </span>
                </div>
                <div className={styles.stat}>
                  <strong className={styles.statValue}>
                    {formatMoneyAmount(
                      eventsSummary?.biggestWin ?? 0,
                      cur,
                      isUsd ? 2 : 0,
                    )}
                  </strong>
                  <span className={styles.statLabel}>
                    {t("prediction.profileBiggestWin")}
                  </span>
                </div>
                <div className={styles.stat}>
                  <strong className={styles.statValue}>
                    {eventsSummary?.markets ?? 0}
                  </strong>
                  <span className={styles.statLabel}>
                    {t("prediction.profileMarkets")}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className={styles.stat}>
                  <strong className={styles.statValue}>
                    {formatMoneyAmount(
                      summary?.stakeTotal ?? 0,
                      cur,
                      isUsd ? 2 : 0,
                    )}
                  </strong>
                  <span className={styles.statLabel}>
                    {t("trading.publicPnlVolume")}
                  </span>
                </div>
                <div className={styles.stat}>
                  <strong className={styles.statValue}>
                    {formatMoneyAmount(
                      summary?.biggestWin ?? 0,
                      cur,
                      isUsd ? 2 : 0,
                    )}
                  </strong>
                  <span className={styles.statLabel}>
                    {t("trading.traderBiggestWin")}
                  </span>
                </div>
                <div className={styles.stat}>
                  <strong className={styles.statValue}>
                    {summary?.bets ?? 0}
                  </strong>
                  <span className={styles.statLabel}>
                    {t("trading.traderBetsLabel")}
                  </span>
                </div>
              </>
            )}
          </div>
        </section>

        <section className={styles.pnlCard}>
          <div className={styles.pnlHead}>
            <span className={styles.pnlTitle}>
              <i
                className={`${styles.arrow} ${positive ? "" : styles.arrowDown}`}
                aria-hidden
              />
              {t("trading.pnlTitle")}
            </span>
            <div className={styles.ranges} role="group">
              {ranges.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={range === r.id ? styles.rangeOn : styles.rangeBtn}
                  onClick={() => {
                    setRange(r.id);
                    setScrubIndex(null);
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.pnlValueBlock}>
            <strong
              className={`${styles.pnlValue} ${
                scrubIndex != null ? styles.pnlValueScrubbing : ""
              }`}
            >
              <ScrubMoney
                value={Math.abs(display)}
                currency={cur}
                fractionDigits={isUsd ? 2 : 0}
                active={scrubIndex != null}
              />
            </strong>
            <span className={styles.pnlSub}>{sub}</span>
          </div>

          <TraderPnlChart
            points={points}
            scrubIndex={scrubIndex}
            onScrub={setScrubIndex}
          />
        </section>
      </div>

      {mode === "events" ? (
        <section className={styles.activity}>
          <div className={styles.activityTabs}>
            <button
              type="button"
              className={
                eventsPanel === "positions"
                  ? styles.activityTabOn
                  : styles.activityTab
              }
              onClick={() => setEventsPanel("positions")}
            >
              {t("prediction.profilePositions")}
            </button>
            <button
              type="button"
              className={
                eventsPanel === "activity"
                  ? styles.activityTabOn
                  : styles.activityTab
              }
              onClick={() => setEventsPanel("activity")}
            >
              {t("prediction.profileActivity")}
            </button>
            {eventsSummary?.winRate != null ? (
              <span className={styles.activityMetaTop}>
                {t("trading.traderWinRate")} {eventsSummary.winRate}%
              </span>
            ) : null}
          </div>

          {eventsPanel === "positions" ? (
            <>
              <div className={styles.posFilters}>
                <button
                  type="button"
                  className={
                    posFilter === "active" ? styles.posFilterOn : styles.posFilter
                  }
                  onClick={() => setPosFilter("active")}
                >
                  {t("prediction.profileActive")}
                </button>
                <button
                  type="button"
                  className={
                    posFilter === "closed" ? styles.posFilterOn : styles.posFilter
                  }
                  onClick={() => setPosFilter("closed")}
                >
                  {t("prediction.profileClosed")}
                </button>
              </div>

              {posFilter === "active" ? (
                !positions.length ? (
                  <p className={styles.emptyInline}>
                    {t("prediction.profilePositionsEmpty")}
                  </p>
                ) : (
                  <ul className={styles.posList}>
                    {positions.map((p) => {
                      const title =
                        pickPredictionText(p.title, p.titleEn, locale) ||
                        p.title;
                      const label =
                        pickPredictionText(
                          p.outcomeLabel,
                          p.outcomeLabelEn,
                          locale,
                        ) || p.outcomeKey;
                      const img = resolvePredictionMediaUrl(p.imageUrl);
                      return (
                        <li key={`${p.eventId}-${p.outcomeId}`}>
                          <Link
                            className={styles.posRow}
                            href={`/markets/${p.slug}`}
                          >
                            {img ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img alt="" className={styles.posThumb} src={img} />
                            ) : (
                              <span aria-hidden className={styles.posThumbFallback}>
                                {(title.trim()[0] || "?").toUpperCase()}
                              </span>
                            )}
                            <div className={styles.posBody}>
                              <span className={styles.posTitle}>{title}</span>
                              <span className={styles.posMeta}>
                                {label} · {t("prediction.profileAvg")}{" "}
                                {p.avgOdds.toFixed(2)} ·{" "}
                                {t("prediction.profileCurrent")}{" "}
                                {p.currentOdds.toFixed(2)}
                              </span>
                            </div>
                            <div className={styles.posRight}>
                              <strong>
                                {formatMoneyAmount(
                                  p.stake,
                                  cur,
                                  isUsd ? 2 : 0,
                                )}
                              </strong>
                              <span>
                                {t("prediction.profileToWin")}{" "}
                                {formatMoneyAmount(
                                  p.potentialPayout,
                                  cur,
                                  isUsd ? 2 : 0,
                                )}
                              </span>
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )
              ) : !closed.length ? (
                <p className={styles.emptyInline}>
                  {t("prediction.profileClosedEmpty")}
                </p>
              ) : (
                <ul className={styles.posList}>
                  {closed.map((p) => {
                    const title =
                      pickPredictionText(p.title, p.titleEn, locale) ||
                      p.title;
                    const label =
                      pickPredictionText(
                        p.outcomeLabel,
                        p.outcomeLabelEn,
                        locale,
                      ) || p.outcomeKey;
                    const img = resolvePredictionMediaUrl(p.imageUrl);
                    const up = p.pnl >= 0;
                    return (
                      <li key={p.id}>
                        <Link
                          className={styles.posRow}
                          href={`/markets/${p.slug}`}
                        >
                          {img ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img alt="" className={styles.posThumb} src={img} />
                          ) : (
                            <span aria-hidden className={styles.posThumbFallback}>
                              {(title.trim()[0] || "?").toUpperCase()}
                            </span>
                          )}
                          <div className={styles.posBody}>
                            <span className={styles.posTitle}>{title}</span>
                            <span className={styles.posMeta}>
                              {label} · {p.odds.toFixed(2)} · {p.status}
                            </span>
                          </div>
                          <div className={styles.posRight}>
                            <strong className={up ? styles.pnlUp : styles.pnlDown}>
                              {formatMoneyAmount(
                                Math.abs(p.pnl),
                                cur,
                                isUsd ? 2 : 0,
                              )}
                            </strong>
                            <span>
                              {formatMoneyAmount(p.stake, cur, isUsd ? 2 : 0)}
                            </span>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          ) : !eventsRecent.length ? (
            <p className={styles.emptyInline}>
              {t("prediction.profileActivityEmpty")}
            </p>
          ) : (
            <ul className={styles.posList}>
              {eventsRecent.map((b) => {
                const title =
                  pickPredictionText(b.title, b.titleEn, locale) || b.title;
                const label =
                  pickPredictionText(
                    b.outcomeLabel,
                    b.outcomeLabelEn,
                    locale,
                  ) || b.outcomeKey;
                const img = resolvePredictionMediaUrl(b.imageUrl);
                return (
                  <li key={b.id}>
                    <Link className={styles.posRow} href={`/markets/${b.slug}`}>
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img alt="" className={styles.posThumb} src={img} />
                      ) : (
                        <span aria-hidden className={styles.posThumbFallback}>
                          {(title.trim()[0] || "?").toUpperCase()}
                        </span>
                      )}
                      <div className={styles.posBody}>
                        <span className={styles.posTitle}>{title}</span>
                        <span className={styles.posMeta}>
                          {t("prediction.profileBought", { label })} ·{" "}
                          {formatMoneyAmount(b.stake, cur, isUsd ? 2 : 0)}
                        </span>
                      </div>
                      <div className={styles.posRight}>
                        {b.pnl != null ? (
                          <strong
                            className={
                              b.pnl >= 0 ? styles.pnlUp : styles.pnlDown
                            }
                          >
                            {formatMoneyAmount(
                              Math.abs(b.pnl),
                              cur,
                              isUsd ? 2 : 0,
                            )}
                          </strong>
                        ) : (
                          <strong>{b.status}</strong>
                        )}
                        <span>
                          {new Date(b.createdAt).toLocaleString(
                            toIntlLocale(locale),
                            {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : (
        <section className={styles.activity}>
          <div className={styles.activityTabs}>
            <span className={styles.activityTabOn}>
              {t("trading.traderActivity")}
            </span>
            {summary &&
            "winRate" in summary &&
            summary.winRate != null ? (
              <span className={styles.activityMetaTop}>
                {t("trading.traderWinRate")} {summary.winRate}%
              </span>
            ) : null}
          </div>
          {!tradingQuery.data?.recent?.length ? (
            <p className={styles.emptyInline}>{t("trading.publicPnlEmpty")}</p>
          ) : (
            <ActivityDrum
              bets={tradingQuery.data.recent}
              currency={cur}
              isUsd={isUsd}
              locale={locale}
              t={t}
            />
          )}
        </section>
      )}
    </div>
  );
}
