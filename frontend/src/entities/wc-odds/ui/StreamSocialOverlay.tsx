"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";

import {
  fetchStreamSocial,
  postStreamComment,
  reportStreamComment,
  streamSocialLiveUrl,
  toggleStreamLike,
  type StreamSocialComment,
} from "~/entities/wc-odds/api/streamSocial";
import { getSessionClient } from "~/entities/user/lib/getSessionClient";
import { MQ_BELOW_DESKTOP } from "~/shared/lib/layoutBreakpoints";
import { useLocale } from "~/shared/model/useLocale";
import { cn } from "~/shared/lib";

import styles from "./StreamSocialOverlay.module.css";

const POLL_FALLBACK_MS = 12_000;
const MAX_VISIBLE = 10;
const COMMENT_MAX = 120;
const COLLAPSE_KEY = "imba_stream_chat_collapsed_v1";
const TOAST_MS = 3_800;

type HeartBurst = { id: string; x: number };
type ToastItem = { id: string; name: string; body: string };

type StreamSocialOverlayProps = {
  streamKey: string;
  className?: string;
};

function readCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(value: boolean) {
  try {
    localStorage.setItem(COLLAPSE_KEY, value ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function relativeShort(iso: string) {
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return "";
  const sec = Math.floor(ms / 1000);
  if (sec < 45) return "now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}

function ChatIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width={size}
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function HeartIcon({ filled, size = 16 }: { filled?: boolean; size?: number }) {
  return (
    <svg
      fill={filled ? "currentColor" : "none"}
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width={size}
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

export function StreamSocialOverlay({
  streamKey,
  className,
}: StreamSocialOverlayProps) {
  const { t } = useLocale();
  const uid = useId();
  const [likeCount, setLikeCount] = useState(0);
  const [likedByMe, setLikedByMe] = useState(false);
  const [canComment, setCanComment] = useState(false);
  const [canCommentReason, setCanCommentReason] = useState<
    "need_login" | "need_bet" | null
  >("need_login");
  const [comments, setComments] = useState<StreamSocialComment[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [hearts, setHearts] = useState<HeartBurst[]>([]);
  const seenIds = useRef<Set<number>>(new Set());
  const [freshIds, setFreshIds] = useState<Set<number>>(new Set());
  const sseOk = useRef(false);
  const [collapsed, setCollapsed] = useState(false);
  const [unread, setUnread] = useState(0);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [isDesktop, setIsDesktop] = useState(true);
  const collapsedRef = useRef(false);

  const isAuth = Boolean(getSessionClient());

  useEffect(() => {
    setCollapsed(readCollapsed());
  }, []);

  useEffect(() => {
    collapsedRef.current = collapsed;
  }, [collapsed]);

  useEffect(() => {
    const mq = window.matchMedia(MQ_BELOW_DESKTOP);
    const sync = () => setIsDesktop(!mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const setCollapsedPersist = (value: boolean) => {
    setCollapsed(value);
    writeCollapsed(value);
    if (!value) {
      setUnread(0);
      setToasts([]);
      setSendError(null);
    }
  };

  const pushToast = useCallback((comment: StreamSocialComment) => {
    const id = `${uid}-t-${comment.id}-${Date.now()}`;
    setToasts((prev) =>
      [
        ...prev,
        {
          id,
          name: comment.user.name,
          body: comment.body.slice(0, 80),
        },
      ].slice(-3),
    );
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, TOAST_MS);
  }, [uid]);

  const pushComment = useCallback(
    (created: StreamSocialComment) => {
      if (seenIds.current.has(created.id)) return;
      seenIds.current.add(created.id);
      setComments((prev) => [...prev, created].slice(-40));
      setFreshIds(new Set([created.id]));
      window.setTimeout(() => setFreshIds(new Set()), 2400);
      if (collapsedRef.current) {
        setUnread((n) => Math.min(99, n + 1));
        pushToast(created);
      }
    },
    [pushToast],
  );

  const refresh = useCallback(async () => {
    if (!streamKey) return;
    try {
      const snap = await fetchStreamSocial(streamKey);
      setLikeCount(snap.likeCount);
      setLikedByMe(snap.likedByMe);
      setCanComment(snap.canComment);
      setCanCommentReason(snap.canCommentReason);
      setComments(snap.comments);
      for (const c of snap.comments) seenIds.current.add(c.id);
    } catch {
      /* ignore */
    }
  }, [streamKey]);

  useEffect(() => {
    seenIds.current = new Set();
    sseOk.current = false;
    void refresh();

    let es: EventSource | null = null;
    let pollId: number | undefined;
    try {
      es = new EventSource(streamSocialLiveUrl(streamKey), {
        withCredentials: true,
      });
      es.onopen = () => {
        sseOk.current = true;
      };
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data) as {
            type?: string;
            comment?: StreamSocialComment;
            likeCount?: number;
            commentId?: number;
          };
          if (data.type === "comment" && data.comment) {
            pushComment(data.comment);
          } else if (data.type === "like" && typeof data.likeCount === "number") {
            setLikeCount(data.likeCount);
          } else if (data.type === "hide" && typeof data.commentId === "number") {
            setComments((prev) => prev.filter((c) => c.id !== data.commentId));
          }
        } catch {
          /* ignore */
        }
      };
      es.onerror = () => {
        sseOk.current = false;
      };
    } catch {
      es = null;
    }

    pollId = window.setInterval(() => {
      if (!sseOk.current) void refresh();
    }, POLL_FALLBACK_MS);

    return () => {
      es?.close();
      if (pollId) window.clearInterval(pollId);
    };
  }, [streamKey, refresh, pushComment]);

  const spawnHeart = () => {
    const id = `${uid}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const x = 8 + Math.random() * 28;
    setHearts((prev) => [...prev.slice(-8), { id, x }]);
    window.setTimeout(() => {
      setHearts((prev) => prev.filter((h) => h.id !== id));
    }, 1100);
  };

  const onLike = async () => {
    if (!isAuth) {
      window.location.href = "/login";
      return;
    }
    if (busy) return;
    setBusy(true);
    const wasLiked = likedByMe;
    setLikedByMe(!wasLiked);
    setLikeCount((n) => Math.max(0, n + (wasLiked ? -1 : 1)));
    if (!wasLiked) spawnHeart();
    try {
      const res = await toggleStreamLike(streamKey);
      setLikedByMe(res.liked);
      setLikeCount(res.likeCount);
      if (res.liked) spawnHeart();
    } catch {
      setLikedByMe(wasLiked);
      setLikeCount((n) => Math.max(0, n + (wasLiked ? 1 : -1)));
    } finally {
      setBusy(false);
    }
  };

  const onSend = async () => {
    if (!isAuth) {
      window.location.href = "/login";
      return;
    }
    if (!canComment) {
      setSendError(t("wc.streamCommentNeedBet"));
      return;
    }
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setSendError(null);
    try {
      const created = await postStreamComment(streamKey, text);
      setDraft("");
      pushComment(created);
    } catch (e) {
      setSendError(
        e instanceof Error ? e.message : t("wc.streamCommentNeedBet"),
      );
    } finally {
      setBusy(false);
    }
  };

  const onReport = async (commentId: number) => {
    if (!isAuth) {
      window.location.href = "/login";
      return;
    }
    try {
      await reportStreamComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch {
      /* ignore */
    }
  };

  const visible = comments.slice(-MAX_VISIBLE);
  const gateText =
    canCommentReason === "need_bet"
      ? t("wc.streamCommentNeedBet")
      : t("wc.streamCommentLogin");

  return (
    <div
      className={cn(styles.overlay, className)}
      data-stream-social={streamKey}
    >
      {collapsed ? (
        <>
          <div className={styles.toastStack} aria-live="polite">
            {toasts.map((toast) => (
              <button
                className={styles.toast}
                key={toast.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setCollapsedPersist(false);
                }}
                type="button"
              >
                <span className={styles.toastName}>{toast.name}</span>
                <span className={styles.toastBody}>{toast.body}</span>
              </button>
            ))}
          </div>

          <div className={styles.collapsedStack}>
            <button
              aria-label={t("wc.streamChatShow")}
              className={styles.collapsedBtn}
              onClick={(e) => {
                e.stopPropagation();
                setCollapsedPersist(false);
              }}
              type="button"
            >
              <ChatIcon />
              {unread > 0 ? (
                <span className={styles.unreadBadge}>
                  {unread > 99 ? "99+" : unread}
                </span>
              ) : null}
            </button>

            <button
              aria-label={t("wc.streamLike")}
              aria-pressed={likedByMe}
              className={cn(
                styles.collapsedBtn,
                likedByMe && styles.likeOn,
              )}
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                void onLike();
              }}
              type="button"
            >
              <HeartIcon filled={likedByMe} size={18} />
              {likeCount > 0 ? (
                <span className={styles.collapsedLikeCount}>
                  {likeCount > 999
                    ? `${Math.floor(likeCount / 100) / 10}k`
                    : likeCount}
                </span>
              ) : null}
            </button>
          </div>

          <div className={styles.heartLayerCollapsed} aria-hidden>
            {hearts.map((h) => (
              <span
                className={styles.heartFloat}
                key={h.id}
                style={{ right: `${h.x}px` }}
              >
                ♥
              </span>
            ))}
          </div>
        </>
      ) : (
        <aside
          className={cn(
            styles.rightDock,
            isDesktop && styles.rightDockPanel,
          )}
        >
          <div className={styles.liveBadgeRow}>
            <div className={styles.liveBadge}>
              <span aria-hidden className={styles.liveDot} />
              {t("wc.streamChatLive")}
              {comments.length > 0 ? (
                <span className={styles.liveCount}>{comments.length}</span>
              ) : null}
            </div>
            <button
              aria-label={t("wc.streamChatHide")}
              className={styles.hideBtn}
              onClick={(e) => {
                e.stopPropagation();
                setCollapsedPersist(true);
              }}
              type="button"
            >
              <svg
                fill="none"
                height="14"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="14"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className={styles.commentsRail} aria-live="polite">
            {visible.map((row) => (
              <div
                className={cn(
                  styles.bubble,
                  freshIds.has(row.id) && styles.bubbleFresh,
                )}
                key={row.id}
              >
                <span aria-hidden className={styles.avatar}>
                  {initials(row.user.name)}
                </span>
                <div className={styles.bubbleMain}>
                  <div className={styles.bubbleTop}>
                    <span className={styles.bubbleName}>{row.user.name}</span>
                    <span className={styles.bubbleTime}>
                      {relativeShort(row.createdAt)}
                    </span>
                    {isAuth ? (
                      <button
                        aria-label={t("wc.streamCommentReport")}
                        className={styles.reportBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          void onReport(row.id);
                        }}
                        type="button"
                      >
                        ⋯
                      </button>
                    ) : null}
                  </div>
                  <span className={styles.bubbleBody}>{row.body}</span>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.dockActions}>
            <button
              aria-label={t("wc.streamLike")}
              aria-pressed={likedByMe}
              className={cn(styles.actionBtn, likedByMe && styles.likeOn)}
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                void onLike();
              }}
              type="button"
            >
              <HeartIcon filled={likedByMe} />
              {likeCount > 0 ? (
                <span className={styles.likeCount}>
                  {likeCount > 999
                    ? `${Math.floor(likeCount / 100) / 10}k`
                    : likeCount}
                </span>
              ) : null}
            </button>
          </div>

          <div className={styles.heartLayer} aria-hidden>
            {hearts.map((h) => (
              <span
                className={styles.heartFloat}
                key={h.id}
                style={{ right: `${h.x}px` }}
              >
                ♥
              </span>
            ))}
          </div>

          <div
            className={styles.composer}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {canComment ? (
              <>
                <input
                  className={styles.composerInput}
                  maxLength={COMMENT_MAX}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void onSend();
                    }
                  }}
                  placeholder={t("wc.streamCommentPlaceholder")}
                  value={draft}
                />
                <button
                  className={styles.composerSend}
                  disabled={busy || draft.trim().length < 1}
                  onClick={() => void onSend()}
                  type="button"
                >
                  {t("wc.streamCommentSend")}
                </button>
              </>
            ) : (
              <p className={styles.composerLogin}>
                {canCommentReason === "need_login" ? (
                  <Link href="/login">{gateText}</Link>
                ) : (
                  gateText
                )}
              </p>
            )}
            {sendError ? (
              <p className={styles.composerError}>{sendError}</p>
            ) : null}
          </div>
        </aside>
      )}
    </div>
  );
}
