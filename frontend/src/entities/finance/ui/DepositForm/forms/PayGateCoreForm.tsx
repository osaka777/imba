"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import getSymbolFromCurrency from "currency-symbol-map";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";

import { Button, Input, LoadingSpinner } from "~/shared/ui";
import { DialogClose } from "~/shared/ui/Dialog";
import { useLocale } from "~/shared/model/useLocale";
import {
  cancelPayGateCoreDeposit,
  createPayGateCoreDeposit,
  getMyPayGateCoreDeposit,
  getPayGateCoreDepositStatus,
  type PayGateCoreDepositResponse,
  type PayGateCoreRequisites,
} from "~/entities/finance/api/paygatecoreDeposit";
import { trackDepositOrder, untrackDepositOrder } from "~/shared/lib/appNotifications";

import paymentModalStyles from "./PaymentModal.module.css";
import nirvanaStyles from "./NirvanaPayForm.module.css";
import styles from "./PayGateCoreForm.module.css";
import { DepositFormHeading } from "../DepositFormHeading";

type FormShape = {
  amount: number;
  voucher?: string;
};

type PayGateCoreFormProps = {
  forceCurrency?: string;
  defaultAmount?: number;
  presetAmounts?: number[];
  initialVoucher?: string;
  depositSource?: string;
  embedded?: boolean;
  onPaymentStepChange?: (active: boolean) => void;
  onDepositComplete?: () => void;
};

const formatCard = (num?: string) => {
  if (!num) return "";
  const digits = num.replace(/\s/g, "");
  return digits.replace(/(.{4})/g, "$1 ").trim();
};

const hasUsableRequisites = (requisites?: PayGateCoreRequisites | null) =>
  Boolean(
    requisites?.cardNumber ||
      requisites?.phoneNumber ||
      requisites?.paymentLink ||
      requisites?.ownerName,
  );

const CopyButton = ({ text }: { text: string }) => {
  const { t } = useLocale();
  return (
  <button
    type="button"
    className={styles.copyBtn}
    onClick={() => {
      void navigator.clipboard.writeText(text);
      toast.success(t("deposit.copied"));
    }}
  >
    {t("deposit.copy")}
  </button>
  );
};

export const PayGateCoreForm = ({
  forceCurrency,
  defaultAmount,
  presetAmounts,
  initialVoucher,
  depositSource = "deposit-modal",
  embedded = false,
  onPaymentStepChange,
  onDepositComplete,
}: PayGateCoreFormProps) => {
  const { t } = useLocale();
  const currency = "RUB";
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const minAmount = 1000;
  const quickSetAmounts = useMemo(
    () => (presetAmounts?.length ? presetAmounts : [1000, 2000, 5000]),
    [presetAmounts],
  );

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [depositId, setDepositId] = useState<number | undefined>();
  const [publicOrderId, setPublicOrderId] = useState<number | undefined>();
  const [amount, setAmount] = useState(0);
  const [expiresAt, setExpiresAt] = useState<string | undefined>();
  const [requisites, setRequisites] = useState<PayGateCoreRequisites | null>(null);
  const [initLoading, setInitLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(true);
  const [status, setStatus] = useState<string>("pending");
  const [secondsLeft, setSecondsLeft] = useState(0);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormShape>({
    defaultValues: {
      amount: (defaultAmount ?? undefined) as unknown as number,
      voucher: initialVoucher,
    },
  });

  const applySession = useCallback((res: PayGateCoreDepositResponse) => {
    setDepositId(res.depositId);
    setPublicOrderId(res.publicOrderId);
    setAmount(res.amount);
    setExpiresAt(res.expiresAt);
    setRequisites(res.requisites ?? null);
    setStatus("pending");
    if (hasUsableRequisites(res.requisites)) {
      setPaymentOpen(true);
    }
  }, []);

  useEffect(() => {
    if (defaultAmount && defaultAmount >= minAmount) {
      setValue("amount", defaultAmount);
    }
  }, [defaultAmount, minAmount, setValue]);

  useEffect(() => {
    let cancelled = false;
    setRestoreLoading(true);
    void (async () => {
      try {
        const active = await getMyPayGateCoreDeposit();
        if (cancelled || !active.active) return;
        applySession(active);
      } catch {
        /* no active session */
      } finally {
        if (!cancelled) setRestoreLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applySession]);

  useEffect(() => {
    onPaymentStepChange?.(paymentOpen);
    return () => onPaymentStepChange?.(false);
  }, [onPaymentStepChange, paymentOpen]);

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(diff);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  useEffect(() => {
    if (!paymentOpen || !depositId) return undefined;
    if (status === "approved" || status === "rejected") return undefined;

    const poll = async () => {
      try {
        const data = await getPayGateCoreDepositStatus(depositId);
        setStatus(data.status);
        if (data.requisites && hasUsableRequisites(data.requisites)) {
          setRequisites(data.requisites);
        }
        if (data.expiresAt) setExpiresAt(data.expiresAt);
        if (data.status === "approved") {
          toast.success(t("deposit.fundsCreditedToast"));
          if (embedded) onDepositComplete?.();
          else closeRef.current?.click();
          trackDepositOrder({
            id: depositId,
            publicOrderId: data.publicOrderId,
            currency,
          });
        } else if (data.status === "rejected") {
          toast.error(t("deposit.paymentFailedToast"));
        }
      } catch {
        /* ignore polling errors */
      }
    };

    void poll();
    const id = setInterval(() => void poll(), 5000);
    return () => clearInterval(id);
  }, [paymentOpen, depositId, status, currency, embedded, onDepositComplete]);

  const formattedTimer = useMemo(() => {
    const mm = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
    const ss = (secondsLeft % 60).toString().padStart(2, "0");
    return `${mm}:${ss}`;
  }, [secondsLeft]);

  const hidePaymentView = () => {
    // Keep backend session — user can reopen and continue the same order.
    setPaymentOpen(false);
  };

  const resetPayment = () => {
    setPaymentOpen(false);
    setDepositId(undefined);
    setPublicOrderId(undefined);
    setRequisites(null);
    setExpiresAt(undefined);
    setAmount(0);
    setStatus("pending");
  };

  const onSubmit = async (data: FormShape) => {
    const value = Number(data.amount);
    if (!value || value < minAmount) {
      toast.warn(
        t("deposit.minAmountShort", {
          amount: `${minAmount.toLocaleString()} ${currency}`,
        }),
      );
      return;
    }
    setInitLoading(true);
    try {
      const res = await createPayGateCoreDeposit({
        amount: value,
        currency,
        voucher: data.voucher?.trim() || initialVoucher,
        source: depositSource,
      });
      applySession(res);
      if (embedded) onDepositComplete?.();
    } catch (err: unknown) {
      // Fallback: if server still reports an active request, restore P2P session.
      try {
        const active = await getMyPayGateCoreDeposit();
        if (active.active) {
          applySession(active);
          return;
        }
      } catch {
        /* ignore */
      }
      toast.error(err instanceof Error ? err.message : t("deposit.createFailed"));
    } finally {
      setInitLoading(false);
    }
  };

  const handleCancel = useCallback(async () => {
    if (depositId) {
      try {
        await cancelPayGateCoreDeposit(depositId);
      } catch {
        /* best effort */
      }
      untrackDepositOrder(depositId);
    }
    resetPayment();
  }, [depositId]);

  const quickSet = (value: number) => () => setValue("amount", value);

  if (restoreLoading) {
    return (
      <div className={nirvanaStyles.NirvanaPayForm}>
        <LoadingSpinner className={nirvanaStyles.loader} />
      </div>
    );
  }

  if (paymentOpen && requisites && hasUsableRequisites(requisites)) {
    return (
      <div className={paymentModalStyles.inlinePanel}>
        <button type="button" className={paymentModalStyles.backBtn} onClick={hidePaymentView}>
          {t("deposit.back")}
        </button>
        <div className={styles.requisites}>
          <DepositFormHeading subtitle={t("deposit.p2pRubSubtitle")} />

          <div className={styles.hero}>
            <div className={styles.amountBadge}>
              {amount.toLocaleString("ru-RU")} {getSymbolFromCurrency(currency) || currency}
            </div>
            {publicOrderId ? (
              <div className={styles.orderId}>{t("deposit.orderNumber", { id: publicOrderId })}</div>
            ) : null}
          </div>

          <div className={styles.timerRow}>
            <span className={styles.timerLabel}>{t("deposit.transferTime")}</span>
            <span className={styles.timer}>{formattedTimer}</span>
          </div>

          <div className={styles.cardBlock}>
            {requisites.phoneNumber ? (
              <div className={styles.cardLine}>
                <div>
                  <span className={styles.label}>{t("deposit.phoneLabel")}</span>
                  <span className={styles.value}>{requisites.phoneNumber}</span>
                </div>
                <CopyButton text={requisites.phoneNumber} />
              </div>
            ) : null}
            {requisites.cardNumber ? (
              <div className={styles.cardLine}>
                <div>
                  <span className={styles.label}>{t("deposit.card")}</span>
                  <span className={styles.value}>{formatCard(requisites.cardNumber)}</span>
                </div>
                <CopyButton text={requisites.cardNumber.replace(/\s/g, "")} />
              </div>
            ) : null}
            {requisites.ownerName ? (
              <div className={styles.cardLine}>
                <div>
                  <span className={styles.label}>{t("deposit.recipientLabel")}</span>
                  <span className={styles.value}>{requisites.ownerName}</span>
                </div>
                <CopyButton text={requisites.ownerName} />
              </div>
            ) : null}
            {requisites.bankName ? (
              <div className={styles.cardLine}>
                <div>
                  <span className={styles.label}>{t("deposit.bankLabel")}</span>
                  <span className={styles.value}>{requisites.bankName}</span>
                </div>
                <CopyButton text={requisites.bankName} />
              </div>
            ) : null}
          </div>

          <p className={styles.hint}>
            {t("deposit.p2pExactHint")}
          </p>

          <div className={styles.actions}>
            {requisites.paymentLink ? (
              <a
                className={styles.linkBtn}
                href={requisites.paymentLink}
                rel="noopener noreferrer"
                target="_blank"
              >
                {t("deposit.openPaymentPage")}
              </a>
            ) : null}
            <button type="button" className={styles.cancelBtn} onClick={() => void handleCancel()}>
              {t("deposit.cancelOrder")}
            </button>
          </div>

          {status === "approved" ? (
            <p className={styles.statusOk}>{t("deposit.paymentCredited")}</p>
          ) : null}
          {status === "rejected" ? (
            <p className={styles.statusFail}>{t("deposit.paymentFailed")}</p>
          ) : null}
        </div>
        {!embedded ? <DialogClose ref={closeRef} style={{ display: "none" }} /> : null}
      </div>
    );
  }

  return (
    <form
      className={`${nirvanaStyles.NirvanaPayForm}${embedded ? ` ${nirvanaStyles.NirvanaPayForm_embedded}` : ""}`}
      onSubmit={handleSubmit(onSubmit)}
    >
      {!embedded ? <DepositFormHeading subtitle={t("deposit.p2pRubSubtitle")} /> : null}
      {depositId ? (
        <button
          type="button"
          className={styles.resumeBtn}
          onClick={() => setPaymentOpen(true)}
        >
          {t("deposit.returnToOrder", { id: publicOrderId || depositId })}
        </button>
      ) : null}
      <div className={nirvanaStyles.amountField}>
        <Input
          {...register("amount", {
            min: minAmount,
            required: true,
            setValueAs: Number,
            validate: (value) => !!value && value >= minAmount,
          })}
          className={nirvanaStyles.input}
          label={t("deposit.amount")}
          placeholder={t("deposit.amountPlaceholder")}
          type="number"
        />
      </div>
      <div className={nirvanaStyles.quickSetAmount}>
        {quickSetAmounts.map((value) => (
          <Button
            key={value}
            className={nirvanaStyles.quickSetAmountButton}
            onClick={quickSet(value)}
            type="button"
          >
            {value.toLocaleString()} {getSymbolFromCurrency(currency) || currency}
          </Button>
        ))}
      </div>
      {errors.amount ? (
        <p className={nirvanaStyles.error}>
          {t("deposit.minAmountShort", {
            amount: `${minAmount.toLocaleString()} ${getSymbolFromCurrency(currency) || currency}`,
          })}
        </p>
      ) : null}
      <Input
        {...register("voucher")}
        className={nirvanaStyles.input}
        label={t("deposit.bonusCodeOptional")}
        placeholder={t("deposit.bonusCodePlaceholder")}
        type="text"
      />
      <Button className={nirvanaStyles.submit} disabled={initLoading} type="submit">
        {t("deposit.topUp")}
        {initLoading ? <LoadingSpinner className={nirvanaStyles.loader} /> : null}
      </Button>
    </form>
  );
};
