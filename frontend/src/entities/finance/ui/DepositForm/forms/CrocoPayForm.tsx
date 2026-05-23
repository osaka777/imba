import { useMutation } from "@tanstack/react-query";
import getSymbolFromCurrency from "currency-symbol-map";
import { useForm } from "react-hook-form";
import { useReadLocalStorage } from "usehooks-ts";
import { toast } from "react-toastify";

import { crocopayDeposit } from "~/entities/finance/api/crocopayDeposit";
import { components } from "~/shared/api";
import { Button, Input, LoadingSpinner } from "~/shared/ui";

import styles from "./CrocoPayForm.module.css";

type DepositDto = components["schemas"]["CrocopayPaymentSystemDepositDto"];

export const CrocoPayForm = () => {
  const { error, isPending, mutateAsync } = useMutation({
    mutationFn: crocopayDeposit,
  });
  const defaultCurrency = useReadLocalStorage<string>("currency");
  const {
    formState: { errors },
    handleSubmit,
    register,
    setValue,
  } = useForm<DepositDto>({
    defaultValues: {
      currency: defaultCurrency ?? "USD",
    },
  });
  const onSubmit = async (dto: DepositDto) => {
    const win = window.open("about:blank");
    const { data } = await mutateAsync(dto);
    if (data) {
      if (!win) {
        return toast.warning("⚠️ Не закрывайте окно оплаты!", {
          position: "top-right",
          autoClose: 4000,
        });
      }
      toast.info("🔄 Перенаправление на страницу оплаты...", {
        position: "top-right",
        autoClose: 3000,
      });
      win.location = data.redirect_url;
    }
  };
  const quickSet =
    (amount: number) => (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      setValue("amount", amount);
    };

  return (
    <form className={styles.CrocoPayForm} onSubmit={handleSubmit(onSubmit)}>
      <h2 className={styles.heading}>{`Пополнение`}</h2>
      <Input
        {...register("amount", {
          min: 50,
          required: true,
          setValueAs: Number,
          validate: (value) => !!value && value > 0,
        })}
        className={styles.input}
        label={`Сумма`}
        placeholder={`Введите сумму депозита`}
        type="number"
      />
      <div className={styles.quickSetAmount}>
        <Button
          className={styles.quickSetAmountButton}
          onClick={quickSet(2000)}
        >{`2 000 ${getSymbolFromCurrency(defaultCurrency as string)}`}</Button>
        <Button
          className={styles.quickSetAmountButton}
          onClick={quickSet(5000)}
        >{`5 000 ${getSymbolFromCurrency(defaultCurrency as string)}`}</Button>
        <Button
          className={styles.quickSetAmountButton}
          onClick={quickSet(10000)}
        >{`10 000 ${getSymbolFromCurrency(defaultCurrency as string)}`}</Button>
      </div>
      {errors && errors.amount ? (
        <p className={styles.error}>{`Минимальная сумма пополнения - 50`}</p>
      ) : null}
      {error ? <p className={styles.error}>{error.message}</p> : null}
      <Button className={styles.submit} disabled={isPending} type="submit">
        {`Пополнить`}
        {isPending && <LoadingSpinner className={styles.loader} />}
      </Button>
    </form>
  );
};
