"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "next-nprogress-bar";

import { useAuth } from "~/app/providers/AuthProvider";
import {
  createSupportSessionId,
  fetchSupportConfig,
  fetchSupportMessages,
  fetchSupportSession,
  fetchSupportStats,
  sendSupportMessage,
  submitSupportCsat,
  uploadSupportImage,
  type SupportChatMessage,
  type SupportConfig,
  type SupportSessionMeta,
  type SupportSessionStatus,
  type SupportStats,
} from "~/entities/support/api/client";
import { getSupportPageHint } from "~/entities/support/lib/supportExtras";
import { ArrowUpIcon, CloseIcon } from "~/shared/assets/icons";
import { useLocale } from "~/shared/model/useLocale";

import { ChatBubbleText } from "./ChatBubbleText";
import styles from "./LiveSupportChat.module.css";

const STORAGE_KEY = "imba_support_chat_v1";
const READ_AT_KEY = "imba_support_read_at_v1";
const WELCOME_ID = "welcome";

function makeWelcomeMessage(text: string): SupportChatMessage {
  return {
    id: WELCOME_ID,
    role: "agent",
    text,
    at: 0,
  };
}

type StoredChat = {
  sessionId: string;
  messages: SupportChatMessage[];
};

function loadStoredChat(welcome: SupportChatMessage): StoredChat {
  if (typeof window === "undefined") {
    return { sessionId: createSupportSessionId(), messages: [welcome] };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { sessionId: createSupportSessionId(), messages: [welcome] };
    }
    const parsed = JSON.parse(raw) as StoredChat;
    if (!parsed.sessionId || !Array.isArray(parsed.messages)) {
      return { sessionId: createSupportSessionId(), messages: [welcome] };
    }
    const messages = parsed.messages.length ? parsed.messages : [welcome];
    return {
      sessionId: parsed.sessionId,
      messages: messages.map((m) =>
        m.id === WELCOME_ID ? { ...m, text: welcome.text } : m,
      ),
    };
  } catch {
    return { sessionId: createSupportSessionId(), messages: [welcome] };
  }
}

function saveStoredChat(data: StoredChat) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota errors */
  }
}

function loadReadAt(): number {
  if (typeof window === "undefined") return 0;
  const raw = localStorage.getItem(READ_AT_KEY);
  const value = Number.parseInt(raw || "0", 10);
  return Number.isFinite(value) ? value : 0;
}

function saveReadAt(at: number) {
  try {
    localStorage.setItem(READ_AT_KEY, String(at));
  } catch {
    /* ignore */
  }
}

function mergeMessages(
  current: SupportChatMessage[],
  incoming: SupportChatMessage[],
): SupportChatMessage[] {
  const map = new Map<string, SupportChatMessage>();
  for (const item of current) map.set(item.id, item);
  for (const item of incoming) {
    if (item.role === "user" && item.status === "sending") continue;
    map.set(item.id, item);
  }
  return Array.from(map.values()).sort((a, b) => a.at - b.at);
}

function countUnread(messages: SupportChatMessage[], readAt: number) {
  return messages.filter(
    (item) =>
      item.role !== "user" &&
      item.at > readAt &&
      (item.text?.trim() || item.imageUrl),
  ).length;
}

function isAuthOnlyPath(pathname: string) {
  return pathname.startsWith("/deposit") || pathname.startsWith("/profile");
}

function playIncomingSound() {
  try {
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.04;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
    window.setTimeout(() => void ctx.close(), 200);
  } catch {
    /* ignore autoplay restrictions */
  }
}

function ChatBubblesIcon() {
  return (
    <svg className={styles.launcherSvg} viewBox="0 0 576 512" aria-hidden>
      <path
        fill="currentColor"
        d="M416 192c0-88.4-93.1-160-208-160S0 103.6 0 192c0 34.3 14.1 65.9 38 92-13.4 30.2-35.5 54.2-35.8 54.5-2.2 2.3-2.8 5.7-1.5 8.7S4.8 352 8 352c36.6 0 66.9-12.3 88.7-25 32.2 15.7 70.3 25 111.3 25 114.9 0 208-71.6 208-160zm122 220c23.9-26 38-57.7 38-92 0-66.9-53.5-124.2-129.3-148.1.9 6.6 1.3 13.3 1.3 20.1 0 105.9-107.7 192-240 192-10.8 0-21.3-.8-31.7-1.9C207.8 439.6 281.8 480 368 480c41 0 79.1-9.2 111.3-25 21.8 12.7 52.1 25 88.7 25 3.2 0 6.1-1.9 7.3-4.8 1.3-2.9.7-6.3-1.5-8.7-.3-.3-22.4-24.2-35.8-54.5z"
      />
    </svg>
  );
}

function TelegramLauncherIcon() {
  return (
    <svg className={styles.launcherSvg} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M21.805 3.197 2.696 10.7c-1.305.522-1.292 1.25-.223 1.574l4.9 1.53 1.89 5.838c.233.72.42.99.98.99.645 0 .927-.3 1.282-.65l2.9-2.81 5.62 4.15c1.03.567 1.778.274 2.036-.958L23.72 4.82c.38-1.52-.547-2.2-1.915-1.623ZM9.4 14.086l-.23 3.25-1.04-3.43L20.6 6.2 9.4 14.086Z"
      />
    </svg>
  );
}

function AttachIcon() {
  return (
    <svg className={styles.attachIcon} viewBox="0 0 24 24" aria-hidden>
      <rect className={styles.attachIconFrame} x="3" y="4.5" width="18" height="15" rx="2.5" />
      <circle className={styles.attachIconDot} cx="8.25" cy="9.25" r="1.35" />
      <path className={styles.attachIconHill} d="M6.5 16.5 10 12.5l2.75 2.75L16.5 11 19 13.5" />
    </svg>
  );
}

export function LiveSupportChat() {
  const pathname = usePathname() || "";
  const router = useRouter();
  const { isAuth } = useAuth();
  const { t, format } = useLocale();
  const welcome = useMemo(() => makeWelcomeMessage(t("support.welcome")), [t]);
  const authOnlyPage = isAuthOnlyPath(pathname);
  const chatBlocked = authOnlyPage && !isAuth;
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<SupportSessionStatus>("online");
  const [sessionMeta, setSessionMeta] = useState<SupportSessionMeta | null>(null);
  const [supportStats, setSupportStats] = useState<SupportStats>({
    avgResponseMin: 3,
    under5mPct: 0,
    openCount: 0,
    pendingOver10m: 0,
  });
  const [csatSending, setCsatSending] = useState(false);
  const [readAt, setReadAt] = useState(0);
  const [config, setConfig] = useState<SupportConfig>({
    botUsername: "imbabetalert_bot",
    telegramLabel: t("support.chatLabel"),
    telegramUrl: "https://t.me/imbabetchat",
  });
  const [chat, setChat] = useState<StoredChat>(() => ({
    sessionId: "",
    messages: [makeWelcomeMessage(t("support.welcome"))],
  }));
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const hydrated = useRef(false);
  const lastNotifiedAt = useRef(0);

  useEffect(() => {
    setReadAt(loadReadAt());
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapChat() {
      const stored = loadStoredChat(welcome);
      if (isAuth) {
        const remote = await fetchSupportSession();
        if (!cancelled && remote.sessionId) {
          setSessionMeta(remote.meta);
          setChat({
            sessionId: remote.sessionId,
            messages: remote.messages.length
              ? mergeMessages([welcome], remote.messages)
              : stored.messages,
          });
          hydrated.current = true;
          return;
        }
        if (!cancelled && isAuth && !remote.sessionId) {
          setSessionMeta(null);
          setChat({
            sessionId: stored.sessionId || createSupportSessionId(),
            messages: stored.messages.length ? stored.messages : [welcome],
          });
          hydrated.current = true;
          return;
        }
      }
      if (!cancelled) {
        setChat(stored);
        hydrated.current = true;
      }
    }

    void bootstrapChat();
    return () => {
      cancelled = true;
    };
  }, [isAuth, welcome]);

  useEffect(() => {
    setChat((prev) => ({
      ...prev,
      messages: prev.messages.map((m) =>
        m.id === WELCOME_ID ? { ...m, text: welcome.text } : m,
      ),
    }));
  }, [welcome]);

  const pageHint = useMemo(() => getSupportPageHint(pathname, t), [pathname, t]);

  useEffect(() => {
    fetchSupportConfig().then(setConfig).catch(() => undefined);
    fetchSupportStats().then(setSupportStats).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!hydrated.current || !chat.sessionId) return;
    saveStoredChat(chat);
  }, [chat]);

  const lastSyncAt = useMemo(
    () => chat.messages.reduce((max, item) => Math.max(max, item.at || 0), 0),
    [chat.messages],
  );

  const unreadCount = useMemo(
    () => (open ? 0 : countUnread(chat.messages, readAt)),
    [chat.messages, open, readAt],
  );

  const markRead = useCallback((messages: SupportChatMessage[]) => {
    const latest = messages.reduce((max, item) => Math.max(max, item.at || 0), 0);
    if (latest <= 0) return;
    setReadAt(latest);
    saveReadAt(latest);
  }, []);

  const scrollToBottom = useCallback(() => {
    const node = listRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, []);

  useEffect(() => {
    if (open) {
      markRead(chat.messages);
      scrollToBottom();
    }
  }, [open, chat.messages, markRead, scrollToBottom]);

  useEffect(() => {
    if (!chat.sessionId) return undefined;

    let cancelled = false;
    const poll = async () => {
      const { messages: remote, status, meta } = await fetchSupportMessages(chat.sessionId, lastSyncAt);
      if (cancelled) return;
      setSessionStatus(status);
      if (meta) setSessionMeta(meta);
      if (remote.length === 0) return;

      const incomingAgent = remote.filter(
        (item) => item.role !== "user" && item.at > lastNotifiedAt.current,
      );
      if (!open && incomingAgent.length > 0) {
        const newest = incomingAgent.reduce((max, item) => Math.max(max, item.at || 0), 0);
        if (newest > lastNotifiedAt.current) {
          lastNotifiedAt.current = newest;
          playIncomingSound();
        }
      }

      setChat((prev) => ({
        ...prev,
        messages: mergeMessages(prev.messages, remote),
      }));
    };

    poll();
    const timer = window.setInterval(poll, open ? 4000 : 6000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [open, chat.sessionId, lastSyncAt]);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [open]);

  const pageMeta = useMemo(() => {
    if (typeof window === "undefined") return { pageTitle: undefined, pageUrl: undefined };
    return {
      pageTitle: document.title,
      pageUrl: window.location.href,
    };
  }, [open]);

  const dispatchMessage = useCallback(
    async (text: string, imageUrl?: string) => {
      if (sending || uploading || !chat.sessionId) return;
      if (!text.trim() && !imageUrl) return;

      const tempId = `local-${Date.now()}`;
      const optimistic: SupportChatMessage = {
        id: tempId,
        role: "user",
        text: text.trim() || t("support.screenshotFallback"),
        at: Date.now(),
        status: "sending",
        imageUrl,
      };

      setSending(true);
      setChat((prev) => ({
        ...prev,
        messages: mergeMessages(prev.messages, [optimistic]),
      }));

      try {
        const result = await sendSupportMessage({
          sessionId: chat.sessionId,
          message: text.trim(),
          pageTitle: pageMeta.pageTitle,
          pageUrl: pageMeta.pageUrl,
          imageUrl,
        });

        const { messages: remote } = await fetchSupportMessages(chat.sessionId, 0);
        if (!result.ok) {
          const offlineMessage: SupportChatMessage = {
            id: `offline-${Date.now()}`,
            role: "agent",
            text: result.error || t("support.operatorOfflineTg"),
            at: Date.now(),
          };
          setChat((prev) => ({
            ...prev,
            messages: mergeMessages(
              prev.messages.map((item) =>
                item.id === tempId ? { ...item, status: "failed" as const } : item,
              ),
              remote.length ? remote : [offlineMessage],
            ),
          }));
          return;
        }

        setSessionStatus("delivered");
        setChat((prev) => ({
          ...prev,
          messages: remote.length
            ? mergeMessages([welcome], remote)
            : prev.messages.map((item) =>
                item.id === tempId ? { ...item, status: "sent" as const } : item,
              ),
        }));
      } catch {
        setChat((prev) => ({
          ...prev,
          messages: prev.messages.map((item) =>
            item.id === tempId ? { ...item, status: "failed" as const } : item,
          ),
        }));
      } finally {
        setSending(false);
      }
    },
    [chat.sessionId, pageMeta.pageTitle, pageMeta.pageUrl, sending, uploading, welcome, t],
  );

  const onSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || uploading) return;
    setInput("");
    await dispatchMessage(text);
  }, [dispatchMessage, input, sending, uploading]);

  const onAttach = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || uploading || sending) return;
      setUploading(true);
      try {
        const uploaded = await uploadSupportImage(file);
        if (!uploaded.ok || !uploaded.url) {
          setChat((prev) => ({
            ...prev,
            messages: mergeMessages(prev.messages, [
              {
                id: `upload-fail-${Date.now()}`,
                role: "agent",
                text: uploaded.error || t("support.uploadFailed"),
                at: Date.now(),
              },
            ]),
          }));
          return;
        }
        const caption = input.trim();
        if (caption) setInput("");
        await dispatchMessage(caption, uploaded.url);
      } finally {
        setUploading(false);
      }
    },
    [dispatchMessage, input, sending, uploading, t],
  );

  const onCsat = useCallback(
    async (rating: number) => {
      if (!chat.sessionId || csatSending) return;
      setCsatSending(true);
      try {
        await submitSupportCsat(chat.sessionId, rating);
        setSessionMeta((prev) => ({ ...prev, awaitingCsat: false, csat: rating, closed: true }));
      } finally {
        setCsatSending(false);
      }
    },
    [chat.sessionId, csatSending],
  );

  const slaLine = useMemo(() => {
    const mins = supportStats.avgResponseMin || 3;
    const pct = supportStats.under5mPct || 0;
    if (pct > 0) {
      return t("support.slaAvgPct", { mins, pct });
    }
    return t("support.slaAvg", { mins });
  }, [supportStats.avgResponseMin, supportStats.under5mPct, t]);

  const statusText =
    sessionStatus === "reading"
      ? t("support.statusReading")
      : sessionStatus === "delivered"
        ? t("support.statusDelivered")
        : t("support.statusOnline");

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void onSend();
    }
  };

  return (
    <div className={styles.root}>
      {open ? (
        <div className={styles.panel} role="dialog" aria-label={t("support.onlineChat")}>
          <header className={styles.header}>
            <div className={styles.headerMain}>
              <div className={styles.avatar}>S</div>
              <div className={styles.headerText}>
                <p className={styles.title}>{t("support.onlineChat")}</p>
                <p
                  className={`${styles.online} ${
                    sessionStatus === "reading"
                      ? styles.statusReading
                      : sessionStatus === "delivered"
                        ? styles.statusDelivered
                        : ""
                  }`}
                >
                  <span className={styles.onlineDot} aria-hidden />
                  {statusText}
                </p>
                <p className={styles.sla}>{slaLine}</p>
              </div>
            </div>
            <button
              type="button"
              className={styles.headerClose}
              aria-label={t("support.collapseChat")}
              onClick={() => setOpen(false)}
            >
              <CloseIcon className={styles.headerCloseIcon} aria-hidden />
            </button>
          </header>

          {pageHint && !chatBlocked ? (
            <div className={styles.pageHint}>{pageHint}</div>
          ) : null}

          <div ref={listRef} className={styles.messages}>
            {chatBlocked ? (
              <div className={styles.authGate}>
                <p className={styles.authGateText}>
                  {t("support.authOnlyPage")}
                </p>
                <a className={styles.authGateLink} href="/login">
                  {t("support.loginCta")}
                </a>
              </div>
            ) : (
              chat.messages
                .filter((message) => message.text?.trim() || message.imageUrl)
                .map((message) => (
                  <div
                    key={message.id}
                    className={`${styles.row} ${message.role === "user" ? styles.rowUser : styles.rowAgent}`}
                  >
                    {message.role !== "user" ? (
                      <div className={styles.messageAvatar} aria-hidden>
                        S
                      </div>
                    ) : null}
                    <div
                      className={`${styles.bubble} ${
                        message.role === "user" ? styles.bubbleUser : styles.bubbleAgent
                      } ${message.status === "failed" ? styles.bubbleFailed : ""}`}
                    >
                      {message.imageUrl ? (
                        <a href={message.imageUrl} target="_blank" rel="noopener noreferrer">
                          <img
                            className={styles.bubbleImage}
                            src={message.imageUrl}
                            alt={t("support.screenshotAlt")}
                          />
                        </a>
                      ) : null}
                      {message.text?.trim() ? (
                        <ChatBubbleText
                          text={message.text}
                          isUser={message.role === "user"}
                          isAuth={isAuth}
                          onNeedAuth={() => router.push("/login")}
                        />
                      ) : null}
                      {message.at ? (
                        <span className={styles.bubbleTime}>{format.time(message.at)}</span>
                      ) : null}
                    </div>
                  </div>
                ))
            )}
          </div>

          {sessionMeta?.awaitingCsat && !chatBlocked ? (
            <div className={styles.csat}>
              <p className={styles.csatTitle}>{t("support.csatTitle")}</p>
              <div className={styles.csatStars}>
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    className={styles.csatStar}
                    disabled={csatSending}
                    aria-label={t("support.ratingAria", { rating })}
                    onClick={() => void onCsat(rating)}
                  >
                    {rating}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {!chatBlocked && !sessionMeta?.awaitingCsat ? (
            <div className={styles.composer}>
              <input
                ref={fileRef}
                className={styles.attachInput}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(event) => void onAttach(event)}
              />
              <button
                type="button"
                className={styles.attach}
                aria-label={t("support.attachScreenshot")}
                disabled={sending || uploading}
                onClick={() => fileRef.current?.click()}
              >
                <AttachIcon />
              </button>
              <input
                ref={inputRef}
                className={styles.input}
                type="text"
                placeholder={t("support.messagePlaceholder")}
                value={input}
                maxLength={2000}
                disabled={uploading}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={onKeyDown}
              />
              <button
                type="button"
                className={styles.send}
                aria-label={t("support.send")}
                disabled={sending || uploading || !input.trim()}
                onClick={() => void onSend()}
              >
                <ArrowUpIcon className={styles.sendIcon} aria-hidden />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className={styles.launcher} role="group" aria-label={t("support.247")}>
        <a
          className={`${styles.launcherSegment} ${styles.launcherTelegram}`}
          href="https://t.me/imbabetchat"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Telegram @imbabetchat"
        >
          <TelegramLauncherIcon />
        </a>
        <span className={styles.launcherLabel}>24/7</span>
        {!chatBlocked ? (
          <button
            type="button"
            className={`${styles.launcherSegment} ${styles.launcherChat} ${open ? styles.launcherSegmentActive : ""}`}
            aria-label={open ? t("support.collapseChat") : t("support.openChat")}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? (
              <CloseIcon className={styles.launcherCloseIcon} aria-hidden />
            ) : (
              <>
                <ChatBubblesIcon />
                {unreadCount > 0 ? (
                  <span className={styles.unreadBadge} aria-label={t("support.unreadAria", { n: unreadCount })}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                ) : null}
              </>
            )}
          </button>
        ) : null}
      </div>
    </div>
  );
}
