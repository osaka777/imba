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
  embedded?: boolean;
  depositSource?: string;
  onDepositComplete?: () => void;
  onPaymentStepChange?: (active: boolean) => void;
};

export const UsdtTrc20InitForm = ({
  forceCurrency,
  embedded = false,
  depositSource = "deposit-modal",
  onDepositComplete,
  onPaymentStepChange,
}: UsdtTrc20InitFormProps) => {
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

  const quickSetAmounts = useMemo(() => [50, 100, 500], []);

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
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [paymentOpen, orderCreatedAt]);

  const pollOrderStatus = useCallback(async () => {
    if (!orderId) return;
    try {
      const data = await getUsdtTrc20OrderStatus(orderId);
      if (data?.status === "approved" || data?.status === "SUCCESS") {
        toast.success(`Зачислено ${data.amount} USDT`);
        untrackDepositOrder(orderId);
        setPaymentOpen(false);
        onDepositComplete?.();
        closeRef.current?.click();
      }
    } catch {
      // ignore polling errors
    }
  }, [orderId, onDepositComplete]);

  useEffect(() => {
    if (!paymentOpen || !orderId) return;
    const t = setInterval(() => void pollOrderStatus(), 12000);
    return () => clearInterval(t);
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
      toast.warn(`Минимальная сумма — ${minAmount} USDT`);
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
      const msg = err instanceof Error ? err.message : "Не удалось создать заявку";
      toast.error(String(msg));
    } finally {
      setInitLoading(false);
    }
  };

  const copy = async (text: string, label?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label ? `${label} ` : ""}Скопировано`);
    } catch {
      toast.error("Не удалось скопировать");
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
      toast.error("Не удалось отменить заявку");
    } finally {
      setCancelling(false);
    }
  };

  if (currency !== "USDT") {
    return <div className={styles.formSection_empty}>Метод доступен только для USDT</div>;
  }

  if (paymentOpen && payAmount && walletAddress) {
    const payAmountLabel = `${payAmount} USDT`;

    return (
      <div className={usdtStyles.inlinePanel} data-usdt-payment-step="active">
        <button
          type="button"
          className={usdtStyles.backBtn}
          onClick={() => void handleCancel()}
          disabled={cancelling}
        >
          ← Назад
        </button>

        <div className={usdtStyles.paymentCard}>
          <section className={usdtStyles.hero}>
            <div className={usdtStyles.heroTop}>
              <div className={usdtStyles.brand}>
                <div className={usdtStyles.usdtLogo} aria-hidden>₮</div>
                <div className={usdtStyles.brandText}>
                  <p className={usdtStyles.brandTitle}>Пополнение USDT</p>
                  <p className={usdtStyles.brandSub}>Сеть TRC-20 · Tron</p>
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
                  {qrSrc ? "Отсканируйте QR или переведите точную сумму" : "Переведите точную сумму"}
                </p>
                <p className={usdtStyles.payAmount}>
                  {payAmount}
                  <span>USDT</span>
                </p>
                <p className={usdtStyles.creditLine}>
                  Зачислится на баланс: <strong>{creditAmount ?? "—"} USDT</strong>
                </p>
                <span className={usdtStyles.networkTag}>TRC-20 (Tron)</span>
              </div>
            </div>
          </section>

          <div className={usdtStyles.alertStrip}>
            <span className={usdtStyles.alertIcon} aria-hidden><IconInfo /></span>
            <p className={usdtStyles.alertText}>
              Переводите только в сети TRC-20 и ровно указанную сумму — иначе зачисление не произойдёт автоматически.
            </p>
          </div>

          <section className={usdtStyles.details}>
            <div>
              <span className={usdtStyles.fieldLabel}>Адрес кошелька</span>
              <div className={usdtStyles.addressField}>
                <span className={usdtStyles.addressValue} title={walletAddress}>
                  {walletAddress}
                </span>
                <button
                  className={usdtStyles.copyBtn}
                  onClick={() => copy(walletAddress, "Адрес")}
                  type="button"
                >
                  <IconCopy />
                  Копировать
                </button>
              </div>
            </div>

            <div className={usdtStyles.statsGrid}>
              <div className={usdtStyles.statCard}>
                <span className={usdtStyles.statLabel}>Сеть</span>
                <span className={usdtStyles.statValue}>TRC-20</span>
              </div>
              <div
                className={`${usdtStyles.statCard} ${usdtStyles.statCardClickable}`}
                role="button"
                tabIndex={0}
                onClick={() => copy(String(payAmount), "Сумму")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    void copy(String(payAmount), "Сумму");
                  }
                }}
                title="Скопировать сумму"
              >
                <span className={usdtStyles.statLabel}>К переводу</span>
                <span className={`${usdtStyles.statValue} ${usdtStyles.statValueMono}`}>
                  {payAmount}
                </span>
              </div>
              <div className={usdtStyles.statCard}>
                <span className={usdtStyles.statLabel}>На баланс</span>
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
                <h2 className={usdtStyles.statusTitle}>Ожидаем перевод</h2>
              </div>
              <div className={usdtStyles.timerChip} aria-live="polite">
                <FiClock size={13} aria-hidden />
                <span className={usdtStyles.timerValue}>{formatTimer}</span>
              </div>
            </div>
            <p className={usdtStyles.statusHint}>
              После подтверждения в блокчейне средства зачислятся автоматически — обычно 1–5 минут.
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
              {cancelling ? "Отмена..." : "Отменить платёж"}
            </button>
          </footer>
        </div>

        <DialogClose ref={closeRef} style={{ display: "none" }} />
      </div>
    );
  }

  return (
    <form className={styles.NirvanaPayForm} onSubmit={handleSubmit(onSubmit)}>
      <DepositFormHeading subtitle="USDT TRC-20" />

      <div className={styles.amountField}>
        <Input
          {...register("amount", {
            min: minAmount,
            required: true,
            setValueAs: Number,
            validate: (value) => !!value && value >= minAmount,
          })}
          className={styles.input}
          label="Сумма"
          placeholder="Введите сумму в USDT"
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
          Минимальная сумма пополнения — {minAmount} USDT
        </p>
      ) : null}

      <DialogClose ref={closeRef} style={{ display: "none" }} />

      <Button className={styles.submit} disabled={initLoading} type="submit">
        {initLoading ? "Создание заявки..." : "Пополнить"}
      </Button>
    </form>
  );
};
