"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useReadLocalStorage } from "usehooks-ts";
import { toast } from "react-toastify";
import { Button, Input, LoadingSpinner } from "~/shared/ui";
import { useLocale } from "~/shared/model/useLocale";
import styles from "./ForeignKztCardForm.module.css";
import { DepositFormHeading } from "../DepositFormHeading";
import { uploadKztForeignCardReceipt } from "../../../api/deposit";

interface FormShape {
  amount: number;
  receipt: FileList;
  voucher?: string;
}

export const ForeignKztCardForm = ({ forceCurrency }: { forceCurrency?: string }) => {
  const { t } = useLocale();
  const defaultCurrency = useReadLocalStorage<string>("currency") || "KZT";
  const currency = forceCurrency || defaultCurrency;

  const [secondsLeft, setSecondsLeft] = useState(30);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    timerRef.current = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [secondsLeft]);

  const { register, handleSubmit, formState: { isSubmitting, errors }, reset } = useForm<FormShape>({
    defaultValues: { amount: undefined as any },
  });

  const formattedTimer = useMemo(() => {
    const mm = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
    const ss = (secondsLeft % 60).toString().padStart(2, "0");
    return `${mm}:${ss}`;
  }, [secondsLeft]);

  const onSubmit = async (data: FormShape) => {
    try {
      const file = data.receipt?.[0];
      if (!file) {
        toast.warn(t("deposit.uploadReceipt"));
        return;
      }
      const form = new FormData();
      form.append("amount", String(data.amount));
      form.append("currency", currency);
      form.append("method", "KZT_FOREIGN_CARD");
      form.append("cardNumber", "5351 7737 9598 4711");
      form.append("holderName", "Ali Kaliyev");
      form.append("receipt", file);
      // Optional bonus activation voucher (deposit bonus)
      if (data.voucher) {
        form.append("voucher", data.voucher.trim());
      }

      await uploadKztForeignCardReceipt(form);
      toast.success(t("deposit.requestSent"));
      reset();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || t("deposit.receiptSendFailed");
      toast.error(msg);
    }
  };

  if (currency !== "KZT") {
    return (
      <div className={styles.notice}>{t("deposit.kztOnly")}</div>
    );
  }

  return (
    <form className={styles.ForeignKztCardForm} onSubmit={handleSubmit(onSubmit)}>
      <DepositFormHeading subtitle={t("deposit.foreignCard")} />

      <div className={styles.timerRow}>
        <span>{t("deposit.transferTime")}</span>
        {/* <span className={styles.timer}>{formattedTimer}</span> */}
      </div>

      <div className={styles.cardBlock}>
        <div className={styles.cardLine}><span className={styles.label}>{t("deposit.card")}</span> 5351 7737 9598 4711</div>
        <div className={styles.cardLine}><span className={styles.label}>{t("deposit.cardHolder")}</span> Ali Kaliyev</div>
      </div>

      <Input
        {...register("amount", { required: true, min: 3000, setValueAs: Number })}
        className={styles.input}
        label={t("deposit.amountMinLabel", { amount: "3000 KZT" })}
        placeholder={t("deposit.amountPlaceholder")}
        type="number"
      />
      {errors.amount && (
        <p className={styles.error}>{t("deposit.minAmountShort", { amount: "3000 KZT" })}</p>
      )}

      {/* Optional voucher for deposit bonus activation */}
      <Input
        {...register("voucher")}
        className={styles.input}
        label={t("deposit.bonusCodeOptional")}
        placeholder={t("deposit.bonusCodePlaceholder")}
        type="text"
      />

      <div className={styles.uploadBlock}>
        <label className={styles.uploadLabel}>{t("deposit.uploadPhoto")}</label>
        <input
          {...register("receipt", { required: true })}
          className={styles.fileInput}
          type="file"
          accept="image/*"
        />
      </div>

      <Button className={styles.submit} type="submit" disabled={isSubmitting}>
        {t("deposit.submitReview")}
        {isSubmitting && <LoadingSpinner className={styles.loader} />}
      </Button>

      <p className={styles.hint}>
        {t("deposit.afterSubmitHint")}
      </p>
    </form>
  );
};
