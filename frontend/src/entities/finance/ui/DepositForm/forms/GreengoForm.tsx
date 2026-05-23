import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";

import {
  greengoDeposit,
  greengoDepositNotification,
} from "~/entities/finance/api";
import { Button, Input, LoadingSpinner } from "~/shared/ui";

import { toast } from "react-toastify";
import styles from "./GreengoForm.module.css";

type DepositDto = {
  amount: number;
  currency: string;
};

export const GreengoForm = () => {
  const { isPending, mutateAsync } = useMutation({
    mutationFn: greengoDeposit,
  });

  const [error, setError] = useState<string>("");
  const [dataRecived, setDataRecived] = useState<{
    amount_payable: string;
    order_id: string;
    wallet_payment: string;
  } | null>(null);
  const {
    clearErrors,
    formState: { errors },
    handleSubmit,
    register,
    setValue,
  } = useForm<DepositDto>({
    defaultValues: {
      currency: "KZT",
    },
  });

  const { isPending: isPendingNotif, mutateAsync: mutateAsyncNotif } =
    useMutation({
      mutationFn: greengoDepositNotification,
    });

  const checkDeposit = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (!dataRecived) {
      return;
    }
    const { data, error } = await mutateAsyncNotif({
      id: dataRecived.order_id,
    });

    if (data) {
      toast("Успешно!");
    } else if (error) {
      setError(error?.message || 'Произошла ошибка');
    }
  };

  const onSubmit = async (dto: DepositDto) => {
    const { data, error } = await mutateAsync({
      ...dto,
    });
    const recivedData = data as unknown as {
      amount_payable: string;
      order_id: string;
      wallet_payment: string;
    };
    if (recivedData && recivedData.order_id) {
      clearErrors();
      setDataRecived(recivedData);
    } else if (error) {
      setError(error?.message || 'Произошла ошибка');
    }
  };
  const quickSet =
    (amount: number) => (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      setValue("amount", amount);
    };

  return (
    <form className={styles.GreengoForm} onSubmit={handleSubmit(onSubmit)}>
      <h2 className={styles.heading}>{`Пополнение`}</h2>
      <Input
        {...register("amount", {
          min: 4500,
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
          onClick={quickSet(4500)}
        >{`4500₸`}</Button>
        <Button
          className={styles.quickSetAmountButton}
          onClick={quickSet(5000)}
        >{`5000₸`}</Button>
        <Button
          className={styles.quickSetAmountButton}
          onClick={quickSet(10000)}
        >{`10000₸`}</Button>
      </div>
      {errors && errors.amount ? (
        <p className={styles.error}>{`Минимальная сумма - 4500₸`}</p>
      ) : null}{" "}
      {dataRecived ? null : (
        <Button
          className={styles.submit}
          disabled={isPending || dataRecived !== null}
          type="submit"
        >
          {`Пополнить`}
          {isPending && <LoadingSpinner className={styles.loader} />}
        </Button>
      )}
      <p
        className={styles.text}
      >{`ВНИМАНИЕ! не закрывайте это окно в процессе пополнения`}</p>
      {dataRecived ? (
        <>
          <p className={styles.text}>
            {`Переведите деньги на эту карту: `}
            <span className={styles.textBold}>
              {dataRecived.wallet_payment}
            </span>
          </p>
          <p
            className={styles.text}
          >{`после перевода, нажмите "Я отправил"`}</p>
          <Button className={styles.submit} onClick={checkDeposit}>
            {`Я отправил`}
            {isPendingNotif && <LoadingSpinner className={styles.loader} />}
          </Button>
        </>
      ) : null}
      {error ? <p className={styles.error}>{error}</p> : null}
    </form>
  );
};
