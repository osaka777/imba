"use client";

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import getSymbolFromCurrency from "currency-symbol-map";
import { toast } from "react-toastify";
import { getSessionClient } from "~/entities/user/lib";
import {
  ManualDepositConfigItem,
  cancelManualForeignCardOrder,
  getManualDepositConfig,
  initManualForeignCardOrder,
  MyKztForeignCardOrder,
  type ManualForeignCardMethod,
} from "~/entities/finance/api/deposit";
import { untrackDepositOrder } from "~/shared/lib/appNotifications";
import {
  calculateBrlFromRub,
  formatBrlAmount,
} from "~/entities/finance/lib/rubBrlConversion";
import { ManualForeignCardReceiptUpload } from "~/entities/finance/ui/ManualForeignCardPage/ManualForeignCardReceiptUpload";
import { useLocale } from "~/shared/model/useLocale";
import styles from "./ManualForeignCardPage.module.css";

const PAYMENT_WINDOW_SEC = 15 * 60;

type GetMyOrderFn = () => Promise<{ data?: MyKztForeignCardOrder | Record<string, never> }>;
type UploadReceiptFn = (form: FormData) => Promise<{
  ok?: boolean;
  order?: MyKztForeignCardOrder & { publicOrderId?: number };
}>;

export type ManualForeignCardPageProps = {
  currency: "KZT" | "RUB";
  method: ManualForeignCardMethod;
  fallbackMinAmount: number;
  title: string;
  getMyOrder: GetMyOrderFn;
  uploadReceipt: UploadReceiptFn;
  asModal?: boolean;
  initialAmount?: string;
  initialOrderId?: number;
  initialPublicOrderId?: number;
  /** @deprecated No longer closes the dialog — kept for call-site compatibility. */
  closeAfterConfirm?: boolean;
  onPaymentConfirmed?: (orderId?: number, publicOrderId?: number) => void;
  onPaymentCancelled?: () => void;
};

const IconCard = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <line x1="2" y1="10" x2="22" y2="10" />
  </svg>
);

const IconBank = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="#1e40af"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M3 21h18" stroke="#1e40af" />
    <path d="M5 21V7l7-4 7 4v14" stroke="#1e40af" />
    <path d="M9 21v-4h6v4" stroke="#1e40af" />
  </svg>
);

const IconAmount = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <line x1="12" y1="8" x2="12" y2="16" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);

const IconPerson = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c1.5-4 6-4 8-4s6.5 0 8 4" />
  </svg>
);

const IconCopy = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const IconAlert = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#dc2626"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const TransferCommentWarning = () => {
  const { t } = useLocale();
  return (
  <div className={styles.warningBox} role="alert">
    <span className={styles.warningIcon}><IconAlert /></span>
    <div className={styles.warningCopy}>
      <p className={styles.warningTitle}>{t("deposit.noCommentTitle")}</p>
      <p className={styles.warningText}>
        {t("deposit.noCommentBody")}
      </p>
    </div>
  </div>
  );
};

const IconClock = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export const ManualForeignCardPage = (props: ManualForeignCardPageProps) => {
  // Modal deposit must not call useSearchParams — it can crash the root
  // layout when the dialog tree updates after receipt upload.
  if (props.asModal) {
    return <ManualForeignCardPageInner {...props} amountFromQuery={undefined} />;
  }
  return (
    <Suspense fallback={<div className={styles.loadingWrap}>…</div>}>
      <ManualForeignCardPageWithQuery {...props} />
    </Suspense>
  );
};

function ManualForeignCardPageWithQuery(props: ManualForeignCardPageProps) {
  const searchParams = useSearchParams();
  const amountFromQuery = searchParams?.get("amount") ?? undefined;
  return <ManualForeignCardPageInner {...props} amountFromQuery={amountFromQuery} />;
}

const ManualForeignCardPageInner = ({
  currency,
  method,
  fallbackMinAmount,
  title,
  getMyOrder,
  uploadReceipt,
  asModal = false,
  initialAmount,
  initialOrderId,
  initialPublicOrderId,
  onPaymentConfirmed,
  onPaymentCancelled,
  amountFromQuery,
}: ManualForeignCardPageProps & { amountFromQuery?: string }) => {
  const { t } = useLocale();
  const [config, setConfig] = useState<ManualDepositConfigItem | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [amount, setAmount] = useState<string>(initialAmount ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [order, setOrder] = useState<MyKztForeignCardOrder | null>(null);
  const [orderId, setOrderId] = useState<number | undefined>(initialOrderId);
  const [publicOrderId, setPublicOrderId] = useState<number | undefined>(initialPublicOrderId);
  const [secondsLeft, setSecondsLeft] = useState(PAYMENT_WINDOW_SEC);
  const [serverError, setServerError] = useState("");
  const [initLoading, setInitLoading] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const loadedRef = useRef(false);

  const minAmount = config?.minAmount ?? fallbackMinAmount;
  const currencySymbol = getSymbolFromCurrency(currency) || currency;
  const isRubRfTransfer = method === "RUB_SBERBANK";
  const isYandexBank = method === "RUB_YANDEX_BANK";
  const isVtbBank = method === "RUB_VTB_BANK";
  const appName = isYandexBank
    ? t("deposit.yandexBank")
    : isVtbBank
      ? t("deposit.vtbBank")
      : isRubRfTransfer
        ? t("deposit.bankAppGeneric")
        : currency === "KZT"
          ? "Kaspi Bank"
          : t("deposit.bankAppYours");
  const displayPublicId = publicOrderId ?? order?.publicOrderId;
  const rubPerBrl = order?.rubPerBrl ?? config?.rubPerBrl ?? 0;
  const rubAmountNum = amount ? Number(amount) : 0;
  const brlAmount = useMemo(() => {
    if (order?.brlAmount && order.brlAmount > 0) return order.brlAmount;
    if (isRubRfTransfer && rubPerBrl > 0 && rubAmountNum > 0) {
      return calculateBrlFromRub(rubAmountNum, rubPerBrl);
    }
    return 0;
  }, [isRubRfTransfer, order?.brlAmount, rubAmountNum, rubPerBrl]);

  const makeAbsolute = useCallback((u?: string | null) => {
    if (!u) return null;
    if (u.startsWith("http://") || u.startsWith("https://") || u.startsWith("blob:") || u.startsWith("data:")) {
      return u;
    }
    const base =
      process.env.NEXT_PUBLIC_HOST ||
      (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
    return `${base}${u.startsWith("/") ? u : `/${u}`}`;
  }, []);

  const qrSrc = useMemo(() => makeAbsolute(config?.qrImageUrl), [config?.qrImageUrl, makeAbsolute]);

  useEffect(() => {
    if (!receiptFile) {
      setReceiptPreview(null);
      return;
    }
    const url = URL.createObjectURL(receiptFile);
    setReceiptPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [receiptFile]);

  const handleReceiptChange = (file: File | null) => {
    if (!file) {
      setReceiptFile(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.warn(t("deposit.imageOnlyWarn"));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.warn(t("deposit.fileTooBigWarn"));
      return;
    }
    setReceiptFile(file);
  };

  const formatTimer = useMemo(() => {
    const mm = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
    const ss = (secondsLeft % 60).toString().padStart(2, "0");
    return `${mm}:${ss}`;
  }, [secondsLeft]);

  const timerProgress = useMemo(
    () => Math.max(0, Math.min(100, (secondsLeft / PAYMENT_WINDOW_SEC) * 100)),
    [secondsLeft],
  );

  const copy = async (text: string, label?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(label ? t("deposit.copiedLabel", { label }) : t("deposit.copied"));
    } catch {
      toast.error(t("deposit.copyFailed"));
    }
  };

  const computeSecondsLeft = (createdAt?: string) => {
    if (!createdAt) return PAYMENT_WINDOW_SEC;
    const elapsed = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
    return Math.max(0, PAYMENT_WINDOW_SEC - elapsed);
  };

  useEffect(() => {
    setOrderId(initialOrderId);
  }, [initialOrderId]);

  useEffect(() => {
    if (initialPublicOrderId) setPublicOrderId(initialPublicOrderId);
  }, [initialPublicOrderId]);

  useEffect(() => {
    const a = amountFromQuery;
    if (a && !Number.isNaN(Number(a)) && !initialAmount) setAmount(a);
  }, [amountFromQuery, initialAmount]);

  useEffect(() => {
    if (!getSessionClient() && typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const configKey =
      method === "KZT_KASPI"
        ? "KZT_KASPI"
        : method === "RUB_SBERBANK"
          ? "RUB_SBERBANK"
          : method === "RUB_YANDEX_BANK"
            ? "RUB_YANDEX_BANK"
            : method === "RUB_VTB_BANK"
              ? "RUB_VTB_BANK"
              : currency;
    (async () => {
      setConfigLoading(true);
      try {
        const { data } = await getManualDepositConfig(configKey);
        if (!cancelled && data) setConfig(data as ManualDepositConfigItem);
      } catch {
        if (!cancelled) {
          setConfig({
            cardNumber: "5351 7737 9598 4711",
            holderName: "Ali Kaliyev",
            bankName:
              method === "KZT_KASPI" || currency === "KZT"
                ? "Kaspi Bank"
                : method === "RUB_SBERBANK"
                  ? t("deposit.sberbank")
                  : method === "RUB_YANDEX_BANK"
                    ? t("deposit.yandexBank")
                    : method === "RUB_VTB_BANK"
                      ? t("deposit.vtbBank")
                      : "Kaspi",
            minAmount: fallbackMinAmount,
            ...(method === "RUB_SBERBANK" ? { rubPerBrl: 183 } : {}),
          });
        }
      } finally {
        if (!cancelled) setConfigLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currency, fallbackMinAmount, method]);

  useEffect(() => {
    if (loadedRef.current && (initialOrderId || asModal)) return;
    if (initialOrderId) {
      setSubmitted(true);
      loadedRef.current = true;
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await getMyOrder();
        const raw = data as MyKztForeignCardOrder | Record<string, never>;
        const existing =
          raw && typeof raw === "object" && "id" in raw ? (raw as MyKztForeignCardOrder) : null;
        if (cancelled) return;
        if (existing) {
          setOrder(existing);
          setSubmitted(true);
          if (existing.id) setOrderId(existing.id);
          if (existing.publicOrderId) setPublicOrderId(existing.publicOrderId);
          if (existing.amount) setAmount(String(existing.amount));
          if (existing.brlAmount) setOrder(existing);
          setSecondsLeft(computeSecondsLeft(existing.createdAt));
        }
        loadedRef.current = true;
      } catch {
        loadedRef.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getMyOrder, initialOrderId, asModal]);

  useEffect(() => {
    if (!submitted || secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [submitted, secondsLeft]);

  useEffect(() => {
    if (!submitted) return;
    let stopped = false;
    const poll = async () => {
      try {
        const { data } = await getMyOrder();
        const raw = data as MyKztForeignCardOrder | Record<string, never>;
        const next =
          raw && typeof raw === "object" && "id" in raw ? (raw as MyKztForeignCardOrder) : null;
        if (!next) {
          if (order?.status === "processing" || order?.status === "pending") {
            setSubmitted(false);
            setOrder(null);
            setOrderId(undefined);
            setPublicOrderId(undefined);
            toast.info(t("deposit.orderProcessed"));
          }
          stopped = true;
          return;
        }
        setSecondsLeft(computeSecondsLeft(next.createdAt));
        setOrder(next);
        if (next.publicOrderId) setPublicOrderId(next.publicOrderId);
        const orderLabel = String(next.publicOrderId ?? displayPublicId ?? next.id);
        if (next.status === "expired") {
          setSubmitted(false);
          toast.warn(t("deposit.orderExpiredToast", { id: orderLabel }));
          stopped = true;
        } else if (next.status === "approved") {
          setSubmitted(false);
          toast.success(t("deposit.orderApprovedToast"));
          stopped = true;
        } else if (next.status === "rejected") {
          setSubmitted(false);
          toast.error(t("deposit.orderRejectedToast"));
          stopped = true;
        }
      } catch {
        // ignore
      }
    };
    poll();
    const id = setInterval(() => {
      if (!stopped) poll();
    }, 5000);
    return () => clearInterval(id);
  }, [submitted, getMyOrder, order?.status, displayPublicId, t]);

  const resetLocalPaymentState = () => {
    setSubmitted(false);
    setOrder(null);
    setOrderId(undefined);
    setPublicOrderId(undefined);
    setSecondsLeft(PAYMENT_WINDOW_SEC);
    setReceiptFile(null);
  };

  const cancelPayment = async () => {
    if (submitting || cancelling) return;
    const activeOrderId = orderId ?? initialOrderId;
    setCancelling(true);
    try {
      if (activeOrderId) {
        await cancelManualForeignCardOrder({ orderId: activeOrderId, method });
        untrackDepositOrder(activeOrderId);
      }
      resetLocalPaymentState();
      toast.info(t("deposit.paymentCancelled"));
      onPaymentCancelled?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("deposit.cancelPaymentFail"));
    } finally {
      setCancelling(false);
    }
  };

  const confirmPayment = async () => {
    if (submitting) return;
    setServerError("");
    if (!receiptFile) {
      toast.warn(t("deposit.attachReceiptWarn"));
      return;
    }
    const amountNum = parseFloat(String(amount).replace(",", "."));
    if (!amountNum || Number.isNaN(amountNum) || amountNum < minAmount) {
      toast.warn(t("deposit.minAmountShort", { amount: `${minAmount.toLocaleString()} ${currency}` }));
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("amount", String(amountNum));
      form.append("currency", currency);
      form.append("method", method);
      if (config?.cardNumber) form.append("cardNumber", config.cardNumber);
      if (config?.holderName) form.append("holderName", config.holderName);
      form.append("receipt", receiptFile);
      const activeOrderId = orderId ?? initialOrderId;
      if (activeOrderId) form.append("orderId", String(activeOrderId));

      const res = await uploadReceipt(form);
      if (res?.ok !== false) {
        const confirmedOrderId =
          Number(res?.order?.id || orderId || initialOrderId || 0) || undefined;
        const confirmedPublicId =
          Number(res?.order?.publicOrderId ?? publicOrderId ?? 0) || undefined;
        toast.success(t("deposit.requestSentReview"));
        setSubmitted(true);
        if (confirmedOrderId) setOrderId(confirmedOrderId);
        if (confirmedPublicId) setPublicOrderId(confirmedPublicId);
        if (res?.order) {
          setOrder({
            ...(res.order as MyKztForeignCardOrder),
            status: (res.order as MyKztForeignCardOrder).status || "processing",
          });
        } else {
          setOrder((prev) =>
            prev
              ? { ...prev, status: "processing" }
              : ({
                  id: confirmedOrderId || 0,
                  amount: amountNum,
                  currency,
                  method,
                  status: "processing",
                  createdAt: new Date().toISOString(),
                  publicOrderId: confirmedPublicId,
                } as MyKztForeignCardOrder),
          );
        }
        try {
          onPaymentConfirmed?.(confirmedOrderId, confirmedPublicId);
        } catch (callbackErr) {
          console.error("[deposit] onPaymentConfirmed failed", callbackErr);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("deposit.sendError");
      setServerError(String(msg));
      toast.error(String(msg));
    } finally {
      setSubmitting(false);
      try {
        const { data } = await getMyOrder();
        const raw = data as MyKztForeignCardOrder | Record<string, never>;
        const latest =
          raw && typeof raw === "object" && "id" in raw ? (raw as MyKztForeignCardOrder) : null;
        if (latest) {
          setOrder(latest);
          setSubmitted(true);
          if (latest.amount) setAmount(String(latest.amount));
          if (latest.publicOrderId) setPublicOrderId(latest.publicOrderId);
          setSecondsLeft(computeSecondsLeft(latest.createdAt));
        }
      } catch {
        // ignore
      }
    }
  };

  const displayAmount = amount
    ? `${Number(amount).toLocaleString()} ${currencySymbol}`
    : "—";
  const cardNumberDisplay = (config?.cardNumber || "—").replace(/\s+/g, " ").trim();
  const showPaymentView = submitted || !!initialOrderId;

  const conversionBlock = isRubRfTransfer && brlAmount > 0 ? (
    <div className={styles.conversionBox}>
      <div className={styles.conversionRow}>
        <span className={styles.conversionLabel}>{t("deposit.toBalance")}</span>
        <span className={styles.conversionValue}>{displayAmount}</span>
      </div>
      <div className={`${styles.conversionRow} ${styles.conversionRowHighlight}`}>
        <span className={styles.conversionLabel}>{t("deposit.sendExactLabel")}</span>
        <span className={styles.conversionValueBrl}>{formatBrlAmount(brlAmount)}</span>
        <button
          className={styles.copyIconBtn}
          onClick={() => copy(String(brlAmount), t("deposit.copyBrlAmount"))}
          type="button"
          aria-label={t("deposit.copyBrlAria")}
        >
          <IconCopy />
        </button>
      </div>
      {rubPerBrl > 0 ? (
        <p className={styles.conversionHint}>
          {t("deposit.rateTimer", { rate: rubPerBrl.toLocaleString(), timer: formatTimer })}
        </p>
      ) : null}
      <p className={styles.conversionWarn}>
        {t("deposit.brlExactHint")}
      </p>
    </div>
  ) : null;

  const paymentContent = configLoading ? (
    <div className={styles.loadingWrap}>{t("deposit.loading")}</div>
  ) : showPaymentView ? (
    <>
      {qrSrc ? (
        <div className={styles.qrSection}>
          <div className={styles.qrLeft}>
            <div className={styles.bankLogo} aria-hidden>
              {isYandexBank ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" className={styles.bankLogoImg} src="/yandex-bank.png" />
              ) : isVtbBank ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" className={styles.bankLogoImg} src="/vtb-bank.png" />
              ) : isRubRfTransfer ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" className={styles.bankLogoImg} src="/sberbank.png" />
              ) : (
                <IconBank size={20} />
              )}
            </div>
            <p className={styles.qrDesc}>
              {isRubRfTransfer ? (
                <>
                  {t("deposit.scanQrBrl", {
                    amount: brlAmount > 0 ? formatBrlAmount(brlAmount) : t("deposit.statedAmount"),
                  })}
                </>
              ) : (
                <>
                  {t("deposit.scanQrBank", { app: appName })}
                </>
              )}
            </p>
            {displayPublicId ? (
              <p className={styles.orderIdHint}>{t("deposit.orderIdHint", { id: displayPublicId })}</p>
            ) : null}
          </div>
          <img alt={`QR ${currency}`} className={styles.qrImg} src={qrSrc} />
        </div>
      ) : isRubRfTransfer ? (
        <div className={styles.errorBox} role="alert">
          {t("deposit.qrNotConfigured")}
        </div>
      ) : null}

      {conversionBlock}

      {!isRubRfTransfer ? (
      <div className={styles.bottomRow}>
        <div className={styles.requisitesBox}>
          <p className={styles.requisitesTitle}>
            {qrSrc ? t("deposit.orTransferRequisites") : t("deposit.transferRequisites")}
          </p>
          {!qrSrc && displayPublicId ? (
            <p className={styles.orderIdHint}>{t("deposit.orderIdHint", { id: displayPublicId })}</p>
          ) : null}

          <div className={styles.reqRow}>
            <span className={styles.reqIcon}><IconCard /></span>
            <div className={styles.reqBody}>
              <span className={styles.reqLabel}>{t("deposit.cardNumberLabel")}</span>
              <span className={styles.reqValue}>{cardNumberDisplay}</span>
            </div>
            <button
              className={styles.copyIconBtn}
              onClick={() => copy(cardNumberDisplay, t("deposit.copyCardNumber"))}
              type="button"
              aria-label={t("deposit.copyCardAria")}
            >
              <IconCopy />
            </button>
          </div>

          <div className={styles.reqRow}>
            <span className={styles.reqIcon}><IconBank /></span>
            <div className={styles.reqBody}>
              <span className={styles.reqLabel}>{t("deposit.bankRecipient")}</span>
              <span className={styles.reqValue}>{config?.bankName || "—"}</span>
            </div>
            <button
              className={styles.copyIconBtn}
              onClick={() => copy(config?.bankName || "", t("deposit.copyBank"))}
              type="button"
              aria-label={t("deposit.copyBankAria")}
            >
              <IconCopy />
            </button>
          </div>

          <div className={styles.reqRow}>
            <span className={styles.reqIcon}><IconAmount /></span>
            <div className={styles.reqBody}>
              <span className={styles.reqLabel}>{t("deposit.transferAmount")}</span>
              <span className={styles.reqValue}>{displayAmount}</span>
            </div>
            <button
              className={styles.copyIconBtn}
              onClick={() => copy(String(amount), t("deposit.copyAmount"))}
              type="button"
              aria-label={t("deposit.copyAmountAria")}
            >
              <IconCopy />
            </button>
          </div>

          <div className={styles.reqRow}>
            <span className={styles.reqIcon}><IconPerson /></span>
            <div className={styles.reqBody}>
              <span className={styles.reqLabel}>{t("deposit.recipientLabel")}</span>
              <span className={styles.reqValue}>{config?.holderName || "—"}</span>
            </div>
            <button
              className={styles.copyIconBtn}
              onClick={() => copy(config?.holderName || "", t("deposit.copyRecipient"))}
              type="button"
              aria-label={t("deposit.copyRecipientAria")}
            >
              <IconCopy />
            </button>
          </div>
        </div>

        <TransferCommentWarning />
      </div>
      ) : (
        <TransferCommentWarning />
      )}

      {order?.status === "processing" ? (
        <section className={styles.statusBox}>
          <h2 className={styles.statusTitle}>{t("deposit.checkingPaymentTitle")}</h2>
          <p className={styles.statusText}>
            {t("deposit.checkingPaymentBody")}
          </p>
        </section>
      ) : (
        <>
          <ManualForeignCardReceiptUpload
            disabled={submitting || cancelling || secondsLeft <= 0}
            file={receiptFile}
            onChange={handleReceiptChange}
            previewUrl={receiptPreview}
          />

          <div className={styles.actions}>
            <button
              className={styles.paidBtn}
              disabled={submitting || cancelling || secondsLeft <= 0 || !receiptFile}
              onClick={confirmPayment}
              type="button"
            >
              {submitting ? t("deposit.sending") : t("deposit.submitReview")}
            </button>
            <button
              className={styles.cancelBtn}
              disabled={submitting || cancelling}
              onClick={cancelPayment}
              type="button"
            >
              {cancelling ? t("deposit.cancelling") : t("deposit.cancelPayment")}
            </button>
            <div className={styles.timerWrap} aria-live="polite">
              <div className={styles.timerBadge}>
                <span className={styles.timerIcon} aria-hidden>
                  <IconClock />
                </span>
                <span className={styles.timerLabel}>{t("deposit.timeLeft")}</span>
                <span className={styles.timerValue}>{formatTimer}</span>
              </div>
              <div className={styles.timerProgress}>
                <div
                  className={styles.timerProgressFill}
                  style={{ width: `${timerProgress}%` }}
                />
              </div>
            </div>
          </div>

          {serverError ? (
            <div className={styles.errorBox} role="alert">
              {serverError}
            </div>
          ) : null}
        </>
      )}
    </>
  ) : (
    <form
      className={styles.form}
      onSubmit={async (e) => {
        e.preventDefault();
        const amountNum = parseFloat(String(amount).replace(",", "."));
        if (!amountNum || amountNum < minAmount) {
          toast.warn(t("deposit.minAmountShort", { amount: `${minAmount.toLocaleString()} ${currency}` }));
          return;
        }
        setInitLoading(true);
        setServerError("");
        try {
          const init = await initManualForeignCardOrder({
            amount: amountNum,
            currency,
            method,
            source: asModal ? "manual-modal" : "deposit-page",
          });
          setOrderId(init?.order?.id);
          if (init?.order?.publicOrderId) setPublicOrderId(init.order.publicOrderId);
          setSubmitted(true);
          setSecondsLeft(PAYMENT_WINDOW_SEC);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : t("deposit.createFailed");
          setServerError(String(msg));
          toast.error(String(msg));
        } finally {
          setInitLoading(false);
        }
      }}
    >
      <label className={styles.label}>
        {t("deposit.amountMinInline", { amount: `${minAmount.toLocaleString()} ${currency}` })}
        <input
          className={styles.input}
          min={minAmount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={t("deposit.amountPlaceholderShort")}
          required
          type="number"
          value={amount}
        />
      </label>
      <div className={styles.quickRow}>
        {(isRubRfTransfer ? [1000, 2000, 5000] : [minAmount, minAmount * 2, minAmount * 3]).map((v) => (
          <button
            key={v}
            className={styles.pill}
            onClick={() => setAmount(String(v))}
            type="button"
          >
            {v.toLocaleString()} {currency}
          </button>
        ))}
      </div>
      {serverError ? <div className={styles.errorBox}>{serverError}</div> : null}
      <button className={styles.submitBtn} disabled={initLoading} type="submit">
        {initLoading ? t("deposit.creatingRequest") : t("deposit.continueToPay")}
      </button>
    </form>
  );

  const inner = (
    <div className={asModal ? `${styles.card} ${styles.cardModal}` : styles.card}>
      {!asModal ? (
        <>
          <h1 style={{ margin: "0 0 4px", fontSize: 22 }}>{title}</h1>
          <p style={{ margin: 0, color: "#8e98bc", fontSize: 14 }}>{t("deposit.currencyLabel", { currency })}</p>
        </>
      ) : null}
      {paymentContent}
    </div>
  );

  if (asModal) return inner;
  return <main className={styles.pageWrap}>{inner}</main>;
};
