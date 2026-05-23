"use client";

import { useMutation } from "@tanstack/react-query";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

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

import { withdraw } from "../../api";
import styles from "./BovaForm.module.css";
import { useCurrency } from "~/shared/model/useCurrency";

type DepositDto = components["schemas"]["BovaPaymentSystemWithdrawDto"];
type WithdrawResponseDto = components["schemas"]["BovaPaymentSystemWithdrawResponseDto"];

// Локальный тип формы с дополнительными полями
type FormData = DepositDto;

interface WithdrawError {
  message: string | string[];
  statusCode: number;
}

interface WithdrawResponse {
  data?: WithdrawResponseDto;
  error?: WithdrawError;
}

const METHODS = [
  { label: "Карта", value: "card" },
  { label: "Криптовалюта", value: "crypto" },
] as const;

const CARD_TYPES = [
  { label: "Казахстанская", value: "cards_kz", currency: "auto" },
  { label: "Иностранная", value: "cards_foreign", currency: "auto" },
] as const;

const CRYPTO_TYPES = [
  { label: "TRC-20", value: "usdt_trc20", currency: "USDT" },
  { label: "TRON", value: "usdt_tron", currency: "USDT" },
] as const;

const SUPPORTED_CURRENCIES = ['RUB', 'UAH', 'KZT', 'AZN', 'KGS'] as const;
const SUBMIT_COOLDOWN = 3000;
const REQUEST_TRACKING = new Map<string, { timestamp: number; count: number }>();

const createRequestKey = (data: FormData) => `${data.amount}-${data.currency}-${data.method}-${data.wallet}`;

const isDuplicateRequest = (data: FormData): boolean => {
  const key = createRequestKey(data);
  const now = Date.now();
  const tracking = REQUEST_TRACKING.get(key);

  for (const [k, v] of REQUEST_TRACKING.entries()) {
    if (now - v.timestamp > 15000) REQUEST_TRACKING.delete(k);
  }

  if (tracking) {
    if (now - tracking.timestamp < 15000) {
      tracking.count++;
      console.warn('Duplicate request detected:', { key, count: tracking.count });
      return true;
    }
  }

  REQUEST_TRACKING.set(key, { timestamp: now, count: 1 });
  return false;
};

export const BovaForm = () => {
  const { currency } = useCurrency();
  const [selectValue, setSelectValue] = useState<typeof METHODS[number]>(METHODS[0]);
  const [selectCardType, setSelectCardType] = useState<typeof CARD_TYPES[number]>(CARD_TYPES[0]);
  const [selectCryptoType, setSelectCryptoType] = useState<typeof CRYPTO_TYPES[number]>(CRYPTO_TYPES[0]);
  const [error, setError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableCardTypes = useMemo(() => {
    if (SUPPORTED_CURRENCIES.includes(currency as any)) {
      return CARD_TYPES;
    }
    return [CARD_TYPES[1]]; // Foreign cards only
  }, [currency]);

  // Ensure selectCardType is always valid for availableCardTypes
  useEffect(() => {
    if (!selectCardType || !availableCardTypes.some(card => card.value === selectCardType.value)) {
      setSelectCardType(availableCardTypes[0]);
    }
  }, [availableCardTypes, selectCardType]);

  // Auto-switch to crypto for USDT currency
  useEffect(() => {
    if (currency === "USDT" && selectValue.value !== "crypto") {
      setSelectValue(METHODS[1]); // crypto
    }
  }, [currency, selectValue.value]);

  const currentMethod = useMemo(() => {
    if (selectValue.value === "card") return selectCardType?.value || "";
    if (selectValue.value === "crypto") return selectCryptoType?.value || "";
    return "";
  }, [selectValue, selectCardType, selectCryptoType]);

  const minAmount = useMemo(() => {
    if (selectValue.value === "crypto") return 500;
    return currency === "KZT" ? 3000 : 500;
  }, [selectValue, currency]);
  const maxAmount = useMemo(() => selectValue.value === "crypto" ? 5000 : 75000, [selectValue]);
  const quickSetAmounts = useMemo(() => {
    if (selectValue.value === "crypto") return [500, 1000, 2000];
    return currency === "KZT" ? [3000, 6000, 9000] : [500, 1000, 2000];
  }, [selectValue, currency]);

  const submitCountRef = useRef(0);
  const lastSubmitTimeRef = useRef(0);
  const pendingRequestRef = useRef<Promise<any> | null>(null);
  const isSubmittingRef = useRef(false);

  const { mutateAsync, isPending } = useMutation<WithdrawResponse, Error, DepositDto>({
    mutationFn: withdraw,
    onMutate: () => {
      submitCountRef.current += 1;
      isSubmittingRef.current = true;
      setIsSubmitting(true);
    },
    onSettled: () => {
      setTimeout(() => {
        isSubmittingRef.current = false;
        setIsSubmitting(false);
        submitCountRef.current = 0;
      }, 2000);
    },
  });

  const schema = z.object({
    amount: z.number().min(minAmount).max(maxAmount).positive(),
    currency: z.string(),
    method: z.string(),
    wallet: z.string().min(1, "Поле обязательно для заполнения").refine((val) => {
      if (selectValue.value === "card") {
        const cleanValue = val.replace(/[\s\-]/g, '');
        return /^\d{13,19}$/.test(cleanValue);
      }
      if (selectValue.value === "crypto") return val.length >= 30 && val.length <= 50;
      return true;
    }, {
      message: selectValue.value === "card"
        ? "Номер карты должен содержать 13–19 цифр"
        : "Адрес кошелька должен содержать 30-50 символов"
    }),
    bank: z.number().optional(),
  });

  const { register, handleSubmit, formState: { errors, isValid }, reset, setValue, getValues } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { currency, amount: 0, wallet: "", method: currentMethod },
    mode: "onBlur",
  });

  useEffect(() => {
    setValue("wallet", "");
    setValue("method", currentMethod);
  }, [selectValue.value, setValue, selectCardType?.value, selectCryptoType?.value, currentMethod]);

  const onSubmit = useCallback(async (dto: FormData) => {
    if (isSubmittingRef.current || isPending) return;

    const now = Date.now();
    if (now - lastSubmitTimeRef.current < SUBMIT_COOLDOWN || isDuplicateRequest(dto)) {
      setError("Подождите немного перед повторной попыткой");
      return;
    }

    lastSubmitTimeRef.current = now;
    setError("");
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const formData = getValues();
      const requestData = {
        amount: Number(formData.amount),
        currency,
        method: currentMethod,
        wallet: formData.wallet,
      };



      if (pendingRequestRef.current) await pendingRequestRef.current;

      pendingRequestRef.current = mutateAsync(requestData);
      const response = await pendingRequestRef.current;
      pendingRequestRef.current = null;

      if (response?.data) {
        reset({ currency, amount: 0, wallet: "" });
        setError("");
      } else if (response?.error) {
        const message = Array.isArray(response.error.message) ? response.error.message[0] : response.error.message;
        setError(message || "Произошла ошибка при выводе средств");
      } else {
        setError("Неожиданный ответ от сервера");
      }
    } catch (err: any) {
      setError(err?.message || "Произошла неизвестная ошибка");
    } finally {
      pendingRequestRef.current = null;
      setTimeout(() => {
        isSubmittingRef.current = false;
        setIsSubmitting(false);
        submitCountRef.current = 0;
      }, 2000);
    }
  }, [isPending, currentMethod, currency, mutateAsync, reset, getValues]);

  const quickSet = useCallback((amount: number) => (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setValue("amount", amount, { shouldValidate: true });
  }, [setValue]);

  return (
    <form className={styles.BovaForm} onSubmit={handleSubmit(onSubmit)}>
      <h2 className={styles.heading}>{`Вывод ${currency}`}</h2>

      {/* Метод вывода */}
      <div className={styles.formGroup}>
        <label className={styles.label}>Метод вывода</label>
        <Select
          disabled={isSubmitting || isPending}
          onValueChange={(event) => setSelectValue(METHODS.find(m => m.value === event)!)}
          value={selectValue.value}
        >
          <SelectTrigger className={styles.select}>
            <SelectValue placeholder={selectValue.label} />
            <ArrowIcon className={styles.arrowIcon} />
          </SelectTrigger>
          <SelectContent className={styles.selectContent}>
            {METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>



      {/* Тип карты */}
      {selectValue.value === "card" && (
        <div className={styles.formGroup}>
          <label className={styles.label}>Тип карты</label>
          <Select
            disabled={isSubmitting || isPending}
            onValueChange={(event) => setSelectCardType(availableCardTypes.find(t => t.value === event)!)}
            value={selectCardType?.value || ""}
          >
            <SelectTrigger className={styles.select}>
              <SelectValue placeholder={availableCardTypes.find(c => c.value === selectCardType?.value)?.label} />
              <ArrowIcon className={styles.arrowIcon} />
            </SelectTrigger>
            <SelectContent className={styles.selectContent}>
              {availableCardTypes.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Тип криптовалюты */}
      {selectValue.value === "crypto" && (
        <div className={styles.formGroup}>
          <label className={styles.label}>Тип криптовалюты</label>
          <Select
            disabled={isSubmitting || isPending}
            onValueChange={(event) => setSelectCryptoType(CRYPTO_TYPES.find(t => t.value === event)!)}
            value={selectCryptoType.value}
          >
            <SelectTrigger className={styles.select}>
              <SelectValue placeholder={CRYPTO_TYPES.find(c => c.value === selectCryptoType.value)?.label} />
              <ArrowIcon className={styles.arrowIcon} />
            </SelectTrigger>
            <SelectContent className={styles.selectContent}>
              {CRYPTO_TYPES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Input кошелька / карты */}
      <div className={styles.formGroup}>
        <Input
          {...register("wallet")}
          className={styles.input}
          disabled={isSubmitting || isPending}
          label={selectValue.value === "card" ? "Номер карты" : "USDT адрес"}
          placeholder={selectValue.value === "card" ? "Введите номер карты" : "Введите USDT адрес (TRC20)"}
          type="text"
        />
      </div>

      {/* Input суммы */}
      <div className={styles.formGroup}>
        <Input
          {...register("amount", { valueAsNumber: true })}
          className={styles.input}
          disabled={isSubmitting || isPending}
          label={`Сумма в ${currency}`}
          placeholder="Введите сумму снятия"
          type="number"
        />
      </div>

      {/* Быстрый выбор суммы */}
      <div className={styles.formGroup}>
        <label className={styles.label}>Быстрый выбор суммы</label>
        <div className={styles.quickSetAmount}>
          {quickSetAmounts.map(val => (
            <Button key={val} onClick={quickSet(val)} className={styles.quickSetAmountButton} disabled={isSubmitting || isPending}>
              {val}
            </Button>
          ))}
        </div>
      </div>
   
      {errors.amount && <p className={styles.error}>{`Сумма должна быть от ${minAmount} до ${maxAmount}`}</p>}
      {errors.wallet && <p className={styles.error}>
        {selectValue.value === "crypto" ? "Некорректный USDT адрес" : "Номер карты должен содержать 13-19 цифр"}
      </p>}
      {error && <p className={styles.error}>{error}</p>}

      <Button
        className={styles.submit}
        disabled={isSubmitting || !isValid || isPending || submitCountRef.current > 0}
        type="submit"
      >
        {`Вывести ${currency}`}
        {(isSubmitting || isPending) && <LoadingSpinner className={styles.loader} />}
      </Button>
    </form>
  );
};
