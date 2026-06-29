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
  getMyRubForeignCardOrder,
  getMyRubSberbankOrder,
  getManualDepositConfig,
  type ManualForeignCardMethod,
} from "~/entities/finance/api/deposit";
import { calculateBrlFromRub, formatBrlAmount } from "~/entities/finance/lib/rubBrlConversion";
import { ManualForeignCardPage } from "~/entities/finance/ui/ManualForeignCardPage/ManualForeignCardPage";
import { trackDepositOrder, untrackDepositOrder } from "~/shared/lib/appNotifications";
import paymentModalStyles from "./PaymentModal.module.css";
import styles from "./NirvanaPayForm.module.css";
import { DepositFormHeading } from "../DepositFormHeading";

interface FormShape {
  amount: number;
  currency: string;
}

type ForeignRubVariant = "card" | "sberbank";

const VARIANT_CONFIG: Record<
  ForeignRubVariant,
  {
    method: ManualForeignCardMethod;
    subtitle: string;
    title: string;
    getMyOrder: typeof getMyRubForeignCardOrder;
    uploadReceipt: typeof uploadRubForeignCardReceipt;
  }
> = {
  card: {
    method: "RUB_FOREIGN_CARD",
    subtitle: "Иностранная карта",
    title: "Пополнение — Перевод в RUB",
    getMyOrder: getMyRubForeignCardOrder,
    uploadReceipt: uploadRubForeignCardReceipt,
  },
  sberbank: {
    method: "RUB_SBERBANK",
    subtitle: "Перевод из РФ",
    title: "Пополнение — Перевод из РФ",
    getMyOrder: getMyRubSberbankOrder,
    uploadReceipt: uploadRubSberbankReceipt,
  },
};

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
  const config = VARIANT_CONFIG[variant];
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

  const quickSetAmounts = useMemo(
    () => presetAmounts?.length ? presetAmounts : [1000, 2000, 5000],
    [presetAmounts],
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
    if (variant !== "sberbank") return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await getManualDepositConfig("RUB_SBERBANK");
        if (!cancelled) {
          if (data?.rubPerBrl) setRubPerBrl(data.rubPerBrl);
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
      toast.warn(`Минимальная сумма — ${minAmount.toLocaleString()} RUB`);
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
      const msg = err instanceof Error ? err.message : "Не удалось создать заявку";
      toast.error(String(msg));
    } finally {
      setInitLoading(false);
    }
  };

  const quickSet = (amount: number) => () => setValue("amount", amount);

  if (currency !== "RUB") {
    return (
      <div className={styles.formSection_empty}>Метод доступен только для RUB</div>
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
          ← Назад
        </button>
        <ManualForeignCardPage
          asModal
          closeAfterConfirm
          currency="RUB"
          fallbackMinAmount={1000}
          getMyOrder={config.getMyOrder}
          initialAmount={depositAmount}
          initialOrderId={orderId}
          initialPublicOrderId={publicOrderId}
          method={config.method}
          onPaymentConfirmed={(confirmedId) => {
            const id = confirmedId || orderId;
            resetPayment();
            if (embedded) {
              onDepositComplete?.();
            } else {
              closeRef.current?.click();
            }
            if (id) {
              trackDepositOrder({
                id,
                publicOrderId,
                currency: "RUB",
              });
            }
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
          label="Сумма"
          placeholder="Введите сумму депозита"
          type="number"
        />
      </div>

      {variant === "sberbank" && brlPreview > 0 ? (
        <p className={styles.error} style={{ color: "#60a5fa", marginTop: 0 }}>
          Отправьте ровно {formatBrlAmount(brlPreview)} · курс 1 R$ = {rubPerBrl.toLocaleString()} ₽
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
          Минимальная сумма пополнения - {minAmount.toLocaleString()}{" "}
          {getSymbolFromCurrency(currency)}
        </p>
      )}

      {!embedded ? <DialogClose ref={closeRef} style={{ display: "none" }} /> : null}

      <Button className={styles.submit} disabled={initLoading} type="submit">
        {initLoading ? "Создание заявки..." : "Пополнить"}
      </Button>
    </form>
  );
};
