"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import getSymbolFromCurrency from "currency-symbol-map";
import { useForm } from "react-hook-form";
import { useReadLocalStorage } from "usehooks-ts";
import { toast } from "react-toastify";
import { Button, Input } from "~/shared/ui";
import { DialogClose } from "~/shared/ui/Dialog";
import {
  initManualForeignCardOrder,
  uploadRubForeignCardReceipt,
  uploadRubSberbankReceipt,
  uploadRubYandexBankReceipt,
  uploadRubVtbBankReceipt,
  getMyRubForeignCardOrder,
  getMyRubSberbankOrder,
  getMyRubYandexBankOrder,
  getMyRubVtbBankOrder,
  getManualDepositConfig,
  type ManualForeignCardMethod,
} from "~/entities/finance/api/deposit";
import { calculateBrlFromRub, formatBrlAmount } from "~/entities/finance/lib/rubBrlConversion";
import { ManualForeignCardPage } from "~/entities/finance/ui/ManualForeignCardPage/ManualForeignCardPage";
import { trackDepositOrder, untrackDepositOrder } from "~/shared/lib/appNotifications";
import { useLocale } from "~/shared/model/useLocale";
import type { MessageKey } from "~/shared/i18n/locales";
import type { TranslateParams } from "~/shared/i18n/messages";
import paymentModalStyles from "./PaymentModal.module.css";
import styles from "./NirvanaPayForm.module.css";
import { DepositFormHeading } from "../DepositFormHeading";

interface FormShape {
  amount: number;
  currency: string;
}

type ForeignRubVariant = "card" | "sberbank" | "yandex" | "vtb";

type Translate = (key: MessageKey, params?: TranslateParams) => string;

const getVariantConfig = (t: Translate) =>
  ({
    card: {
      method: "RUB_FOREIGN_CARD" as ManualForeignCardMethod,
      subtitle: t("deposit.foreignCard"),
      title: t("deposit.titleTransferRub"),
      getMyOrder: getMyRubForeignCardOrder,
      uploadReceipt: uploadRubForeignCardReceipt,
    },
    sberbank: {
      method: "RUB_SBERBANK" as ManualForeignCardMethod,
      subtitle: t("deposit.sberbank"),
      title: t("deposit.titleSberbank"),
      getMyOrder: getMyRubSberbankOrder,
      uploadReceipt: uploadRubSberbankReceipt,
    },
    yandex: {
      method: "RUB_YANDEX_BANK" as ManualForeignCardMethod,
      subtitle: t("deposit.yandexBank"),
      title: t("deposit.titleYandex"),
      getMyOrder: getMyRubYandexBankOrder,
      uploadReceipt: uploadRubYandexBankReceipt,
    },
    vtb: {
      method: "RUB_VTB_BANK" as ManualForeignCardMethod,
      subtitle: t("deposit.vtbBank"),
      title: t("deposit.titleVtb"),
      getMyOrder: getMyRubVtbBankOrder,
      uploadReceipt: uploadRubVtbBankReceipt,
    },
  }) as const;

type ForeignRubInitFormProps = {
  forceCurrency?: string;
  onPaymentStepChange?: (active: boolean) => void;
  variant?: ForeignRubVariant;
  defaultAmount?: number;
  presetAmounts?: number[];
  initialVoucher?: string;
  depositSource?: string;
  embedded?: boolean;
  modalEmbedded?: boolean;
  onDepositComplete?: () => void;
};

export const ForeignRubInitForm = ({
  forceCurrency,
  onPaymentStepChange,
  variant = "sberbank",
  defaultAmount,
  presetAmounts,
  initialVoucher,
  depositSource = "deposit-modal",
  embedded = false,
  modalEmbedded = false,
  onDepositComplete,
}: ForeignRubInitFormProps) => {
  const { t } = useLocale();
  const config = getVariantConfig(t)[variant];
  const defaultCurrency = useReadLocalStorage<string>("currency") || "RUB";
  const currency = forceCurrency || defaultCurrency;
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [orderId, setOrderId] = useState<number | undefined>(undefined);
  const [publicOrderId, setPublicOrderId] = useState<number | undefined>(undefined);
  const [depositAmount, setDepositAmount] = useState("");
  const [initLoading, setInitLoading] = useState(false);
  const [rubPerBrl, setRubPerBrl] = useState(183);
  const [minAmount, setMinAmount] = useState(1000);
  const maxAmount = variant === "vtb" ? 40_000 : undefined;

  const quickSetAmounts = useMemo(
    () =>
      presetAmounts?.length
        ? presetAmounts
        : variant === "sberbank"
          ? [5000, 10000, 15000]
          : variant === "vtb"
            ? [1000, 5000, 10000]
            : [1000, 2000, 5000],
    [presetAmounts, variant],
  );

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormShape>({
    defaultValues: {
      currency,
      amount: (defaultAmount ?? undefined) as unknown as number,
    },
  });

  useEffect(() => {
    if (defaultAmount && defaultAmount >= minAmount) {
      setValue("amount", defaultAmount);
    }
  }, [defaultAmount, minAmount, setValue]);

  const amountValue = watch("amount");
  const brlPreview =
    variant === "sberbank" && amountValue && Number(amountValue) >= minAmount
      ? calculateBrlFromRub(Number(amountValue), rubPerBrl)
      : 0;

  useEffect(() => {
    if (variant !== "sberbank" && variant !== "yandex" && variant !== "vtb") return;
    let cancelled = false;
    (async () => {
      try {
        const configKey =
          variant === "yandex"
            ? "RUB_YANDEX_BANK"
            : variant === "vtb"
              ? "RUB_VTB_BANK"
              : "RUB_SBERBANK";
        const { data } = await getManualDepositConfig(configKey);
        if (!cancelled) {
          if (variant === "sberbank" && data?.rubPerBrl) setRubPerBrl(data.rubPerBrl);
          if (data?.minAmount) setMinAmount(data.minAmount);
        }
      } catch {
        // keep default
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [variant]);

  useEffect(() => {
    onPaymentStepChange?.(paymentOpen);
    return () => onPaymentStepChange?.(false);
  }, [onPaymentStepChange, paymentOpen]);

  const resetPayment = () => {
    setPaymentOpen(false);
    setOrderId(undefined);
    setPublicOrderId(undefined);
    setDepositAmount("");
  };

  const onSubmit = async (data: FormShape) => {
    if (currency !== "RUB") return;
    const amount = Number(data.amount);
    if (!amount || amount < minAmount) {
      toast.warn(
        t("deposit.minAmountShort", {
          amount: `${minAmount.toLocaleString()} RUB`,
        }),
      );
      return;
    }
    if (maxAmount != null && amount > maxAmount) {
      toast.warn(
        t("deposit.maxAmountShort", {
          amount: `${maxAmount.toLocaleString("ru-RU")} ₽`,
        }),
      );
      return;
    }
    setInitLoading(true);
    try {
      const init = await initManualForeignCardOrder({
        amount,
        currency: "RUB",
        method: config.method,
        source: depositSource,
        voucher: initialVoucher,
      });
      setOrderId(init?.order?.id);
      setPublicOrderId(init?.order?.publicOrderId);
      setDepositAmount(String(amount));
      setPaymentOpen(true);
      if (embedded) onDepositComplete?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("deposit.createFailed");
      toast.error(String(msg));
    } finally {
      setInitLoading(false);
    }
  };

  const quickSet = (amount: number) => () => setValue("amount", amount);

  if (currency !== "RUB") {
    return (
      <div className={styles.formSection_empty}>{t("deposit.rubOnly")}</div>
    );
  }

  if (paymentOpen) {
    return (
      <div className={paymentModalStyles.inlinePanel}>
        <button
          type="button"
          className={paymentModalStyles.backBtn}
          onClick={() => {
            if (orderId) untrackDepositOrder(orderId);
            resetPayment();
          }}
        >
          {t("deposit.back")}
        </button>
        <ManualForeignCardPage
          asModal
          currency="RUB"
          fallbackMinAmount={1000}
          getMyOrder={config.getMyOrder}
          initialAmount={depositAmount}
          initialOrderId={orderId}
          initialPublicOrderId={publicOrderId}
          method={config.method}
          onPaymentConfirmed={(confirmedId, confirmedPublicId) => {
            const id = confirmedId || orderId;
            if (id) {
              trackDepositOrder({
                id,
                publicOrderId: confirmedPublicId ?? publicOrderId,
                currency: "RUB",
                method: config.method,
              });
            }
            if (embedded) onDepositComplete?.();
          }}
          onPaymentCancelled={() => {
            if (orderId) untrackDepositOrder(orderId);
            resetPayment();
          }}
          title={config.title}
          uploadReceipt={config.uploadReceipt}
        />
        {!embedded ? <DialogClose ref={closeRef} style={{ display: "none" }} /> : null}
      </div>
    );
  }

  return (
    <form
      className={`${styles.NirvanaPayForm}${embedded ? ` ${styles.NirvanaPayForm_embedded}` : ""}`}
      onSubmit={handleSubmit(onSubmit)}
    >
      {!embedded ? <DepositFormHeading subtitle={config.subtitle} /> : null}

      <div className={styles.amountField}>
        <Input
          {...register("amount", {
            min: minAmount,
            max: maxAmount,
            required: true,
            setValueAs: Number,
            validate: (value) => {
              if (!value || value < minAmount) return false;
              if (maxAmount != null && value > maxAmount) return false;
              return true;
            },
          })}
          className={styles.input}
          label={t("deposit.amount")}
          placeholder={t("deposit.amountPlaceholder")}
          type="number"
        />
      </div>

      {variant === "vtb" && maxAmount != null ? (
        <p className={styles.limitHint}>
          {t("deposit.vtbMaxHint", {
            max: maxAmount.toLocaleString("ru-RU"),
          })}
        </p>
      ) : null}

      {variant === "sberbank" && brlPreview > 0 ? (
        <p className={styles.error} style={{ color: "#60a5fa", marginTop: 0 }}>
          {t("deposit.sendExactBrl", { amount: formatBrlAmount(brlPreview), rate: rubPerBrl.toLocaleString() })}
        </p>
      ) : null}

      <div className={styles.quickSetAmount}>
        {quickSetAmounts.map((amount) => (
          <Button
            key={amount}
            className={styles.quickSetAmountButton}
            onClick={quickSet(amount)}
            type="button"
          >
            {amount.toLocaleString()} {getSymbolFromCurrency(currency)}
          </Button>
        ))}
      </div>

      {errors.amount && (
        <p className={styles.error}>
          {maxAmount != null && Number(amountValue) > maxAmount
            ? t("deposit.maxAmount", {
                amount: `${maxAmount.toLocaleString("ru-RU")} ₽`,
              })
            : t("deposit.minAmount", {
                amount: `${minAmount.toLocaleString()} ${getSymbolFromCurrency(currency)}`,
              })}
        </p>
      )}

      {!embedded ? <DialogClose ref={closeRef} style={{ display: "none" }} /> : null}

      <Button className={styles.submit} disabled={initLoading} type="submit">
        {initLoading ? t("deposit.creatingRequest") : t("deposit.topUp")}
      </Button>
    </form>
  );
};
