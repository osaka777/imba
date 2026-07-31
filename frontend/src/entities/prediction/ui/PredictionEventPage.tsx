"use client";

import NumberFlow, { continuous } from "@number-flow/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";

import { getBalance } from "~/entities/finance/api";
import { getSessionClient } from "~/entities/user/lib/getSessionClient";
import { traderProfileHref } from "~/entities/user/lib/nickname";
import { UserAvatar } from "~/entities/user/ui/UserAvatar/UserAvatar";
import { hapticBetAccepted } from "~/shared/lib/haptic";
import { toIntlLocale } from "~/shared/i18n/format";
import type { AppLocale } from "~/shared/i18n/locale";
import type { MessageKey } from "~/shared/i18n/messages";
import { useCurrency } from "~/shared/model/useCurrency";
import { useLocale } from "~/shared/model/useLocale";

import {
  type ChancePoint,
  type PredictionCommentDto,
  type PredictionEventDto,
  type PredictionGifItem,
  fetchPredictionEvent,
  formatChanceCents,
  formatPredictionVolumeUsd,
  placePredictionBet,
  placePredictionComment,
  predictionGifDisplaySrc,
  togglePredictionBookmark,
  togglePredictionCommentLike,
} from "../api/client";
import { resolvePredictionMediaUrl } from "../lib/mediaUrl";
import { pickPredictionText } from "../lib/i18nText";
import { ChanceChart, type ChanceScrub } from "./ChanceChart";
import { PredictionGifPicker } from "./PredictionGifPicker";
import styles from "./Prediction.module.css";

const COMMENT_MAX = 280;

function formatMoneyShort(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(Math.round(n));
}

function sampleSeries(points: ChancePoint[], fi: number): ChancePoint {
  if (!points.length) return { t: Date.now(), v: 50 };
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

function formatStamp(t: number, intlLocale: string) {
  return new Date(t).toLocaleString(intlLocale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Polymarket-style relative time for comment meta. */
function formatCommentRelative(
  iso: string,
  locale: AppLocale,
  t: (key: MessageKey, params?: Record<string, string | number>) => string,
): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return formatStamp(Date.parse(iso), toIntlLocale(locale));
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return t("prediction.commentJustNow");
  const min = Math.floor(sec / 60);
  if (min < 60) return t("prediction.commentMinutesAgo", { n: min });
  const hr = Math.floor(min / 60);
  if (hr < 48) return t("prediction.commentHoursAgo", { n: hr });
  const day = Math.floor(hr / 24);
  if (day < 30) return t("prediction.commentDaysAgo", { n: day });
  return formatStamp(Date.parse(iso), toIntlLocale(locale));
}

function splitCountdown(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(totalSec / 86_400),
    h: Math.floor((totalSec % 86_400) / 3600),
    m: Math.floor((totalSec % 3600) / 60),
    s: totalSec % 60,
  };
}

function formatLiveCountdown(
  ms: number,
  t: (key: MessageKey, params?: Record<string, string | number>) => string,
): string {
  const { d, h, m, s } = splitCountdown(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = t("prediction.countdownDay");
  const hour = t("prediction.countdownHour");
  const min = t("prediction.countdownMin");
  const sec = t("prediction.countdownSec");
  if (d > 0) {
    return `${d}${day} ${pad(h)}${hour} ${pad(m)}${min} ${pad(s)}${sec}`;
  }
  if (h > 0) {
    return `${h}${hour} ${pad(m)}${min} ${pad(s)}${sec}`;
  }
  return `${m}${min} ${pad(s)}${sec}`;
}

/** Isolated ticker — avoids re-rendering the whole event page every second. */
function EventEndsMeta({
  closesAt,
  status,
  endsLabel,
  t,
}: {
  closesAt: string | null;
  status: string;
  endsLabel: string | null;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
}) {
  const open =
    status === "OPEN" &&
    Boolean(closesAt) &&
    Date.parse(closesAt!) > Date.now();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!open || !closesAt) return;
    const end = Date.parse(closesAt);
    const tick = () => {
      const left = end - Date.now();
      setNow(Date.now());
      return left;
    };
    tick();
    const id = window.setInterval(() => {
      if (tick() <= 0) window.clearInterval(id);
    }, 1_000);
    return () => window.clearInterval(id);
  }, [open, closesAt]);

  if (open && closesAt) {
    const left = Date.parse(closesAt) - now;
    if (left <= 0) {
      return (
        <span className={styles.countdown}>{t("prediction.endsClosed")}</span>
      );
    }
    return (
      <span className={styles.countdown} aria-live="polite">
        {t("prediction.endsIn")}{" "}
        <span className={styles.countdownTime}>
          {formatLiveCountdown(left, t)}
        </span>
      </span>
    );
  }
  if (endsLabel) {
    return <span>{t("prediction.until", { date: endsLabel })}</span>;
  }
  return null;
}

type RangeKey = "1d" | "1w" | "1m" | "all";

function filterSeries(points: ChancePoint[], range: RangeKey): ChancePoint[] {
  if (points.length < 2 || range === "all") return points;
  const now = points[points.length - 1]?.t ?? Date.now();
  const ms =
    range === "1d"
      ? 86_400_000
      : range === "1w"
        ? 7 * 86_400_000
        : 30 * 86_400_000;
  const from = now - ms;
  const sliced = points.filter((p) => p.t >= from);
  if (sliced.length >= 2) return sliced;
  return points.slice(-Math.min(points.length, 8));
}

function betStatusLabel(
  status: string,
  t: (key: MessageKey) => string,
) {
  switch (status) {
    case "PENDING":
      return t("prediction.betStatusPending");
    case "WIN":
      return t("prediction.betStatusWin");
    case "LOSE":
      return t("prediction.betStatusLose");
    case "VOID":
      return t("prediction.betStatusVoid");
    default:
      return status;
  }
}

function RelatedCard({
  event,
  locale,
  t,
  currencyCode,
}: {
  event: PredictionEventDto;
  locale: AppLocale;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
  currencyCode: string;
}) {
  const title = pickPredictionText(event.title, event.titleEn, locale);
  const a = event.outcomes[0];
  const share = a?.sharePct ?? 50;
  const imageSrc = resolvePredictionMediaUrl(event.imageUrl);
  const initial = (title.trim()[0] || "?").toUpperCase();

  return (
    <Link className={styles.relatedCard} href={`/markets/${event.slug}`}>
      {imageSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" className={styles.relatedThumb} src={imageSrc} />
      ) : (
        <div aria-hidden className={styles.relatedThumbFallback}>
          {initial}
        </div>
      )}
      <div className={styles.relatedBody}>
        <span className={styles.relatedTitle}>{title}</span>
        <span className={styles.relatedMeta}>
          {Math.round(share)}% · {formatPredictionVolumeUsd(event.pool?.totalStake ?? 0)}{" "}
          {t("prediction.volume")}
        </span>
      </div>
      <span className={styles.relatedPrice}>
        {formatChanceCents(share, currencyCode)}
      </span>
    </Link>
  );
}

export function PredictionEventPage({ slug }: { slug: string }) {
  const router = useRouter();
  const { t, locale } = useLocale();
  const intlLocale = toIntlLocale(locale);
  const queryClient = useQueryClient();
  const { currency } = useCurrency();
  const currencyCode = (currency || "KZT").toUpperCase();
  const [stake, setStake] = useState(1000);
  const [side, setSide] = useState<"A" | "B">("A");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<null | string>(null);
  const [ok, setOk] = useState<null | string>(null);
  const [scrub, setScrub] = useState<ChanceScrub | null>(null);
  const [range, setRange] = useState<RangeKey>("all");
  const [commentDraft, setCommentDraft] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [commentSort, setCommentSort] = useState<"newest" | "oldest" | "top">(
    "newest",
  );
  const [commentsVisible, setCommentsVisible] = useState(5);
  const [replyToId, setReplyToId] = useState<number | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [gifPickerOpen, setGifPickerOpen] = useState(false);
  const [pendingGif, setPendingGif] = useState<PredictionGifItem | null>(null);
  const [likeBusyId, setLikeBusyId] = useState<number | null>(null);
  const shareWrapRef = useRef<HTMLDivElement>(null);

  const query = useQuery({
    queryFn: () => fetchPredictionEvent(slug),
    queryKey: ["prediction-event", slug],
    refetchInterval: 12_000,
  });

  const isAuth = Boolean(getSessionClient());
  const balanceQuery = useQuery({
    queryFn: getBalance,
    queryKey: ["finance-balance"],
    enabled: isAuth,
    staleTime: 0,
  });

  const event = query.data?.event;
  const comments = (query.data?.comments || []) as PredictionCommentDto[];

  /* Canonical latin slug in the address bar. */
  useEffect(() => {
    if (!event?.slug) return;
    let current = slug;
    try {
      current = decodeURIComponent(slug);
    } catch {
      current = slug;
    }
    if (event.slug !== current) {
      router.replace(`/markets/${event.slug}`);
    }
  }, [event?.slug, slug, router]);

  useEffect(() => {
    if (!comments.length || typeof window === "undefined") return;
    const hash = window.location.hash;
    if (!hash.startsWith("#comment-")) return;
    const el = document.getElementById(hash.slice(1));
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [comments]);

  const seriesAll = query.data?.series || [];
  const commentThreads = useMemo(() => {
    const byId = new Map(comments.map((c) => [c.id, c]));
    const repliesByParent = new Map<number, PredictionCommentDto[]>();
    for (const c of comments) {
      if (c.parentId == null) continue;
      const list = repliesByParent.get(c.parentId) ?? [];
      list.push(c);
      repliesByParent.set(c.parentId, list);
    }
    for (const list of repliesByParent.values()) {
      list.sort(
        (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
      );
    }
    const roots = comments.filter(
      (c) => c.parentId == null || !byId.has(c.parentId),
    );
    roots.sort((a, b) => {
      if (commentSort === "top") {
        const lc = (b.likeCount ?? 0) - (a.likeCount ?? 0);
        if (lc !== 0) return lc;
      }
      const da = Date.parse(a.createdAt) - Date.parse(b.createdAt);
      return commentSort === "oldest" ? da : -da;
    });
    return roots.map((root) => ({
      root,
      replies: repliesByParent.get(root.id) ?? [],
    }));
  }, [commentSort, comments]);

  useEffect(() => {
    setCommentsVisible(5);
  }, [commentSort, slug]);

  const visibleCommentThreads = useMemo(
    () => commentThreads.slice(0, commentsVisible),
    [commentThreads, commentsVisible],
  );
  const hasMoreComments = commentThreads.length > commentsVisible;
  const related = query.data?.related || [];
  const myBets = query.data?.myBets || [];
  const minStake =
    query.data?.config?.minStakeByCurrency?.[currencyCode] ?? 100;
  const maxStake =
    query.data?.config?.maxStakeByCurrency?.[currencyCode] ?? 500_000;

  const balanceAmount = useMemo(() => {
    const rows = balanceQuery.data;
    if (!Array.isArray(rows)) return null;
    const row = rows.find(
      (b) =>
        String((b as { currencyCode?: string }).currencyCode || "").toUpperCase() ===
        currencyCode,
    ) as { amount?: string | number } | undefined;
    if (!row) return null;
    const n = Number(row.amount);
    return Number.isFinite(n) ? n : null;
  }, [balanceQuery.data, currencyCode]);

  const effectiveMaxStake = useMemo(() => {
    if (balanceAmount == null) return maxStake;
    return Math.max(minStake, Math.min(maxStake, Math.floor(balanceAmount)));
  }, [balanceAmount, maxStake, minStake]);

  async function submitComment(parentId?: number | null) {
    if (!event || commentBusy) return;
    const isReply = parentId != null;
    const body = (isReply ? replyDraft : commentDraft).trim();
    const gif = isReply ? null : pendingGif;
    if (!body && !gif) return;
    setCommentBusy(true);
    setCommentError(null);
    try {
      await placePredictionComment(
        event.id,
        body,
        gif?.url ?? null,
        parentId ?? null,
      );
      if (isReply) {
        setReplyDraft("");
        setReplyToId(null);
      } else {
        setCommentDraft("");
        setPendingGif(null);
      }
      await queryClient.invalidateQueries({
        queryKey: ["prediction-event", slug],
      });
    } catch (e) {
      setCommentError(
        e instanceof Error ? e.message : t("prediction.commentSend"),
      );
    } finally {
      setCommentBusy(false);
    }
  }

  const a = event?.outcomes[0];
  const b = event?.outcomes[1];
  const shareA = a?.sharePct ?? 50;
  const shareB = Math.max(0, 100 - shareA);
  const total = event?.pool?.totalStake ?? 0;
  const selected = side === "A" ? a : b;
  const eventTitle = event
    ? pickPredictionText(event.title, event.titleEn, locale)
    : "";
  const eventDescription = event
    ? pickPredictionText(event.description, event.descriptionEn, locale)
    : "";
  const eventRule = event
    ? pickPredictionText(event.resolveRule, event.resolveRuleEn, locale)
    : "";
  const yesLabel =
    pickPredictionText(a?.label, a?.labelEn, locale) || t("prediction.yes");
  const noLabel =
    pickPredictionText(b?.label, b?.labelEn, locale) || t("prediction.no");

  const series = useMemo(
    () => filterSeries(seriesAll, range),
    [seriesAll, range],
  );

  const liveChance = Math.round(shareA);
  const scrubbed =
    scrub != null && series.length ? sampleSeries(series, scrub.index) : null;
  const scrubSide = scrub?.side ?? "yes";
  const displayYes = scrubbed ? scrubbed.v : shareA;
  const displayNo = scrubbed ? 100 - scrubbed.v : shareB;
  const displayChance =
    scrubbed == null
      ? liveChance
      : scrubSide === "yes"
        ? scrubbed.v
        : 100 - scrubbed.v;
  const displayLabel = scrubSide === "yes" ? yesLabel : noLabel;
  const displayStamp = scrubbed
    ? formatStamp(scrubbed.t, intlLocale)
    : series.length
      ? t("prediction.now")
      : null;

  const potential = useMemo(() => {
    if (!selected) return null;
    return (stake * selected.odds).toFixed(0);
  }, [selected, stake]);

  const profit = useMemo(() => {
    if (!selected || potential == null) return null;
    return (Number(potential) - stake).toFixed(0);
  }, [potential, selected, stake]);

  const debitLocalBalances = (debited: number) => {
    if (!Number.isFinite(debited) || debited <= 0) return;

    queryClient.setQueryData(["finance-balance"], (prev: unknown) => {
      if (!Array.isArray(prev)) return prev;
      return prev.map((row) => {
        const code = String(
          (row as { currencyCode?: string }).currencyCode || "",
        ).toUpperCase();
        if (code !== currencyCode) return row;
        const cur = Number((row as { amount?: string | number }).amount);
        if (!Number.isFinite(cur)) return row;
        return {
          ...(row as object),
          amount: String(Math.max(0, cur - debited)),
        };
      });
    });

    queryClient.setQueryData(["user"], (prev: unknown) => {
      if (!prev || typeof prev !== "object") return prev;
      const user = prev as {
        balances?: Array<{ currencyCode?: string; amount?: string | number }>;
      };
      if (!Array.isArray(user.balances)) return prev;
      return {
        ...user,
        balances: user.balances.map((row) => {
          if (String(row.currencyCode || "").toUpperCase() !== currencyCode) {
            return row;
          }
          const cur = Number(row.amount);
          if (!Number.isFinite(cur)) return row;
          return { ...row, amount: String(Math.max(0, cur - debited)) };
        }),
      };
    });
  };

  const place = async () => {
    setError(null);
    setOk(null);
    if (!isAuth) {
      setError(t("prediction.loginToBet"));
      return;
    }
    if (!event || !selected) return;
    const amount = Number(stake);
    if (!Number.isFinite(amount) || amount < minStake) {
      setError(
        t("prediction.minStake", {
          amount: minStake,
          currency: currencyCode,
        }),
      );
      return;
    }
    try {
      setBusy(true);
      const bet = await placePredictionBet(
        event.id,
        selected.id,
        amount,
        currencyCode,
      );
      const debited = Number(bet?.stake);
      debitLocalBalances(Number.isFinite(debited) ? debited : amount);
      setOk(t("prediction.betAccepted"));
      hapticBetAccepted();
      toast.success(t("prediction.betAccepted"), { position: "top-right" });
      setStake(minStake);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["prediction-event", slug],
        }),
        queryClient.invalidateQueries({ queryKey: ["prediction-events"] }),
        queryClient.invalidateQueries({ queryKey: ["finance-balance"] }),
        queryClient.invalidateQueries({ queryKey: ["user"] }),
      ]);
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : t("prediction.betFailed"),
      );
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!event?.slug || typeof window === "undefined") return;
    if (isAuth && query.data) {
      setBookmarked(Boolean(query.data.bookmarked));
      return;
    }
    try {
      const raw = localStorage.getItem("imba_prediction_bookmarks_v1");
      const list = raw ? (JSON.parse(raw) as string[]) : [];
      setBookmarked(Array.isArray(list) && list.includes(event.slug));
    } catch {
      setBookmarked(false);
    }
  }, [event?.slug, isAuth, query.data]);

  useEffect(() => {
    if (!shareOpen) return;
    const onDown = (e: MouseEvent) => {
      const el = shareWrapRef.current;
      if (el && !el.contains(e.target as Node)) setShareOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShareOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [shareOpen]);

  const eventUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/markets/${event?.slug ?? slug}`
      : `/markets/${event?.slug ?? slug}`;

  const flashCopied = () => {
    setLinkCopied(true);
    window.setTimeout(() => setLinkCopied(false), 1400);
  };

  const copyEventLink = async () => {
    try {
      await navigator.clipboard.writeText(eventUrl);
      flashCopied();
      setShareOpen(false);
    } catch {
      /* ignore */
    }
  };

  const copyEmbedCode = async () => {
    const code = `<iframe src="${eventUrl}" width="100%" height="480" frameborder="0" title="${eventTitle.replace(/"/g, "")}"></iframe>`;
    try {
      await navigator.clipboard.writeText(code);
      flashCopied();
      setShareOpen(false);
    } catch {
      /* ignore */
    }
  };

  const toggleBookmark = async () => {
    if (!event?.slug) return;
    if (isAuth) {
      try {
        const res = await togglePredictionBookmark(event.id);
        setBookmarked(res.bookmarked);
        try {
          const raw = localStorage.getItem("imba_prediction_bookmarks_v1");
          const list = raw ? (JSON.parse(raw) as string[]) : [];
          const next = Array.isArray(list) ? [...list] : [];
          const idx = next.indexOf(event.slug);
          if (res.bookmarked && idx < 0) next.push(event.slug);
          if (!res.bookmarked && idx >= 0) next.splice(idx, 1);
          localStorage.setItem(
            "imba_prediction_bookmarks_v1",
            JSON.stringify(next),
          );
        } catch {
          /* ignore */
        }
        await queryClient.invalidateQueries({
          queryKey: ["prediction-event", slug],
        });
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      const raw = localStorage.getItem("imba_prediction_bookmarks_v1");
      const list = raw ? (JSON.parse(raw) as string[]) : [];
      const next = Array.isArray(list) ? [...list] : [];
      const idx = next.indexOf(event.slug);
      if (idx >= 0) next.splice(idx, 1);
      else next.push(event.slug);
      localStorage.setItem("imba_prediction_bookmarks_v1", JSON.stringify(next));
      setBookmarked(idx < 0);
    } catch {
      /* ignore */
    }
  };

  const toggleLike = async (commentId: number) => {
    if (!isAuth || likeBusyId != null) return;
    setLikeBusyId(commentId);
    try {
      const res = await togglePredictionCommentLike(commentId);
      queryClient.setQueryData(
        ["prediction-event", slug],
        (prev: typeof query.data) => {
          if (!prev) return prev;
          return {
            ...prev,
            comments: prev.comments.map((c) =>
              c.id === commentId
                ? {
                    ...c,
                    likeCount: res.likeCount,
                    likedByMe: res.liked,
                  }
                : c,
            ),
          };
        },
      );
    } catch {
      /* ignore */
    } finally {
      setLikeBusyId(null);
    }
  };

  if (query.isLoading) {
    return (
      <div className={styles.hub}>
        <div className={styles.empty}>{t("prediction.loading")}</div>
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className={styles.hub}>
        <Link className={styles.back} href="/markets">
          ← {t("nav.markets")}
        </Link>
        <div className={styles.empty}>{t("prediction.loadFailed")}</div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className={styles.hub}>
        <Link className={styles.back} href="/markets">
          ← {t("nav.markets")}
        </Link>
        <div className={styles.empty}>{t("prediction.notFound")}</div>
      </div>
    );
  }

  const quickAmounts = [
    minStake,
    minStake * 5,
    minStake * 10,
    minStake * 50,
  ].filter((v, i, arr) => v <= maxStake && arr.indexOf(v) === i);

  const imageSrc = resolvePredictionMediaUrl(event.imageUrl);
  const endsLabel = event.closesAt
    ? new Date(event.closesAt).toLocaleString(intlLocale, {
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null;
  const winnerOutcome =
    event.status === "SETTLED" && event.winningOutcomeId
      ? event.outcomes.find((o) => o.id === event.winningOutcomeId)
      : null;
  const winnerLabel = winnerOutcome
    ? pickPredictionText(winnerOutcome.label, winnerOutcome.labelEn, locale) ||
      winnerOutcome.key
    : null;

  const ranges: { id: RangeKey; label: string }[] = [
    { id: "1d", label: t("prediction.range1d") },
    { id: "1w", label: t("prediction.range1w") },
    { id: "1m", label: t("prediction.range1m") },
    { id: "all", label: t("prediction.rangeAll") },
  ];

  return (
    <div className={styles.detailShell} data-events-detail>
      <div className={`${styles.hub} ${styles.detail}`}>
        <div className={styles.detailLayout}>
          <div className={styles.leftCol}>
            <section className={`${styles.panel} ${styles.pmMain}`}>
              <div className={styles.pmCardTop}>
                <Link className={styles.back} href="/markets">
                  <span aria-hidden className={styles.backArrow}>
                    ←
                  </span>
                  <span className={styles.backLabel}>{t("nav.markets")}</span>
                </Link>

                <div className={styles.pmActionIcons}>
                  <div className={styles.pmActionWrap} ref={shareWrapRef}>
                    <button
                      aria-expanded={shareOpen}
                      aria-haspopup="menu"
                      aria-label={t("prediction.actionShare")}
                      className={`${styles.pmIconBtn} ${
                        shareOpen || linkCopied ? styles.pmIconBtnOn : ""
                      }`}
                      onClick={() => setShareOpen((v) => !v)}
                      title={
                        linkCopied
                          ? t("prediction.actionCopied")
                          : t("prediction.actionShare")
                      }
                      type="button"
                    >
                      {linkCopied ? (
                        <svg
                          fill="none"
                          height="18"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.75"
                          viewBox="0 0 24 24"
                          width="18"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <svg
                          fill="none"
                          height="18"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.75"
                          viewBox="0 0 24 24"
                          width="18"
                        >
                          <circle cx="18" cy="5" r="3" />
                          <circle cx="6" cy="12" r="3" />
                          <circle cx="18" cy="19" r="3" />
                          <line x1="8.59" x2="15.42" y1="13.51" y2="17.49" />
                          <line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />
                        </svg>
                      )}
                    </button>
                    {shareOpen ? (
                      <div className={styles.pmEmbedMenu} role="menu">
                        <button
                          className={styles.pmEmbedItem}
                          onClick={() => void copyEventLink()}
                          role="menuitem"
                          type="button"
                        >
                          {t("prediction.actionCopyLink")}
                        </button>
                        <button
                          className={styles.pmEmbedItem}
                          onClick={() => void copyEmbedCode()}
                          role="menuitem"
                          type="button"
                        >
                          {t("prediction.actionCopyEmbed")}
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <button
                    aria-label={t("prediction.actionBookmark")}
                    aria-pressed={bookmarked}
                    className={`${styles.pmIconBtn} ${bookmarked ? styles.pmIconBtnOn : ""}`}
                    onClick={() => void toggleBookmark()}
                    title={t("prediction.actionBookmark")}
                    type="button"
                  >
                    <svg
                      fill={bookmarked ? "currentColor" : "none"}
                      height="18"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.75"
                      viewBox="0 0 24 24"
                      width="18"
                    >
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className={styles.pmHead}>
                {imageSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="" className={styles.pmThumb} src={imageSrc} />
                ) : (
                  <div aria-hidden className={styles.pmThumbFallback}>
                    {(eventTitle.trim()[0] || "?").toUpperCase()}
                  </div>
                )}
                <div className={styles.pmHeadText}>
                  <h1 className={styles.pmTitle}>{eventTitle}</h1>
                  <div className={styles.pmHeadMeta}>
                    <span>
                      {formatPredictionVolumeUsd(total)} {t("prediction.volume")}
                    </span>
                    <EventEndsMeta
                      closesAt={event.closesAt}
                      endsLabel={endsLabel}
                      status={event.status}
                      t={t}
                    />
                  </div>
                  {winnerLabel ? (
                    <div className={styles.resultBanner} role="status">
                      {t("prediction.resultWinner", { label: winnerLabel })}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className={styles.pmChanceBlock}>
                <div className={styles.pmChanceHead}>
                  <div className={styles.pmChanceTop}>
                    <span
                      className={`${styles.pmChancePct} ${
                        scrub != null ? styles.pmChancePctScrub : ""
                      } ${
                        scrub?.side === "yes"
                          ? styles.pmChancePctYes
                          : scrub?.side === "no"
                            ? styles.pmChancePctNo
                            : ""
                      }`}
                    >
                      <NumberFlow
                        value={Number(displayChance.toFixed(1))}
                        locales={intlLocale}
                        format={{
                          minimumFractionDigits: scrub != null ? 1 : 0,
                          maximumFractionDigits: scrub != null ? 1 : 0,
                        }}
                        suffix="%"
                        plugins={scrub != null ? [continuous] : undefined}
                        willChange={scrub != null}
                        spinTiming={{
                          duration: scrub != null ? 280 : 450,
                          easing: "cubic-bezier(0.16, 0.84, 0.22, 1)",
                        }}
                        transformTiming={{
                          duration: scrub != null ? 280 : 450,
                          easing: "cubic-bezier(0.16, 0.84, 0.22, 1)",
                        }}
                      />
                    </span>
                    <span className={styles.pmChanceLabel}>
                      {t("prediction.chanceOn", { label: displayLabel })}
                      {displayStamp ? (
                        <>
                          <span className={styles.pmChanceDot}>·</span>
                          {displayStamp}
                        </>
                      ) : null}
                    </span>
                  </div>
                  <div className={styles.pmRanges} role="group">
                    {ranges.map((r) => (
                      <button
                        className={
                          range === r.id ? styles.pmRangeOn : styles.pmRangeBtn
                        }
                        key={r.id}
                        onClick={() => {
                          setRange(r.id);
                          setScrub(null);
                        }}
                        type="button"
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                <ChanceChart
                  onScrub={setScrub}
                  points={series}
                  scrub={scrub}
                />

                <div className={styles.pmChanceFoot}>
                  <span
                    className={`${styles.pmChanceFootYes} ${
                      scrub?.side === "no" ? styles.pmChanceFootDim : ""
                    }`}
                  >
                    <i aria-hidden className={styles.pmChanceSwatch} />
                    {displayYes.toFixed(scrub ? 1 : 0)}% {yesLabel}
                  </span>
                  <span
                    className={`${styles.pmChanceFootNo} ${
                      scrub?.side === "yes" ? styles.pmChanceFootDim : ""
                    }`}
                  >
                    <i aria-hidden className={styles.pmChanceSwatch} />
                    {displayNo.toFixed(scrub ? 1 : 0)}% {noLabel}
                  </span>
                </div>
              </div>
            </section>

            <section className={`${styles.panel} ${styles.pmInfoCard}`}>
              {eventDescription ? (
                <div className={styles.pmInfoSection}>
                  <h2 className={styles.pmSectionTitle}>
                    {t("prediction.about")}
                  </h2>
                  <p className={styles.pmInfoBody}>{eventDescription}</p>
                </div>
              ) : null}

              <div className={styles.pmInfoSection}>
                <h2 className={styles.pmSectionTitle}>
                  {t("prediction.rules")}
                </h2>
                <p className={styles.pmInfoBody}>
                  {eventRule || t("prediction.rulesDefault")}
                </p>
              </div>

              {myBets.length > 0 ? (
                <div className={styles.pmInfoSection}>
                  <h2 className={styles.pmSectionTitle}>
                    {t("prediction.myBets")}
                  </h2>
                  <div className={styles.myBetList}>
                    {myBets.map((bet) => {
                      const label =
                        pickPredictionText(
                          bet.outcomeLabel,
                          bet.outcomeLabelEn,
                          locale,
                        ) || bet.outcomeKey;
                      const payoutLine =
                        bet.status === "WIN"
                          ? t("prediction.myBetWon", {
                              amount: Math.round(bet.potentialPayout),
                              currency: bet.currencyCode,
                            })
                          : bet.status === "PENDING"
                            ? t("prediction.myBetPayout", {
                                amount: Math.round(bet.potentialPayout),
                                currency: bet.currencyCode,
                              })
                            : null;
                      return (
                        <div
                          className={`${styles.myBetCard} ${
                            bet.status === "WIN"
                              ? styles.myBetWin
                              : bet.status === "LOSE"
                                ? styles.myBetLose
                                : ""
                          }`}
                          key={bet.id}
                        >
                          <div className={styles.myBetTop}>
                            <span className={styles.myBetSide}>{label}</span>
                            <span className={styles.myBetStatus}>
                              {betStatusLabel(bet.status, t)}
                            </span>
                          </div>
                          <div className={styles.myBetBottom}>
                            <span>
                              {bet.stake} {bet.currencyCode} @{" "}
                              {bet.odds.toFixed(2)}
                            </span>
                            {payoutLine ? <span>{payoutLine}</span> : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className={`${styles.pmInfoSection} ${styles.commentSection}`}>
                <div className={styles.commentHead}>
                  <h2 className={styles.commentTitle}>
                    {t("prediction.comments")}
                    {comments.length > 0 ? (
                      <span className={styles.commentCount}>
                        {comments.length.toLocaleString(intlLocale)}
                      </span>
                    ) : null}
                  </h2>
                  {comments.length > 1 ? (
                    <select
                      aria-label={t("prediction.commentSort")}
                      className={styles.commentSortSelect}
                      onChange={(e) => {
                        const v = e.target.value;
                        setCommentSort(
                          v === "oldest"
                            ? "oldest"
                            : v === "top"
                              ? "top"
                              : "newest",
                        );
                      }}
                      value={commentSort}
                    >
                      <option value="newest">
                        {t("prediction.commentSortNewest")}
                      </option>
                      <option value="top">
                        {t("prediction.commentSortTop")}
                      </option>
                      <option value="oldest">
                        {t("prediction.commentSortOldest")}
                      </option>
                    </select>
                  ) : null}
                </div>

                {isAuth ? (
                  <div className={styles.commentComposer}>
                    <textarea
                      className={styles.commentInput}
                      disabled={commentBusy}
                      maxLength={COMMENT_MAX}
                      onChange={(e) => setCommentDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (
                          e.key === "Enter" &&
                          (e.metaKey || e.ctrlKey)
                        ) {
                          e.preventDefault();
                          void submitComment();
                        }
                      }}
                      placeholder={t("prediction.commentPlaceholder")}
                      rows={3}
                      value={commentDraft}
                    />
                    {pendingGif ? (
                      <div className={styles.commentGifPreview}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          alt=""
                          className={styles.commentGifPreviewImg}
                          src={predictionGifDisplaySrc(
                            pendingGif.preview || pendingGif.url,
                          )}
                        />
                        <button
                          aria-label={t("prediction.gifRemove")}
                          className={styles.commentGifRemove}
                          onClick={() => setPendingGif(null)}
                          type="button"
                        >
                          ×
                        </button>
                      </div>
                    ) : null}
                    <div className={styles.commentComposerFoot}>
                      <span className={styles.commentHint}>
                        {t("prediction.commentHint")}
                      </span>
                      <div className={styles.commentComposerActions}>
                        <button
                          aria-label={t("prediction.gifAdd")}
                          className={styles.commentGifBtn}
                          disabled={commentBusy}
                          onClick={() => setGifPickerOpen(true)}
                          type="button"
                        >
                          GIF
                        </button>
                        <button
                          className={styles.commentSend}
                          disabled={
                            commentBusy ||
                            (commentDraft.trim().length < 2 && !pendingGif)
                          }
                          onClick={() => void submitComment()}
                          type="button"
                        >
                          {commentBusy
                            ? t("prediction.commentSending")
                            : t("prediction.commentSend")}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className={styles.commentLogin}>
                    <Link className={styles.loginLink} href="/login">
                      {t("prediction.commentLogin")}
                    </Link>
                  </p>
                )}
                {commentError ? (
                  <p className={styles.commentError}>{commentError}</p>
                ) : null}

                <PredictionGifPicker
                  onClose={() => setGifPickerOpen(false)}
                  onPick={(gif) => setPendingGif(gif)}
                  open={gifPickerOpen}
                />

                {commentThreads.length === 0 ? (
                  isAuth ? (
                    <p className={styles.commentEmpty}>
                      {t("prediction.commentsEmpty")}
                    </p>
                  ) : null
                ) : (
                  <div className={styles.commentList}>
                    {visibleCommentThreads.map(({ root, replies }) => {
                      const renderItem = (
                        row: PredictionCommentDto,
                        opts: { isReply?: boolean },
                      ) => {
                        const href = traderProfileHref({
                          userId: row.user.id,
                          nickname: row.user.nickname,
                          name: row.user.name,
                        });
                        const avatarSrc = resolvePredictionMediaUrl(
                          row.user.avatarUrl,
                        );
                        const isReplying = replyToId === row.id;
                        return (
                          <article
                            className={styles.commentRow}
                            id={`comment-${row.id}`}
                            key={row.id}
                          >
                            <Link
                              className={styles.commentAvatarLink}
                              href={href}
                            >
                              <UserAvatar
                                name={row.user.name}
                                preset={row.user.avatarPreset}
                                size={opts.isReply ? 28 : 32}
                                src={avatarSrc}
                                userId={row.user.id}
                              />
                            </Link>
                            <div className={styles.commentBody}>
                              <div className={styles.commentMeta}>
                                <div className={styles.commentAuthorRow}>
                                  <Link
                                    className={styles.commentAuthor}
                                    href={href}
                                  >
                                    @{row.user.name.replace(/^@+/, "")}
                                  </Link>
                                  {row.position ? (
                                    <span
                                      className={`${styles.commentPos} ${
                                        /^(yes|да|y)$/i.test(
                                          row.position.outcomeKey,
                                        ) ||
                                        /^(yes|да)$/i.test(
                                          row.position.outcomeLabel.trim(),
                                        )
                                          ? styles.commentPosYes
                                          : styles.commentPosNo
                                      }`}
                                    >
                                      {formatMoneyShort(row.position.stake)}{" "}
                                      {pickPredictionText(
                                        row.position.outcomeLabel,
                                        row.position.outcomeLabelEn,
                                        locale,
                                      ) || row.position.outcomeKey}
                                    </span>
                                  ) : null}
                                </div>
                                <time
                                  className={styles.commentTime}
                                  dateTime={row.createdAt}
                                >
                                  {formatCommentRelative(
                                    row.createdAt,
                                    locale,
                                    t,
                                  )}
                                </time>
                              </div>
                              {row.body ? (
                                <p className={styles.commentText}>{row.body}</p>
                              ) : null}
                              {row.gifUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  alt=""
                                  className={styles.commentGif}
                                  loading="lazy"
                                  src={predictionGifDisplaySrc(row.gifUrl)}
                                />
                              ) : null}
                              <div className={styles.commentActions}>
                                <button
                                  aria-label={t("prediction.commentLike")}
                                  aria-pressed={Boolean(row.likedByMe)}
                                  className={`${styles.commentLikeBtn} ${
                                    row.likedByMe ? styles.commentLikeOn : ""
                                  }`}
                                  disabled={likeBusyId === row.id}
                                  onClick={() => {
                                    if (!isAuth) {
                                      window.location.href = "/login";
                                      return;
                                    }
                                    void toggleLike(row.id);
                                  }}
                                  type="button"
                                >
                                  <svg
                                    fill={
                                      row.likedByMe ? "currentColor" : "none"
                                    }
                                    height="14"
                                    stroke="currentColor"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="1.75"
                                    viewBox="0 0 24 24"
                                    width="14"
                                  >
                                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                  </svg>
                                  <span>
                                    {(row.likeCount ?? 0) > 0
                                      ? row.likeCount
                                      : ""}
                                  </span>
                                </button>
                                <button
                                  className={styles.commentReplyBtn}
                                  onClick={() => {
                                    if (!isAuth) {
                                      window.location.href = "/login";
                                      return;
                                    }
                                    setReplyToId(
                                      isReplying ? null : row.id,
                                    );
                                    setReplyDraft("");
                                    setCommentError(null);
                                  }}
                                  type="button"
                                >
                                  {t("prediction.commentReply")}
                                </button>
                              </div>
                              {isReplying ? (
                                <div className={styles.commentReplyBox}>
                                  <p className={styles.commentReplyHint}>
                                    {t("prediction.commentReplyTo", {
                                      name: row.user.name,
                                    })}
                                  </p>
                                  <textarea
                                    className={styles.commentReplyInput}
                                    disabled={commentBusy}
                                    maxLength={COMMENT_MAX}
                                    onChange={(e) =>
                                      setReplyDraft(e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                      if (
                                        e.key === "Enter" &&
                                        (e.metaKey || e.ctrlKey)
                                      ) {
                                        e.preventDefault();
                                        void submitComment(row.id);
                                      }
                                    }}
                                    placeholder={t(
                                      "prediction.commentReplyPlaceholder",
                                    )}
                                    rows={2}
                                    value={replyDraft}
                                  />
                                  <div className={styles.commentReplyActions}>
                                    <button
                                      className={styles.commentReplyCancel}
                                      disabled={commentBusy}
                                      onClick={() => {
                                        setReplyToId(null);
                                        setReplyDraft("");
                                      }}
                                      type="button"
                                    >
                                      {t("prediction.commentReplyCancel")}
                                    </button>
                                    <button
                                      className={styles.commentSend}
                                      disabled={
                                        commentBusy ||
                                        replyDraft.trim().length < 2
                                      }
                                      onClick={() => void submitComment(row.id)}
                                      type="button"
                                    >
                                      {commentBusy
                                        ? t("prediction.commentSending")
                                        : t("prediction.commentSend")}
                                    </button>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </article>
                        );
                      };

                      return (
                        <div className={styles.commentThread} key={root.id}>
                          {renderItem(root, {})}
                          {replies.length > 0 ? (
                            <div className={styles.commentReplies}>
                              {replies.map((reply) =>
                                renderItem(reply, { isReply: true }),
                              )}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                    {hasMoreComments ? (
                      <div className={styles.commentMoreWrap}>
                        <button
                          className={styles.commentMoreBtn}
                          onClick={() =>
                            setCommentsVisible((n) => n + 5)
                          }
                          type="button"
                        >
                          {t("prediction.commentShowMore")}
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </section>

            {related.length > 0 ? (
              <section className={styles.panel}>
                <h2 className={styles.pmSectionTitle}>
                  {t("prediction.related")}
                </h2>
                <div className={styles.relatedList}>
                  {related.map((rel) => (
                    <RelatedCard
                      currencyCode={currencyCode}
                      event={rel}
                      key={rel.id}
                      locale={locale}
                      t={t}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          <aside className={styles.orderPanel} id="prediction-order">
            <div className={styles.pmTicket}>
              <div className={styles.pmOrderHead}>
                <span className={styles.pmOrderTabActive}>
                  {t("prediction.deal")}
                </span>
              </div>

              <div className={styles.pmPickList} role="group">
                <button
                  aria-pressed={side === "A"}
                  className={`${styles.pmBuyBtn} ${styles.pmBuyYes} ${
                    side === "A" ? styles.pmBuyYesOn : ""
                  }`}
                  onClick={() => setSide("A")}
                  type="button"
                >
                  <span className={styles.pmBuyLabel}>{yesLabel}</span>
                  <span className={styles.pmBuyPrice}>
                    {formatChanceCents(shareA, currencyCode)}
                  </span>
                </button>
                <button
                  aria-pressed={side === "B"}
                  className={`${styles.pmBuyBtn} ${styles.pmBuyNo} ${
                    side === "B" ? styles.pmBuyNoOn : ""
                  }`}
                  onClick={() => setSide("B")}
                  type="button"
                >
                  <span className={styles.pmBuyLabel}>{noLabel}</span>
                  <span className={styles.pmBuyPrice}>
                    {formatChanceCents(shareB, currencyCode)}
                  </span>
                </button>
              </div>

              <div className={styles.pmAmountBlock}>
                <div className={styles.pmAmountHead}>
                  <label className={styles.fieldLabel} htmlFor="pm-stake">
                    {t("prediction.amount")}
                  </label>
                  {isAuth && balanceAmount != null ? (
                    <button
                      className={styles.balanceChip}
                      onClick={() => setStake(effectiveMaxStake)}
                      type="button"
                    >
                      {t("prediction.balance")}{" "}
                      <strong>
                        {Math.floor(balanceAmount).toLocaleString(intlLocale)}{" "}
                        {currencyCode}
                      </strong>
                    </button>
                  ) : null}
                </div>
                <div className={styles.pmAmountWrap}>
                  <input
                    className={styles.stakeInput}
                    id="pm-stake"
                    max={effectiveMaxStake}
                    min={minStake}
                    onChange={(e) => setStake(Number(e.target.value) || 0)}
                    type="number"
                    value={stake}
                  />
                  <span className={styles.pmAmountCurrency}>{currencyCode}</span>
                </div>
                <div className={styles.quickRow}>
                  {quickAmounts.map((amt) => (
                    <button
                      className={styles.quickBtn}
                      key={amt}
                      onClick={() =>
                        setStake((prev) =>
                          Math.min(effectiveMaxStake, Number(prev) + amt),
                        )
                      }
                      type="button"
                    >
                      +{amt >= 1000 ? `${amt / 1000}K` : amt}
                    </button>
                  ))}
                  {isAuth && balanceAmount != null ? (
                    <button
                      className={styles.quickBtn}
                      onClick={() => setStake(effectiveMaxStake)}
                      type="button"
                    >
                      {t("prediction.maxStakeBtn")}
                    </button>
                  ) : null}
                </div>
              </div>

              <div className={styles.pmTicketMeta}>
                <div className={styles.pmTicketMetaRow}>
                  <span>{t("prediction.odds")}</span>
                  <strong>{selected ? selected.odds.toFixed(2) : "—"}</strong>
                </div>
                <div className={`${styles.pmTicketMetaRow} ${styles.pmToWin}`}>
                  <span>{t("prediction.toWin")}</span>
                  <strong>
                    {potential != null ? `${potential} ${currencyCode}` : "—"}
                  </strong>
                </div>
                {profit != null && Number(profit) > 0 ? (
                  <div
                    className={`${styles.pmTicketMetaRow} ${styles.summaryProfit}`}
                  >
                    <span>{t("prediction.profit")}</span>
                    <strong>
                      +{profit} {currencyCode}
                    </strong>
                  </div>
                ) : null}
              </div>

              <button
                className={`${styles.submitBtn} ${
                  side === "A" ? styles.submitYes : styles.submitNo
                }`}
                disabled={!event.bettingOpen || busy || !selected}
                onClick={() => void place()}
                type="button"
              >
                {busy
                  ? t("prediction.submitting")
                  : t("prediction.deal")}
              </button>

              {!isAuth ? (
                <p className={styles.hint}>
                  <Link className={styles.loginLink} href="/login">
                    {t("prediction.loginToBet")}
                  </Link>
                </p>
              ) : null}
              {!event.bettingOpen ? (
                <p className={styles.hint}>{t("prediction.bettingClosed")}</p>
              ) : (
                <p className={styles.hint}>
                  {t("prediction.stakeLimits", {
                    min: minStake,
                    max: maxStake,
                    currency: currencyCode,
                  })}
                </p>
              )}

              {error ? <div className={styles.error}>{error}</div> : null}
              {ok ? <div className={styles.success}>{ok}</div> : null}
            </div>

            <div className={styles.pmTicketStats}>
              <div className={styles.statRow}>
                <span>{t("prediction.volumeLabel")}</span>
                <strong>{formatPredictionVolumeUsd(total)}</strong>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {event.bettingOpen ? (
        <div className={styles.mobileStickyBet}>
          <div className={styles.mobileStickyInfo}>
            <span className={styles.mobileStickySide}>
              {side === "A" ? yesLabel : noLabel}
            </span>
            <strong>
              {selected ? selected.odds.toFixed(2) : "—"}
              {potential != null ? (
                <span className={styles.mobileStickyWin}>
                  {" "}
                  · {potential} {currencyCode}
                </span>
              ) : null}
            </strong>
          </div>
          <button
            className={`${styles.mobileStickyBtn} ${
              side === "A" ? styles.submitYes : styles.submitNo
            }`}
            disabled={busy || !selected}
            onClick={() => {
              const panel = document.getElementById("prediction-order");
              if (panel) {
                const rect = panel.getBoundingClientRect();
                if (rect.top > window.innerHeight * 0.55 || rect.bottom < 0) {
                  panel.scrollIntoView({ behavior: "smooth", block: "center" });
                  return;
                }
              }
              void place();
            }}
            type="button"
          >
            {busy
              ? t("prediction.submitting")
              : t("prediction.deal")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
