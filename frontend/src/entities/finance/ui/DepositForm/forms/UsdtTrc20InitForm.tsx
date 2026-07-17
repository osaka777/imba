"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useReadLocalStorage } from "usehooks-ts";
import { FiClock } from "react-icons/fi";
import { toast } from "react-toastify";

import { Button, Input } from "~/shared/ui";
import { DialogClose } from "~/shared/ui/Dialog";
import {
  cancelUsdtTrc20Order,
  getUsdtTrc20Config,
  getUsdtTrc20OrderStatus,
  initUsdtTrc20Order,
} from "~/entities/finance/api/deposit";
import { trackDepositOrder, untrackDepositOrder } from "~/shared/lib/appNotifications";
import { useLocale } from "~/shared/model/useLocale";
import styles from "./NirvanaPayForm.module.css";
import usdtStyles from "./UsdtTrc20Form.module.css";
import { DepositFormHeading } from "../DepositFormHeading";

interface FormShape {
  amount: number;
}

const PAYMENT_WINDOW_SEC = 45 * 60;

const IconCopy = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const IconInfo = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

type UsdtTrc20InitFormProps = {
  forceCurrency?: string;
  defaultAmount?: number;
  presetAmounts?: number[];
  embedded?: boolean;
  depositSource?: string;
  onDepositComplete?: () => void;
  onPaymentStepChange?: (active: boolean) => void;
};

export const UsdtTrc20InitForm = ({
  forceCurrency,
  defaultAmount,
  presetAmounts,
  embedded = false,
  depositSource = "deposit-modal",
  onDepositComplete,
  onPaymentStepChange,
}: UsdtTrc20InitFormProps) => {
  const { t } = useLocale();
  const defaultCurrency = useReadLocalStorage<string>("currency") || "USDT";
  const currency = forceCurrency || defaultCurrency;
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [orderId, setOrderId] = useState<number | undefined>();
  const [publicOrderId, setPublicOrderId] = useState<number | undefined>();
  const [payAmount, setPayAmount] = useState<number | undefined>();
  const [walletAddress, setWalletAddress] = useState("");
  const [creditAmount, setCreditAmount] = useState<number | undefined>();
  const [initLoading, setInitLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [minAmount, setMinAmount] = useState(10);
  const [qrImageUrl, setQrImageUrl] = useState<string | undefined>();
  const [secondsLeft, setSecondsLeft] = useState(PAYMENT_WINDOW_SEC);
  const [orderCreatedAt, setOrderCreatedAt] = useState<string | undefined>();

  const quickSetAmounts = useMemo(
    () => (presetAmounts?.length ? presetAmounts : [50, 100, 500]),
    [presetAmounts],
  );

  const closeDepositUi = useCallback(() => {
    if (embedded) {
      onDepositComplete?.();
      return;
    }
    closeRef.current?.click();
  }, [embedded, onDepositComplete]);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormShape>({
    defaultValues: { amount: undefined as unknown as number },
  });

  useEffect(() => {
    getUsdtTrc20Config()
      .then((cfg) => {
        if (cfg?.minAmount) setMinAmount(cfg.minAmount);
        if (cfg?.walletAddress) setWalletAddress(cfg.walletAddress);
        if (cfg?.qrImageUrl) setQrImageUrl(cfg.qrImageUrl);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (defaultAmount && defaultAmount >= minAmount) {
      setValue("amount", defaultAmount);
    }
  }, [defaultAmount, minAmount, setValue]);

  useEffect(() => {
    onPaymentStepChange?.(paymentOpen);
    return () => onPaymentStepChange?.(false);
  }, [onPaymentStepChange, paymentOpen]);

  useEffect(() => {
    if (!paymentOpen || !orderCreatedAt) return;
    const tick = () => {
      const elapsed = Math.floor((Date.now() - new Date(orderCreatedAt).getTime()) / 1000);
      setSecondsLeft(Math.max(0, PAYMENT_WINDOW_SEC - elapsed));
    };
    tick();
    const intervalId = setInterval(tick, 1000);
    return () => clearInterval(intervalId);
  }, [paymentOpen, orderCreatedAt]);

  const pollOrderStatus = useCallback(async () => {
    if (!orderId) return;
    try {
      const data = await getUsdtTrc20OrderStatus(orderId);
      if (data?.status === "approved" || data?.status === "SUCCESS") {
        toast.success(t("deposit.credited", { amount: data.amount }));
        untrackDepositOrder(orderId);
        setPaymentOpen(false);
        closeDepositUi();
      }
    } catch {
      // ignore polling errors
    }
  }, [orderId, closeDepositUi, t]);

  useEffect(() => {
    if (!paymentOpen || !orderId) return;
    const intervalId = setInterval(() => void pollOrderStatus(), 12000);
    return () => clearInterval(intervalId);
  }, [paymentOpen, orderId, pollOrderStatus]);

  const resetPayment = () => {
    setPaymentOpen(false);
    setOrderId(undefined);
    setPublicOrderId(undefined);
    setPayAmount(undefined);
    setCreditAmount(undefined);
    setOrderCreatedAt(undefined);
  };

  const onSubmit = async (data: FormShape) => {
    const amount = Number(data.amount);
    if (!amount || amount < minAmount) {
      toast.warn(t("deposit.minAmountShort", { amount: `${minAmount} USDT` }));
      return;
    }
    setInitLoading(true);
    try {
      const init = await initUsdtTrc20Order(amount, depositSource);
      const order = init?.order;
      setOrderId(order?.id);
      setPublicOrderId(order?.publicOrderId);
      setPayAmount(order?.payAmount);
      setWalletAddress(order?.walletAddress || walletAddress);
      setCreditAmount(order?.amount);
      setOrderCreatedAt(order?.createdAt || new Date().toISOString());
      setPaymentOpen(true);
      if (embedded) onDepositComplete?.();
      if (order?.id) {
        trackDepositOrder({
          id: order.id,
          publicOrderId: order.publicOrderId,
          currency: "USDT",
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("deposit.createFailed");
      toast.error(String(msg));
    } finally {
      setInitLoading(false);
    }
  };

  const copy = async (text: string, label?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(label ? t("deposit.copiedLabel", { label }) : t("deposit.copied"));
    } catch {
      toast.error(t("deposit.copyFailed"));
    }
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

  const qrSrc = useMemo(() => {
    if (!qrImageUrl) return null;
    if (
      qrImageUrl.startsWith("http://") ||
      qrImageUrl.startsWith("https://") ||
      qrImageUrl.startsWith("data:")
    ) {
      return qrImageUrl;
    }
    const base =
      process.env.NEXT_PUBLIC_HOST ||
      (typeof window !== "undefined" ? window.location.origin : "");
    return `${base}${qrImageUrl.startsWith("/") ? qrImageUrl : `/${qrImageUrl}`}`;
  }, [qrImageUrl]);

  const handleCancel = async () => {
    if (!orderId) {
      resetPayment();
      return;
    }
    setCancelling(true);
    try {
      await cancelUsdtTrc20Order(orderId);
      untrackDepositOrder(orderId);
      resetPayment();
    } catch {
      toast.error(t("deposit.cancelFailed"));
    } finally {
      setCancelling(false);
    }
  };

  if (currency !== "USDT") {
    return <div className={styles.formSection_empty}>{t("deposit.usdtOnly")}</div>;
  }

  if (paymentOpen && payAmount && walletAddress) {
    return (
      <div className={usdtStyles.inlinePanel} data-usdt-payment-step="active">
        <button
          type="button"
          className={usdtStyles.backBtn}
          onClick={() => void handleCancel()}
          disabled={cancelling}
        >
          {t("deposit.back")}
        </button>

        <div className={usdtStyles.paymentCard}>
          <section className={usdtStyles.hero}>
            <div className={usdtStyles.heroTop}>
              <div className={usdtStyles.brand}>
                <div className={usdtStyles.usdtLogo} aria-hidden>₮</div>
                <div className={usdtStyles.brandText}>
                  <p className={usdtStyles.brandTitle}>{t("deposit.titleUsdt")}</p>
                  <p className={usdtStyles.brandSub}>{t("deposit.usdtNetwork")}</p>
                </div>
              </div>
              {publicOrderId ? (
                <span className={usdtStyles.orderBadge}>#{publicOrderId}</span>
              ) : null}
            </div>

            <div className={usdtStyles.heroBody}>
              {qrSrc ? (
                <div className={usdtStyles.qrFrame}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="QR USDT TRC-20" className={usdtStyles.qrImg} src={qrSrc} />
                </div>
              ) : null}
              <div className={usdtStyles.amountBlock}>
                <p className={usdtStyles.amountLabel}>
                  {qrSrc ? t("deposit.scanOrTransfer") : t("deposit.transferExact")}
                </p>
                <p className={usdtStyles.payAmount}>
                  {payAmount}
                  <span>USDT</span>
                </p>
                <p className={usdtStyles.creditLine}>
                  {t("deposit.willCredit")} <strong>{creditAmount ?? "—"} USDT</strong>
                </p>
                <span className={usdtStyles.networkTag}>TRC-20 (Tron)</span>
              </div>
            </div>
          </section>

          <div className={usdtStyles.alertStrip}>
            <span className={usdtStyles.alertIcon} aria-hidden><IconInfo /></span>
            <p className={usdtStyles.alertText}>
              {t("deposit.usdtNetworkHint")}
            </p>
          </div>

          <section className={usdtStyles.details}>
            <div>
              <span className={usdtStyles.fieldLabel}>{t("deposit.walletAddress")}</span>
              <div className={usdtStyles.addressField}>
                <span className={usdtStyles.addressValue} title={walletAddress}>
                  {walletAddress}
                </span>
                <button
                  className={usdtStyles.copyBtn}
                  onClick={() => copy(walletAddress, t("deposit.walletAddress"))}
                  type="button"
                >
                  <IconCopy />
                  {t("deposit.copy")}
                </button>
              </div>
            </div>

            <div className={usdtStyles.statsGrid}>
              <div className={usdtStyles.statCard}>
                <span className={usdtStyles.statLabel}>{t("deposit.network")}</span>
                <span className={usdtStyles.statValue}>TRC-20</span>
              </div>
              <div
                className={`${usdtStyles.statCard} ${usdtStyles.statCardClickable}`}
                role="button"
                tabIndex={0}
                onClick={() => copy(String(payAmount), t("deposit.amount"))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    void copy(String(payAmount), t("deposit.amount"));
                  }
                }}
                title={t("deposit.copy")}
              >
                <span className={usdtStyles.statLabel}>{t("deposit.toTransfer")}</span>
                <span className={`${usdtStyles.statValue} ${usdtStyles.statValueMono}`}>
                  {payAmount}
                </span>
              </div>
              <div className={usdtStyles.statCard}>
                <span className={usdtStyles.statLabel}>{t("deposit.toBalance")}</span>
                <span className={`${usdtStyles.statValue} ${usdtStyles.statValueMono}`}>
                  {creditAmount ?? "—"}
                </span>
              </div>
            </div>
          </section>

          <footer className={usdtStyles.footer}>
            <div className={usdtStyles.statusRow}>
              <div className={usdtStyles.statusLeft}>
                <span className={usdtStyles.pulseDot} aria-hidden />
                <h2 className={usdtStyles.statusTitle}>{t("deposit.waitingTransfer")}</h2>
              </div>
              <div className={usdtStyles.timerChip} aria-live="polite">
                <FiClock size={13} aria-hidden />
                <span className={usdtStyles.timerValue}>{formatTimer}</span>
              </div>
            </div>
            <p className={usdtStyles.statusHint}>
              {t("deposit.waitingHint")}
            </p>
            <div className={usdtStyles.timerProgress}>
              <div
                className={usdtStyles.timerProgressFill}
                style={{ width: `${timerProgress}%` }}
              />
            </div>
            <button
              className={usdtStyles.cancelBtn}
              disabled={cancelling}
              onClick={() => void handleCancel()}
              type="button"
            >
              {cancelling ? t("deposit.cancelling") : t("deposit.cancelPayment")}
            </button>
          </footer>
        </div>

        {!embedded ? <DialogClose ref={closeRef} style={{ display: "none" }} /> : null}
      </div>
    );
  }

  return (
    <form className={styles.NirvanaPayForm} onSubmit={handleSubmit(onSubmit)}>
      {!embedded ? <DepositFormHeading subtitle="USDT TRC-20" /> : null}

      <div className={styles.amountField}>
        <Input
          {...register("amount", {
            min: minAmount,
            required: true,
            setValueAs: Number,
            validate: (value) => !!value && value >= minAmount,
          })}
          className={styles.input}
          label={t("deposit.amount")}
          placeholder={t("deposit.amountUsdtPlaceholder")}
          type="number"
        />
      </div>

      <div className={styles.quickSetAmount}>
        {quickSetAmounts.map((amount) => (
          <Button
            key={amount}
            className={styles.quickSetAmountButton}
            onClick={() => setValue("amount", amount)}
            type="button"
          >
            {amount} USDT
          </Button>
        ))}
      </div>

      {errors.amount ? (
        <p className={styles.error}>
          {t("deposit.minAmount", { amount: `${minAmount} USDT` })}
        </p>
      ) : null}

      {!embedded ? <DialogClose ref={closeRef} style={{ display: "none" }} /> : null}

      <Button className={styles.submit} disabled={initLoading} type="submit">
        {initLoading ? t("deposit.creatingRequest") : t("deposit.topUp")}
      </Button>
    </form>
  );
};
