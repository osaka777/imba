"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import { Support as SupportAvatar } from "@/shared/assets/images";
import { TelegramIcon } from "@/shared/assets";

import {
  createSupportSessionId,
  fetchKickSupportConfig,
  loadSupportSession,
  pollKickSupportMessages,
  saveSupportSession,
  sendKickSupportMessage,
  type KickSupportConfig,
  type KickSupportMessage,
} from "./support-api";
import styles from "./kick-support-dock.module.css";

const MANAGER_URL = "https://t.me/imbabetofficial";
const MANAGER_HANDLE = "@imbabetofficial";
const WELCOME: KickSupportMessage = {
  id: "welcome",
  role: "agent",
  text: "Привет! Поможем подключить Kick, настроить OBS и ответим по RevShare. Напишите вопрос 👇",
  at: 0,
};

type Tab = "chat" | "manager";

function formatTime(at: number) {
  if (!at) return "";
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(new Date(at));
}

export function KickSupportDock() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("chat");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [config, setConfig] = useState<KickSupportConfig | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<KickSupportMessage[]>([WELCOME]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = loadSupportSession();
    setSessionId(stored.sessionId || createSupportSessionId());
    setMessages(stored.messages.length ? [WELCOME, ...stored.messages] : [WELCOME]);
    void fetchKickSupportConfig().then(setConfig);
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    saveSupportSession({
      sessionId,
      messages: messages.filter((m) => m.id !== "welcome"),
    });
  }, [messages, sessionId]);

  useEffect(() => {
    if (!open || !sessionId) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  const lastAt = messages.reduce((max, m) => Math.max(max, m.at || 0), 0);

  useEffect(() => {
    if (!open || !sessionId) return;
    const timer = window.setInterval(async () => {
      const incoming = await pollKickSupportMessages(sessionId, lastAt);
      if (!incoming.length) return;
      setMessages((prev) => {
        const map = new Map(prev.map((m) => [m.id, m]));
        for (const item of incoming) map.set(item.id, item);
        return Array.from(map.values()).sort((a, b) => a.at - b.at);
      });
    }, 4000);
    return () => window.clearInterval(timer);
  }, [open, sessionId, lastAt]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || !sessionId) return;
    setSending(true);
    setInput("");

    const optimistic: KickSupportMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      text,
      at: Date.now(),
      status: "sending",
    };
    setMessages((prev) => [...prev, optimistic]);

    const result = await sendKickSupportMessage({
      sessionId,
      message: text,
      pageUrl: typeof window !== "undefined" ? window.location.href : "https://kick.imba.bet/",
    });

    setSending(false);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === optimistic.id
          ? { ...m, status: result.ok ? "sent" : "failed", at: Date.now() }
          : m,
      ),
    );

    if (!result.ok && result.telegramUrl) {
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          role: "system",
          text: "Оператор offline — напишите в Telegram:",
          at: Date.now(),
        },
      ]);
    }
  }, [input, sending, sessionId]);

  return (
    <div className={styles.root}>
      {open ? (
        <div className={styles.panel} role="dialog" aria-label="Поддержка">
          <header className={styles.panelHead}>
            <div>
              <p className={styles.panelTitle}>Поддержка imba.bet</p>
              <p className={styles.panelSub}>Kick-партнёрам · ответ ~3 мин</p>
            </div>
            <button
              type="button"
              className={styles.closeBtn}
              aria-label="Закрыть"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </header>

          <div className={styles.tabs}>
            <button
              type="button"
              className={`${styles.tab} ${tab === "chat" ? styles.tabActive : ""}`}
              onClick={() => setTab("chat")}
            >
              Чат
            </button>
            <button
              type="button"
              className={`${styles.tab} ${tab === "manager" ? styles.tabActive : ""}`}
              onClick={() => setTab("manager")}
            >
              Менеджер
            </button>
          </div>

          {tab === "chat" ? (
            <>
              <div className={styles.messages} ref={listRef}>
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`${styles.bubbleRow} ${
                      msg.role === "user" ? styles.bubbleRowUser : styles.bubbleRowAgent
                    }`}
                  >
                    {msg.role !== "user" ? (
                      <Image
                        alt=""
                        className={styles.avatar}
                        height={28}
                        src={SupportAvatar}
                        width={28}
                      />
                    ) : null}
                    <div
                      className={`${styles.bubble} ${
                        msg.role === "user"
                          ? styles.bubbleUser
                          : msg.role === "system"
                            ? styles.bubbleSystem
                            : styles.bubbleAgent
                      }`}
                    >
                      <p>{msg.text}</p>
                      {msg.at ? <span className={styles.time}>{formatTime(msg.at)}</span> : null}
                    </div>
                  </div>
                ))}
              </div>

              <form
                className={styles.compose}
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
              >
                <input
                  className={styles.composeInput}
                  placeholder="Ваш вопрос…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                />
                <button className={styles.composeBtn} disabled={sending} type="submit">
                  →
                </button>
              </form>

              <a
                className={styles.telegramFallback}
                href={config?.telegramUrl || "https://t.me/imbabetchat"}
                rel="noreferrer"
                target="_blank"
              >
                или в Telegram · {config?.supportBotUsername || "Imbabetsupport_bot"}
              </a>
            </>
          ) : (
            <div className={styles.managerPane}>
              <div className={styles.managerCard}>
                <span className={styles.managerBadge}>Личный менеджер</span>
                <h3>Kick & RevShare</h3>
                <p>
                  Помогу с подключением канала, офером, OBS-оверлеем и выплатами.
                  Пишите напрямую — отвечаю быстрее для стримеров.
                </p>
                <a
                  className={styles.managerBtn}
                  href={MANAGER_URL}
                  rel="noreferrer"
                  target="_blank"
                >
                  <TelegramIcon />
                  <span>
                    <strong>{MANAGER_HANDLE}</strong>
                    <small>Telegram · онлайн для партнёров</small>
                  </span>
                </a>
              </div>

              <div className={styles.managerCardMuted}>
                <p>Общая тех-поддержка сайта:</p>
                <a
                  href={config?.telegramUrl || "https://t.me/imbabetchat"}
                  rel="noreferrer"
                  target="_blank"
                >
                  {config?.telegramLabel || "Чат imba.bet"}
                </a>
              </div>
            </div>
          )}
        </div>
      ) : null}

      <button
        type="button"
        className={`${styles.fab} ${open ? styles.fabOpen : ""}`}
        aria-expanded={open}
        aria-label="Открыть поддержку"
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.fabIcon}>{open ? "×" : "💬"}</span>
        <span className={styles.fabLabel}>{open ? "Закрыть" : "Поддержка"}</span>
        {!open ? <span className={styles.fabPulse} aria-hidden /> : null}
      </button>
    </div>
  );
}
