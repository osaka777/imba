"use client";

import { useMutation } from "@tanstack/react-query";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { components } from "~/shared/api";
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/shared/ui";
import {
  detectCardBrand,
  formatCardNumber,
  stripCardNumber,
  type CardBrand,
} from "~/shared/lib/cardNumber";

import { withdraw } from "../../api";
import { CardBrandIcon } from "./CardBrandIcon";
import styles from "./BovaForm.module.css";
import { useCurrency } from "~/shared/model/useCurrency";

type DepositDto = components["schemas"]["BovaPaymentSystemWithdrawDto"];
type WithdrawResponseDto = components["schemas"]["BovaPaymentSystemWithdrawResponseDto"];

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

const SUPPORTED_CURRENCIES = ["RUB", "UAH", "KZT", "AZN", "KGS"] as const;
const SUBMIT_COOLDOWN = 3000;
const REQUEST_TRACKING = new Map<string, { timestamp: number; count: number }>();

const createRequestKey = (data: FormData) =>
  `${data.amount}-${data.currency}-${data.method}-${data.wallet}`;

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
      console.warn("Duplicate request detected:", { key, count: tracking.count });
      return true;
    }
  }

  REQUEST_TRACKING.set(key, { timestamp: now, count: 1 });
  return false;
};

export const BovaForm = () => {
  const { currency } = useCurrency();
  const displayCurrency = currency === "USDT" ? "USDT" : currency;
  const [selectValue, setSelectValue] = useState<(typeof METHODS)[number]>(METHODS[0]);
  const [selectCardType, setSelectCardType] = useState<(typeof CARD_TYPES)[number]>(
    CARD_TYPES[0],
  );
  const [selectCryptoType, setSelectCryptoType] = useState<(typeof CRYPTO_TYPES)[number]>(
    CRYPTO_TYPES[0],
  );
  const [error, setError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cardBrand, setCardBrand] = useState<CardBrand>("unknown");

  const availableCardTypes = useMemo(() => {
    if (SUPPORTED_CURRENCIES.includes(currency as (typeof SUPPORTED_CURRENCIES)[number])) {
      return CARD_TYPES;
    }
    return [CARD_TYPES[1]];
  }, [currency]);

  useEffect(() => {
    if (
      !selectCardType ||
      !availableCardTypes.some((card) => card.value === selectCardType.value)
    ) {
      setSelectCardType(availableCardTypes[0]);
    }
  }, [availableCardTypes, selectCardType]);

  useEffect(() => {
    if (currency === "USDT" && selectValue.value !== "crypto") {
      setSelectValue(METHODS[1]);
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

  const maxAmount = useMemo(
    () => (selectValue.value === "crypto" ? 5000 : 75000),
    [selectValue],
  );

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
    wallet: z
      .string()
      .min(1, "Поле обязательно для заполнения")
      .refine(
        (val) => {
          if (selectValue.value === "card") {
            const cleanValue = val.replace(/[\s\-]/g, "");
            return /^\d{13,19}$/.test(cleanValue);
          }
          if (selectValue.value === "crypto") return val.length >= 30 && val.length <= 50;
          return true;
        },
        {
          message:
            selectValue.value === "card"
              ? "Номер карты должен содержать 13–19 цифр"
              : "Адрес кошелька должен содержать 30-50 символов",
        },
      ),
    bank: z.number().optional(),
  });

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isValid },
    reset,
    setValue,
    getValues,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { currency, amount: 0, wallet: "", method: currentMethod },
    mode: "onBlur",
  });

  useEffect(() => {
    setValue("wallet", "");
    setValue("method", currentMethod);
    setValue("currency", currency);
    setCardBrand("unknown");
  }, [selectValue.value, setValue, selectCardType?.value, selectCryptoType?.value, currentMethod, currency]);

  const onSubmit = useCallback(
    async (dto: FormData) => {
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
        const walletValue =
          selectValue.value === "card"
            ? stripCardNumber(formData.wallet)
            : formData.wallet.trim();
        const requestData = {
          amount: Number(formData.amount),
          currency,
          method: currentMethod,
          wallet: walletValue,
        };

        if (pendingRequestRef.current) await pendingRequestRef.current;

        pendingRequestRef.current = mutateAsync(requestData);
        const response = await pendingRequestRef.current;
        pendingRequestRef.current = null;

        if (response?.data) {
          reset({ currency, amount: 0, wallet: "" });
          setCardBrand("unknown");
          setError("");
        } else if (response?.error) {
          const message = Array.isArray(response.error.message)
            ? response.error.message[0]
            : response.error.message;
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
    },
    [isPending, currentMethod, currency, mutateAsync, reset, getValues, selectValue.value],
  );

  const quickSet = useCallback(
    (amount: number) => (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      setValue("amount", amount, { shouldValidate: true });
    },
    [setValue],
  );

  const isLoading = isSubmitting || isPending;

  return (
    <form className={styles.BovaForm} onSubmit={handleSubmit(onSubmit)}>
      <h2 className={styles.heading}>{`Вывод ${displayCurrency}`}</h2>

      <div className={styles.formGroup}>
        <label className={styles.label}>Метод вывода</label>
        <div className={styles.selectWrap}>
          <Select
            disabled={isLoading}
            onValueChange={(event) => setSelectValue(METHODS.find((m) => m.value === event)!)}
            value={selectValue.value}
          >
            <SelectTrigger className={styles.select}>
              <SelectValue placeholder={selectValue.label} />
            </SelectTrigger>
            <SelectContent className={styles.selectContent} position="popper">
              {METHODS.map((m) => (
                <SelectItem className={styles.selectItem} key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectValue.value === "card" && (
        <div className={styles.formGroup}>
          <label className={styles.label}>Тип карты</label>
          <div className={styles.selectWrap}>
            <Select
              disabled={isLoading}
              onValueChange={(event) =>
                setSelectCardType(availableCardTypes.find((t) => t.value === event)!)
              }
              value={selectCardType?.value || ""}
            >
              <SelectTrigger className={styles.select}>
                <SelectValue
                  placeholder={
                    availableCardTypes.find((c) => c.value === selectCardType?.value)?.label
                  }
                />
              </SelectTrigger>
              <SelectContent className={styles.selectContent} position="popper">
                {availableCardTypes.map((c) => (
                  <SelectItem className={styles.selectItem} key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {selectValue.value === "crypto" && (
        <div className={styles.formGroup}>
          <label className={styles.label}>Тип криптовалюты</label>
          <div className={styles.selectWrap}>
            <Select
              disabled={isLoading}
              onValueChange={(event) =>
                setSelectCryptoType(CRYPTO_TYPES.find((t) => t.value === event)!)
              }
              value={selectCryptoType.value}
            >
              <SelectTrigger className={styles.select}>
                <SelectValue
                  placeholder={CRYPTO_TYPES.find((c) => c.value === selectCryptoType.value)?.label}
                />
              </SelectTrigger>
              <SelectContent className={styles.selectContent} position="popper">
                {CRYPTO_TYPES.map((c) => (
                  <SelectItem className={styles.selectItem} key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className={styles.formGroup}>
        <label className={styles.label}>
          {selectValue.value === "card" ? "Номер карты" : "USDT адрес"}
        </label>
        <div className={styles.inputField}>
          {selectValue.value === "card" ? (
            <Controller
              control={control}
              name="wallet"
              render={({ field }) => (
                <Input
                  autoComplete="cc-number"
                  disabled={isLoading}
                  icon={<CardBrandIcon brand={cardBrand} />}
                  inputMode="numeric"
                  name={field.name}
                  onBlur={field.onBlur}
                  onChange={(event) => {
                    const digits = stripCardNumber(event.target.value);
                    setCardBrand(detectCardBrand(digits));
                    field.onChange(digits);
                  }}
                  placeholder="0000 0000 0000 0000"
                  ref={field.ref}
                  type="text"
                  value={formatCardNumber(field.value || "")}
                  variant="pill"
                />
              )}
            />
          ) : (
            <Input
              {...register("wallet")}
              disabled={isLoading}
              placeholder="Введите USDT адрес (TRC20)"
              type="text"
              variant="pill"
            />
          )}
        </div>
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label}>{`Сумма в ${displayCurrency}`}</label>
        <div className={styles.inputField}>
          <Input
            {...register("amount", { valueAsNumber: true })}
            disabled={isLoading}
            placeholder="0"
            type="number"
            variant="pill"
          />
        </div>
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label}>Быстрый выбор суммы</label>
        <div className={styles.quickSetAmount}>
          {quickSetAmounts.map((val) => (
            <Button
              key={val}
              className={styles.quickSetAmountButton}
              disabled={isLoading}
              onClick={quickSet(val)}
              type="button"
            >
              {val}
            </Button>
          ))}
        </div>
      </div>

      {errors.amount && (
        <p className={styles.error}>{`Сумма должна быть от ${minAmount} до ${maxAmount}`}</p>
      )}
      {errors.wallet && (
        <p className={styles.error}>
          {selectValue.value === "crypto"
            ? "Некорректный USDT адрес"
            : "Номер карты должен содержать 13-19 цифр"}
        </p>
      )}
      {error && <p className={styles.error}>{error}</p>}

      <Button
        className={styles.submit}
        disabled={isLoading || !isValid || submitCountRef.current > 0}
        type="submit"
      >
        {isLoading ? "Вывод..." : "Вывести"}
      </Button>
    </form>
  );
};
