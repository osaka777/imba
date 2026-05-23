"use client";

import { useMemo, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import getSymbolFromCurrency from "currency-symbol-map";
import { useForm } from "react-hook-form";
import { useReadLocalStorage } from "usehooks-ts";
import { toast } from "react-toastify";
import { FiX } from "react-icons/fi";
import { Button, Input } from "~/shared/ui";
import { DialogClose } from "~/shared/ui/Dialog";
import {
  initManualForeignCardOrder,
  uploadRubForeignCardReceipt,
  getMyRubForeignCardOrder,
} from "~/entities/finance/api/deposit";
import { ManualForeignCardPage } from "~/entities/finance/ui/ManualForeignCardPage/ManualForeignCardPage";
import { trackDepositOrder, untrackDepositOrder } from "~/shared/lib/appNotifications";
import paymentModalStyles from "./PaymentModal.module.css";
import styles from "./NirvanaPayForm.module.css";

interface FormShape {
  amount: number;
  currency: string;
}

export const ForeignRubInitForm = ({ forceCurrency }: { forceCurrency?: string }) => {
  const defaultCurrency = useReadLocalStorage<string>("currency") || "RUB";
  const currency = forceCurrency || defaultCurrency;
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [orderId, setOrderId] = useState<number | undefined>(undefined);
  const [publicOrderId, setPublicOrderId] = useState<number | undefined>(undefined);
  const [depositAmount, setDepositAmount] = useState("");
  const [initLoading, setInitLoading] = useState(false);

  const minAmount = 2000;
  const quickSetAmounts = useMemo(() => [2000, 4000, 6000], []);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormShape>({
    defaultValues: { currency, amount: undefined as unknown as number },
  });

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
        method: "RUB_FOREIGN_CARD",
        source: "deposit-modal",
      });
      setOrderId(init?.order?.id);
      setPublicOrderId(init?.order?.publicOrderId);
      setDepositAmount(String(amount));
      setPaymentOpen(true);
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

  return (
    <>
      <form className={styles.NirvanaPayForm} onSubmit={handleSubmit(onSubmit)}>
        <h2 className={styles.heading}>Пополнение — Иностранная карта</h2>

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

        <DialogClose ref={closeRef} style={{ display: "none" }} />

        <Button className={styles.submit} disabled={initLoading} type="submit">
          {initLoading ? "Создание заявки..." : "Пополнить"}
        </Button>
      </form>

      <DialogPrimitive.Root open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-[6px]" />
          <DialogPrimitive.Content
            className={paymentModalStyles.content}
            onEscapeKeyDown={(e) => e.preventDefault()}
            onInteractOutside={(e) => e.preventDefault()}
            onPointerDownOutside={(e) => e.preventDefault()}
          >
            <DialogPrimitive.Title className="sr-only">
              Пополнение RUB — Перевод по карте
            </DialogPrimitive.Title>
            <div className={paymentModalStyles.header}>
              <DialogPrimitive.Close
                className={paymentModalStyles.closeBtn}
                aria-label="Закрыть"
              >
                <FiX className={paymentModalStyles.closeIcon} aria-hidden size={20} strokeWidth={2.5} />
              </DialogPrimitive.Close>
            </div>
            <div className={paymentModalStyles.body}>
            <ManualForeignCardPage
              asModal
              closeAfterConfirm
              currency="RUB"
              fallbackMinAmount={2000}
              getMyOrder={getMyRubForeignCardOrder}
              initialAmount={depositAmount}
              initialOrderId={orderId}
              initialPublicOrderId={publicOrderId}
              method="RUB_FOREIGN_CARD"
              onPaymentConfirmed={(confirmedId) => {
                const id = confirmedId || orderId;
                setPaymentOpen(false);
                closeRef.current?.click();
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
                setPaymentOpen(false);
                setOrderId(undefined);
                setPublicOrderId(undefined);
                setDepositAmount("");
                closeRef.current?.click();
              }}
              title="Пополнение — Перевод в RUB"
              uploadReceipt={uploadRubForeignCardReceipt}
            />
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
};
