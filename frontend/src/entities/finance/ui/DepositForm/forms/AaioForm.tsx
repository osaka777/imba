import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useReadLocalStorage } from "usehooks-ts";
import { toast } from "react-toastify";

import { components } from "~/shared/api";
import { Button, Input, LoadingSpinner } from "~/shared/ui";

import getSymbolFromCurrency from "currency-symbol-map";
import { aaioDeposit } from "../../../api";
import styles from "./NirvanaPayForm.module.css";

type DepositDto = components["schemas"]["AaioPaymentSystemDepositDto"];

interface AaioFormProps {
  forceCurrency?: string;
  isImbaMethod?: boolean;
}

export const AaioForm: React.FC<AaioFormProps> = ({ forceCurrency, isImbaMethod = false }) => {
  const { error, isPending, mutateAsync } = useMutation({
    mutationFn: aaioDeposit,
  });
  
  const defaultCurrency = useReadLocalStorage<string>("currency");
  const currency = forceCurrency || defaultCurrency || "USD";
  
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
      ? "Пополнение — Карты"
      : isImbaMethod
        ? "Пополнение через IMBA"
        : "Пополнение";

  const onSubmit = async (dto: DepositDto) => {
    try {
      const { data } = await mutateAsync(dto);

      const link = data?.link;
      if (!link) {
        return toast.error("Не удалось получить ссылку на оплату. Попробуйте позже.", {
          position: "top-right",
          autoClose: 5000,
        });
      }

      toast.info("🔄 Перенаправление на страницу оплаты...", {
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
      const message = e?.message || "Ошибка при создании платежа";
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
      {errors && errors.amount ? (
        <p className={styles.error}>{`Минимальная сумма пополнения - ${minAmount}`}</p>
      ) : null}
      
      {/* Поле для промо-кода временно отключено */}
      {/* <Input
        className={styles.input}
        label={`Промо-код (необязательно)`}
        placeholder={`Введите промо-код для получения бонуса`}
        type="text"
      /> */}
      
      {error ? <p className={styles.error}>{error.message}</p> : null}
      <Button className={styles.submit} disabled={isPending} type="submit">
        {isImbaMethod ? "Пополнить через IMBA" : "Пополнить"}
        {isPending && <LoadingSpinner className={styles.loader} />}
      </Button>

    </form>
  );
};
