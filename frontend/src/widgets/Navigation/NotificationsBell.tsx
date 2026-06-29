"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { FiBell, FiX } from "react-icons/fi";
import { toast } from "react-toastify";
import {
  getMyKztForeignCardOrder,
  getMyRubForeignCardOrder,
  getUsdtTrc20OrderStatus,
} from "~/entities/finance/api/deposit";
import { slideAPI, Slide } from "~/shared/api/slide";
import {
  addDepositNotification,
  AppNotification,
  deleteAllNotificationsForTab,
  deleteNotification,
  emitDepositResult,
  filterNotificationsByTab,
  getAllAppNotifications,
  getTrackedDepositOrders,
  markAllNotificationsReadForTab,
  markNotificationRead,
  NotificationTab,
  setGeneralNotifications,
  subscribeDepositResults,
  subscribeNotificationsUpdated,
  untrackDepositOrder,
} from "~/shared/lib/appNotifications";
import styles from "./NotificationsBell.module.css";

const formatTime = (ts: number) => {
  const d = new Date(ts);
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
};

const formatDate = (ts: number) => {
  const d = new Date(ts);
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const slidesToGeneralNotifications = (slides: Slide[]): AppNotification[] =>
  slides
    .filter((slide) => slide.isActive)
    .sort((a, b) => a.order - b.order)
    .map((slide) => ({
      id: `slide-${slide.id}`,
      kind: "general" as const,
      title: slide.title?.trim() || "Акция IMBA",
      message: slide.description?.trim() || "Новое объявление на сайте",
      createdAt: new Date(slide.updatedAt || slide.createdAt).getTime(),
      read: false,
      linkUrl: slide.linkUrl,
    }));

export const NotificationsBell = () => {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<NotificationTab>("all");
  const [items, setItems] = useState<AppNotification[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const seenStatusRef = useRef<Record<number, string>>({});

  const refresh = useCallback(() => {
    setItems(getAllAppNotifications());
  }, []);

  const syncGeneralFromSlides = useCallback(async () => {
    try {
      const slides = await slideAPI.getActiveSlides();
      setGeneralNotifications(slidesToGeneralNotifications(slides));
      refresh();
    } catch {
      // ignore
    }
  }, [refresh]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    refresh();
    void syncGeneralFromSlides();
    return subscribeNotificationsUpdated(refresh);
  }, [refresh, syncGeneralFromSlides]);

  useEffect(() => {
    const unsub = subscribeDepositResults((payload) => {
      const displayId = Number(payload.publicOrderId ?? payload.orderId);
      if (payload.status === "approved") {
        addDepositNotification({
          orderId: payload.orderId,
          displayId,
          title: `Заявка #${displayId} одобрена`,
          message: "Средства зачислены на баланс.",
        });
        toast.success(`Заявка #${displayId} одобрена`);
      } else if (payload.status === "rejected") {
        addDepositNotification({
          orderId: payload.orderId,
          displayId,
          title: `Заявка #${displayId} отклонена`,
          message: "Обратитесь в поддержку, если это ошибка.",
        });
        toast.error(`Заявка #${displayId} отклонена`);
      } else if (payload.status === "expired") {
        addDepositNotification({
          orderId: payload.orderId,
          displayId,
          title: `Заявка #${displayId} истекла`,
          message: "Создайте новую заявку на пополнение.",
        });
        toast.info(`Заявка #${displayId} истекла`);
      }
      refresh();
    });
    return unsub;
  }, [refresh]);

  useEffect(() => {
    let active = true;

    const poll = async () => {
      const tracked = getTrackedDepositOrders();
      if (!tracked.length) return;

      for (const order of tracked) {
        try {
          const displayId = Number(order.publicOrderId ?? order.id);

          if (order.currency === "USDT") {
            const current = await getUsdtTrc20OrderStatus(order.id);
            const status = String(current?.status || "pending");
            const prev = seenStatusRef.current[order.id];
            seenStatusRef.current[order.id] = status;

            if (status === "approved" && prev !== "approved") {
              untrackDepositOrder(order.id);
              emitDepositResult({
                orderId: order.id,
                publicOrderId: Number(current.publicOrderId) || order.publicOrderId,
                status: "approved",
                currency: "USDT",
              });
            } else if (
              (status === "rejected" || status === "cancelled") &&
              prev !== status
            ) {
              untrackDepositOrder(order.id);
              emitDepositResult({
                orderId: order.id,
                publicOrderId: Number(current.publicOrderId) || order.publicOrderId,
                status: "rejected",
              });
            } else if (status === "expired" && prev !== "expired") {
              untrackDepositOrder(order.id);
              emitDepositResult({
                orderId: order.id,
                publicOrderId: Number(current.publicOrderId) || order.publicOrderId,
                status: "expired",
              });
            }
            continue;
          }

          const fetcher =
            order.currency === "RUB"
              ? getMyRubForeignCardOrder
              : getMyKztForeignCardOrder;
          const { data } = await fetcher();
          const current = data as Record<string, unknown> | null | undefined;
          const resolvedDisplayId = Number(
            order.publicOrderId ?? current?.publicOrderId ?? order.id,
          );

          if (!current || !("id" in current)) {
            continue;
          }

          const status = String(current.status || "pending");
          const prev = seenStatusRef.current[order.id];

          if (
            (status === "processing" || status === "pending") &&
            prev !== "processing" &&
            prev !== "pending"
          ) {
            seenStatusRef.current[order.id] = status;
            addDepositNotification({
              orderId: order.id,
              displayId: resolvedDisplayId,
              title: `Заявка #${resolvedDisplayId} отправлена`,
              message: "Платеж принят на проверку.",
            });
            if (active) refresh();
            continue;
          }

          seenStatusRef.current[order.id] = status;

          if (status === "approved") {
            untrackDepositOrder(order.id);
            emitDepositResult({
              orderId: order.id,
              publicOrderId: Number(current.publicOrderId) || order.publicOrderId,
              status: "approved",
              currency: order.currency,
            });
          } else if (status === "rejected") {
            untrackDepositOrder(order.id);
            emitDepositResult({
              orderId: order.id,
              publicOrderId: Number(current.publicOrderId) || order.publicOrderId,
              status: "rejected",
            });
          } else if (status === "expired") {
            untrackDepositOrder(order.id);
            emitDepositResult({
              orderId: order.id,
              publicOrderId: Number(current.publicOrderId) || order.publicOrderId,
              status: "expired",
            });
          }
        } catch {
          // ignore transient errors
        }
      }
    };

    const id = setInterval(() => {
      if (active) void poll();
    }, 15000);
    void poll();

    return () => {
      active = false;
      clearInterval(id);
    };
  }, [refresh]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.body.style.overflow = "hidden";
    document.body.dataset.notificationsOpen = "true";
    document.addEventListener("keydown", onKeyDown);
    void syncGeneralFromSlides();

    return () => {
      document.body.style.overflow = "";
      delete document.body.dataset.notificationsOpen;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, syncGeneralFromSlides]);

  const filteredItems = filterNotificationsByTab(items, tab);
  const unreadCount = items.filter((n) => !n.read).length;

  const tabs: { id: NotificationTab; label: string }[] = [
    { id: "all", label: "Все" },
    { id: "personal", label: "Личные" },
    { id: "general", label: "Общие" },
  ];

  const handleItemClick = (item: AppNotification) => {
    markNotificationRead(item.id, item.kind);
    refresh();
    if (item.linkUrl) {
      window.open(item.linkUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleDeleteItem = (e: MouseEvent<HTMLButtonElement>, item: AppNotification) => {
    e.stopPropagation();
    e.preventDefault();
    deleteNotification(item.id, item.kind);
    refresh();
  };

  const modal = open ? (
    <div
      className={styles.overlay}
      onClick={() => setOpen(false)}
      role="presentation"
    >
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="notifications-title"
        aria-modal="true"
      >
        <div className={styles.modalHeader}>
          <div className={styles.modalHeaderRow}>
            <h3 className={styles.title} id="notifications-title">
              Уведомления
            </h3>
            <button
              aria-label="Закрыть"
              className={styles.closeBtn}
              onClick={() => setOpen(false)}
              type="button"
            >
              <FiX size={22} />
            </button>
          </div>
        </div>

        <div className={styles.tabs}>
          {tabs.map((item) => (
            <button
              key={item.id}
              className={`${styles.tab} ${tab === item.id ? styles.tabActive : ""}`}
              onClick={() => setTab(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className={styles.list}>
          {filteredItems.length === 0 ? (
            <div className={styles.empty}>
              <FiBell aria-hidden className={styles.emptyIcon} size={36} />
              <p className={styles.emptyTitle}>Ничего нет</p>
              <p className={styles.emptyText}>
                Когда придет уведомление, оно отобразится в этом разделе
              </p>
            </div>
          ) : (
            filteredItems.map((item) => (
              <div
                key={item.id}
                className={`${styles.item} ${item.read ? "" : styles.itemUnread}`}
                onClick={() => handleItemClick(item)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleItemClick(item);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <button
                  aria-label="Удалить уведомление"
                  className={styles.deleteBtn}
                  onClick={(e) => handleDeleteItem(e, item)}
                  type="button"
                >
                  <FiX size={16} />
                </button>
                <div className={styles.itemTop}>
                  <span className={styles.itemKind}>
                    {item.kind === "personal" ? "Личное" : "Общее"}
                  </span>
                  <span className={styles.itemTime}>
                    {item.kind === "personal"
                      ? formatTime(item.createdAt)
                      : formatDate(item.createdAt)}
                  </span>
                </div>
                <div className={styles.itemTitle}>
                  {item.title || "Уведомление"}
                </div>
                <div className={styles.itemMessage}>
                  {item.message || "Подробности в личном кабинете"}
                </div>
              </div>
            ))
          )}
        </div>

        {filteredItems.length > 0 ? (
          <div className={styles.footer}>
            {filteredItems.some((n) => !n.read) ? (
              <button
                className={styles.readAll}
                onClick={() => {
                  markAllNotificationsReadForTab(tab);
                  refresh();
                }}
                type="button"
              >
                Прочитать все
              </button>
            ) : null}
            <button
              className={styles.deleteAll}
              onClick={() => {
                deleteAllNotificationsForTab(tab);
                refresh();
              }}
              type="button"
            >
              Удалить все
            </button>
          </div>
        ) : null}
      </div>
    </div>
  ) : null;

  return (
    <div className={styles.bellWrap} ref={wrapRef}>
      <button
        aria-label="Уведомления"
        className={styles.bellBtn}
        onClick={() => setOpen(true)}
        type="button"
      >
        <span className={styles.bellIconWrap}>
          <FiBell size={18} className={styles.bellIcon} />
          {unreadCount > 0 ? (
            <span className={styles.badge}>{unreadCount > 9 ? "9+" : unreadCount}</span>
          ) : null}
        </span>
      </button>

      {mounted && modal ? createPortal(modal, document.body) : null}
    </div>
  );
};
