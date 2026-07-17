import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useReadLocalStorage } from "usehooks-ts";
import { toast } from "react-toastify";

import { components } from "~/shared/api";
import { Button, Input, LoadingSpinner } from "~/shared/ui";
import { useLocale } from "~/shared/model/useLocale";

import getSymbolFromCurrency from "currency-symbol-map";
import { aaioDeposit } from "../../../api";
import styles from "./NirvanaPayForm.module.css";

type DepositDto = components["schemas"]["AaioPaymentSystemDepositDto"];

interface AaioFormProps {
  forceCurrency?: string;
  isImbaMethod?: boolean;
}

export const AaioForm: React.FC<AaioFormProps> = ({ forceCurrency, isImbaMethod = false }) => {
  const { t } = useLocale();
  const { error, isPending, mutateAsync } = useMutation({
    mutationFn: aaioDeposit,
  });
  
  const defaultCurrency = useReadLocalStorage<string>("currency");
  const currency = forceCurrency || defaultCurrency || "UAH";
  
  const {
    formState: { errors },
    handleSubmit,
    register,
    setValue,
  } = useForm<DepositDto>({
    defaultValues: {
      currency: currency,
    },
  });
  const minAmount = currency === "KZT" ? 3000 : 50;
  const quickSetAmounts =
    currency === "KZT"
      ? [3000, 5000, 10000]
      : currency === "RUB"
        ? [2000, 4000, 6000]
        : [2000, 5000, 10000];

  const heading =
    currency === "RUB"
      ? t("deposit.titleCards")
      : isImbaMethod
        ? t("deposit.titleImba")
        : t("deposit.heading");

  const onSubmit = async (dto: DepositDto) => {
    try {
      const { data } = await mutateAsync(dto);

      const link = data?.link;
      if (!link) {
        return toast.error(t("deposit.paymentLinkFailed"), {
          position: "top-right",
          autoClose: 5000,
        });
      }

      toast.info(t("deposit.redirecting"), {
        position: "top-right",
        autoClose: 3000,
      });
      // Try to open in a new tab first to avoid leaving about:blank tabs
      const newWin = window.open(link, "_blank");
      if (!newWin) {
        // Popup blocked: fallback to redirect current tab
        window.location.href = link;
      } else {
        // Security best practice
        newWin.opener = null;
      }
    } catch (e: any) {
      const message = e?.message || t("deposit.paymentCreateFailed");
      toast.error(message, {
        position: "top-right",
        autoClose: 5000,
      });
    }
  };
  const quickSet =
    (amount: number) => (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      setValue("amount", amount);
    };

  return (
    <form className={styles.NirvanaPayForm} onSubmit={handleSubmit(onSubmit)}>
      <h2 className={styles.heading}>{heading}</h2>

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
      {errors && errors.amount ? (
        <p className={styles.error}>
          {t("deposit.minAmount", { amount: String(minAmount) })}
        </p>
      ) : null}
      
      {/* Promo field temporarily disabled */}
      {/* <Input
        className={styles.input}
        label={t("deposit.promoOptional")}
        placeholder={t("deposit.promoPlaceholder")}
        type="text"
      /> */}
      
      {error ? <p className={styles.error}>{error.message}</p> : null}
      <Button className={styles.submit} disabled={isPending} type="submit">
        {isImbaMethod ? t("deposit.topUpImba") : t("deposit.topUp")}
        {isPending && <LoadingSpinner className={styles.loader} />}
      </Button>

    </form>
  );
};
