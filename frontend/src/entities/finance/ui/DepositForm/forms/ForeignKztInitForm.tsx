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
  uploadKztForeignCardReceipt,
  uploadKztKaspiReceipt,
  getMyKztForeignCardOrder,
  getMyKztKaspiOrder,
  type ManualForeignCardMethod,
} from "~/entities/finance/api/deposit";
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

type ForeignKztVariant = "card" | "kaspi";

type Translate = (key: MessageKey, params?: TranslateParams) => string;

const getVariantConfig = (t: Translate) =>
  ({
    card: {
      method: "KZT_FOREIGN_CARD" as ManualForeignCardMethod,
      subtitle: t("deposit.foreignCard"),
      title: t("deposit.titleTransferKzt"),
      getMyOrder: getMyKztForeignCardOrder,
      uploadReceipt: uploadKztForeignCardReceipt,
    },
    kaspi: {
      method: "KZT_KASPI" as ManualForeignCardMethod,
      subtitle: "Kaspi",
      title: t("deposit.titleKaspi"),
      getMyOrder: getMyKztKaspiOrder,
      uploadReceipt: uploadKztKaspiReceipt,
    },
  }) as const;

type ForeignKztInitFormProps = {
  forceCurrency?: string;
  onPaymentStepChange?: (active: boolean) => void;
  variant?: ForeignKztVariant;
  defaultAmount?: number;
  presetAmounts?: number[];
  initialVoucher?: string;
  depositSource?: string;
  embedded?: boolean;
  onDepositComplete?: () => void;
};

export const ForeignKztInitForm = ({
  forceCurrency,
  onPaymentStepChange,
  variant = "card",
  defaultAmount,
  presetAmounts,
  initialVoucher,
  depositSource = "deposit-modal",
  embedded = false,
  onDepositComplete,
}: ForeignKztInitFormProps) => {
  const { t } = useLocale();
  const config = getVariantConfig(t)[variant];
  const defaultCurrency = useReadLocalStorage<string>("currency") || "KZT";
  const currency = forceCurrency || defaultCurrency;
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [orderId, setOrderId] = useState<number | undefined>(undefined);
  const [publicOrderId, setPublicOrderId] = useState<number | undefined>(undefined);
  const [depositAmount, setDepositAmount] = useState("");
  const [initLoading, setInitLoading] = useState(false);

  const minAmount = 3000;
  const quickSetAmounts = useMemo(
    () => (presetAmounts?.length ? presetAmounts : [3000, 6000, 9000]),
    [presetAmounts],
  );

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormShape>({
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
    if (currency !== "KZT") return;
    const amount = Number(data.amount);
    if (!amount || amount < minAmount) {
      toast.warn(
        t("deposit.minAmountShort", {
          amount: `${minAmount.toLocaleString()} KZT`,
        }),
      );
      return;
    }
    setInitLoading(true);
    try {
      const init = await initManualForeignCardOrder({
        amount,
        currency: "KZT",
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

  if (currency !== "KZT") {
    return (
      <div className={styles.formSection_empty}>{t("deposit.kztOnly")}</div>
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
          currency="KZT"
          fallbackMinAmount={3000}
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
                currency: "KZT",
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
            required: true,
            setValueAs: Number,
            validate: (value) => !!value && value >= minAmount,
          })}
          className={styles.input}
          label={t("deposit.amount")}
          placeholder={t("deposit.amountPlaceholder")}
          type="number"
        />
      </div>

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
          {t("deposit.minAmount", {
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
