"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useReadLocalStorage } from "usehooks-ts";

import { components } from "~/shared/api";
import { ArrowIcon } from "~/shared/assets";
import {
  Button,
  Input,
  LoadingSpinner,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/shared/ui";

import getSymbolFromCurrency from "currency-symbol-map";
import { bovaDeposit } from "../../../api";
import styles from "./BovaForm.module.css";

type DepositDto = components["schemas"]["BovaPaymentSystemDepositDto"];

const methods = [
  { label: "Карта", value: "card" },
  { label: "Международный", value: "international" },
  { label: "Сберпей", value: "sberpay" },
];

export const BovaForm = () => {
  const [selectValue, setSelectValue] = useState<{
    label: string;
    value: string;
  }>({ label: "Карта", value: "card" });
  const { isPending, mutateAsync } = useMutation({
    mutationFn: bovaDeposit,
  });
  const [error, setError] = useState<string>("");
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
    const { data, error } = await mutateAsync({
      ...dto,
      method: selectValue.value,
    });
    if (data && 'payload' in data && data.payload?.form_url) {
      window.open(data.payload.form_url, "_blank");
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
    <form className={styles.BovaForm} onSubmit={handleSubmit(onSubmit)}>
      <h2 className={styles.heading}>{`Пополнение`}</h2>
      <Select
        onValueChange={(event) =>
          setSelectValue(
            methods.find((method) => method.value === event) as {
              label: string;
              value: string;
            },
          )
        }
        value={selectValue.value}
      >
        <SelectTrigger className={`${styles.select}`}>
          <SelectValue className={styles.selectValue}>
            {selectValue.label}
          </SelectValue>
          <ArrowIcon className={styles.arrowIcon} />
        </SelectTrigger>
        <SelectContent className={styles.selectContent}>
          {methods.map((method) => (
            <SelectItem
              className={styles.selectItem}
              key={method.value}
              value={method.value}
            >
              {method.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        {...register("amount", {
          min: 3000,
          required: true,
          setValueAs: Number,
          validate: (value) => !!value && value >= 3000,
        })}
        className={styles.input}
        label={`Сумма`}
        placeholder={`Введите сумму депозита`}
        type="number"
      />
      <div className={styles.quickSetAmount}>
        <Button
          className={styles.quickSetAmountButton}
          onClick={quickSet(3000)}
        >{`3 000 ${getSymbolFromCurrency(defaultCurrency as string)}`}</Button>
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
        <p className={styles.error}>{`Минимальная сумма - 3000`}</p>
      ) : null}
      <Input
        {...register("wallet", {
          required: true,
          setValueAs: String,
          validate: (value) =>
            !!value && Number(value) > 0 && value.length >= 6,
        })}
        className={styles.input}
        label={`Номер кошелька`}
        placeholder={`Введите номер кошелька`}
        type="number"
      />
      <Input
        {...register("name", {
          required: true,
          setValueAs: String,
          validate: (value) => !!value && value.length > 0,
        })}
        className={styles.input}
        label={`Имя плательщека`}
        placeholder={`Введите имя плательщека`}
        type="text"
      />
      {errors && errors.wallet ? (
        <p className={styles.error}>{`Некоректный номер кошелька`}</p>
      ) : null}
      {error ? <p className={styles.error}>{error}</p> : null}
      <Button className={styles.submit} disabled={isPending} type="submit">
        {`Пополнить`}
        {isPending && <LoadingSpinner className={styles.loader} />}
      </Button>
    </form>
  );
};
