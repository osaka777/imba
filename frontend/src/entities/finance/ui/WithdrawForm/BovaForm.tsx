"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "react-toastify";

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
import { useLocale } from "~/shared/model/useLocale";

import { cancelWithdrawal, fetchUserWithdrawals, forfeitBonus, isBonusWagerWithdrawError, withdraw } from "../../api";
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

const CRYPTO_TYPES = [
  { label: "TRC-20", value: "usdt_trc20", currency: "USDT" },
  { label: "TRON", value: "usdt_tron", currency: "USDT" },
] as const;

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
  const { t } = useLocale();
  const { currency } = useCurrency();
  const queryClient = useQueryClient();
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [error, setError] = useState<string>("");
  const [bonusBlock, setBonusBlock] = useState(false);

  const { data: withdrawals = [] } = useQuery({
    queryKey: ["user-withdrawals"],
    queryFn: fetchUserWithdrawals,
    refetchInterval: 15_000,
  });

  const recentWithdrawals = useMemo(
    () => withdrawals.slice(0, 8),
    [withdrawals],
  );

  const statusLabel = useCallback(
    (status: string) => {
      const key = String(status).toUpperCase();
      if (key === "WAITING" || key === "PENDING") return t("deposit.withdrawStatusWaiting");
      if (key === "PROCESSING") return t("deposit.withdrawStatusProcessing");
      if (key === "SUCCESS" || key === "COMPLETED") return t("deposit.withdrawStatusCompleted");
      if (key === "FAILED" || key === "REJECTED") return t("deposit.withdrawStatusRejected");
      return status;
    },
    [t],
  );

  const statusClass = (status: string) => {
    const key = String(status).toUpperCase();
    if (key === "WAITING" || key === "PENDING") return styles.statusWaiting;
    if (key === "PROCESSING") return styles.statusProcessing;
    if (key === "SUCCESS" || key === "COMPLETED") return styles.statusCompleted;
    if (key === "FAILED" || key === "REJECTED") return styles.statusRejected;
    return styles.statusWaiting;
  };

  const canCancelStatus = (status: string) => {
    const key = String(status).toUpperCase();
    return key === "WAITING" || key === "PENDING";
  };

  const cancelPendingMutation = useMutation({
    mutationFn: cancelWithdrawal,
    onSuccess: async () => {
      toast.success(t("deposit.cancelWithdrawOk"));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["user-withdrawals"] }),
        queryClient.invalidateQueries({ queryKey: ["operations"] }),
        queryClient.invalidateQueries({ queryKey: ["user"] }),
      ]);
    },
    onError: (err: Error) => {
      toast.error(err.message || t("deposit.cancelWithdrawFail"));
    },
    onSettled: () => setCancellingId(null),
  });
  const displayCurrency = currency === "USDT" ? "USDT" : currency;

  const methods = useMemo(
    () => [
      { label: t("deposit.methodCard"), value: "card" as const },
      { label: t("deposit.cryptoUsdt"), value: "crypto" as const },
    ],
    [t],
  );

  const cardTypes = useMemo(
    () => [
      { label: t("deposit.cardKz"), value: "cards_kz" as const, currency: "auto" as const },
      { label: t("deposit.cardRu"), value: "cards_ru" as const, currency: "auto" as const },
      { label: t("deposit.cardForeign"), value: "cards_foreign" as const, currency: "auto" as const },
    ],
    [t],
  );

  const defaultCardType = useMemo(() => {
    if (currency === "RUB") return cardTypes[1]; // Россия
    if (currency === "KZT") return cardTypes[0]; // Казахстан
    return cardTypes[2]; // Иностранная
  }, [currency, cardTypes]);

  const [selectValue, setSelectValue] = useState<(typeof methods)[number]>(methods[0]);
  const [selectCardType, setSelectCardType] = useState<(typeof cardTypes)[number]>(
    defaultCardType,
  );
  const [selectCryptoType, setSelectCryptoType] = useState<(typeof CRYPTO_TYPES)[number]>(
    CRYPTO_TYPES[0],
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cardBrand, setCardBrand] = useState<CardBrand>("unknown");

  useEffect(() => {
    setSelectValue((prev) => methods.find((m) => m.value === prev.value) ?? methods[0]);
  }, [methods]);

  useEffect(() => {
    setSelectCardType((prev) => cardTypes.find((c) => c.value === prev.value) ?? defaultCardType);
  }, [cardTypes, defaultCardType]);

  // Всегда доступны КЗ / РФ / иностранная + USDT отдельно методом
  const availableCardTypes = cardTypes;

  useEffect(() => {
    if (
      !selectCardType ||
      !availableCardTypes.some((card) => card.value === selectCardType.value)
    ) {
      setSelectCardType(defaultCardType);
    }
  }, [availableCardTypes, selectCardType, defaultCardType]);

  useEffect(() => {
    if (currency === "USDT" && selectValue.value !== "crypto") {
      setSelectValue(methods[1]);
    }
  }, [currency, selectValue.value, methods]);

  const currentMethod = useMemo(() => {
    if (selectValue.value === "card") return selectCardType?.value || "";
    if (selectValue.value === "crypto") return selectCryptoType?.value || "";
    return "";
  }, [selectValue, selectCardType, selectCryptoType]);

  /** Для крипты всегда USDT-баланс; для карты — текущая валюта аккаунта */
  const withdrawCurrency = selectValue.value === "crypto" ? "USDT" : currency;
  const headingCurrency = selectValue.value === "crypto" ? "USDT" : displayCurrency;

  const minAmount = useMemo(() => {
    if (selectValue.value === "crypto") return 500;
    return withdrawCurrency === "KZT" ? 3000 : 500;
  }, [selectValue, withdrawCurrency]);

  const maxAmount = useMemo(
    () => (selectValue.value === "crypto" ? 5000 : 75000),
    [selectValue],
  );

  const quickSetAmounts = useMemo(() => {
    if (selectValue.value === "crypto") return [500, 1000, 2000];
    return withdrawCurrency === "KZT" ? [3000, 6000, 9000] : [500, 1000, 2000];
  }, [selectValue, withdrawCurrency]);

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
      .min(1, t("deposit.fieldRequired"))
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
              ? t("deposit.invalidCard")
              : t("deposit.invalidUsdt"),
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
    setValue("currency", withdrawCurrency);
    setCardBrand("unknown");
  }, [selectValue.value, setValue, selectCardType?.value, selectCryptoType?.value, currentMethod, withdrawCurrency]);

  const onSubmit = useCallback(
    async (dto: FormData) => {
      if (isSubmittingRef.current || isPending) return;

      const now = Date.now();
      if (now - lastSubmitTimeRef.current < SUBMIT_COOLDOWN || isDuplicateRequest(dto)) {
        setError(t("deposit.withdrawWait"));
        return;
      }

      lastSubmitTimeRef.current = now;
      setError("");
      setBonusBlock(false);
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
          currency: withdrawCurrency,
          method: currentMethod,
          wallet: walletValue,
        };

        if (pendingRequestRef.current) await pendingRequestRef.current;

        pendingRequestRef.current = mutateAsync(requestData);
        const response = await pendingRequestRef.current;
        pendingRequestRef.current = null;

        if (response?.data) {
          reset({ currency: withdrawCurrency, amount: 0, wallet: "" });
          setCardBrand("unknown");
          setError("");
          setBonusBlock(false);
          await queryClient.invalidateQueries({ queryKey: ["user-withdrawals"] });
        } else if (response?.error) {
          const message = Array.isArray(response.error.message)
            ? response.error.message[0]
            : response.error.message;
          const msg = message || t("deposit.withdrawError");
          setError(msg);
          setBonusBlock(isBonusWagerWithdrawError(msg));
        } else {
          setError(t("deposit.withdrawError"));
          setBonusBlock(false);
        }
      } catch (err: any) {
        const msg = err?.message || t("deposit.withdrawError");
        setError(msg);
        setBonusBlock(isBonusWagerWithdrawError(msg));
      } finally {
        pendingRequestRef.current = null;
        setTimeout(() => {
          isSubmittingRef.current = false;
          setIsSubmitting(false);
          submitCountRef.current = 0;
        }, 2000);
      }
    },
    [isPending, currentMethod, withdrawCurrency, mutateAsync, reset, getValues, selectValue.value, t, queryClient],
  );

  const forfeitBonusMutation = useMutation({
    mutationFn: () => forfeitBonus(withdrawCurrency),
    onSuccess: async (result) => {
      toast.success(result.message || t("deposit.forfeitBonusOk"));
      setError("");
      setBonusBlock(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["user"] }),
        queryClient.invalidateQueries({ queryKey: ["operations"] }),
        queryClient.invalidateQueries({ queryKey: ["user-withdrawals"] }),
      ]);
    },
    onError: (err: Error) => {
      toast.error(err.message || t("deposit.forfeitBonusFail"));
    },
  });

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
      <h2 className={styles.heading}>{t("deposit.withdrawHeading", { currency: headingCurrency })}</h2>

      {recentWithdrawals.length > 0 && (
        <div className={styles.pendingBox}>
          <p className={styles.pendingTitle}>{t("deposit.myWithdrawals")}</p>
          {recentWithdrawals.map((w) => {
            const id = Number(w.id);
            const isCancelling = cancellingId === id && cancelPendingMutation.isPending;
            const cancellable = canCancelStatus(String(w.status));
            return (
              <div className={styles.pendingRow} key={id}>
                <div className={styles.pendingInfo}>
                  <span className={styles.pendingAmount}>
                    {Number(w.amount).toLocaleString("ru-RU")} {w.currencyCode}
                  </span>
                  <span className={styles.pendingMeta}>
                    {w.wallet
                      ? `•••• ${String(w.wallet).replace(/\s/g, "").slice(-4)}`
                      : w.type || "CARD"}
                  </span>
                  <span className={`${styles.statusBadge} ${statusClass(String(w.status))}`}>
                    {statusLabel(String(w.status))}
                  </span>
                </div>
                {cancellable ? (
                  <button
                    className={styles.pendingCancel}
                    disabled={cancelPendingMutation.isPending}
                    onClick={() => {
                      setCancellingId(id);
                      cancelPendingMutation.mutate(id);
                    }}
                    type="button"
                  >
                    {isCancelling
                      ? t("deposit.cancellingWithdraw")
                      : t("deposit.cancelWithdraw")}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <div className={styles.formGroup}>
        <label className={styles.label}>{t("deposit.withdrawMethod")}</label>
        <div className={styles.selectWrap}>
          <Select
            disabled={isLoading}
            onValueChange={(event) => setSelectValue(methods.find((m) => m.value === event)!)}
            value={selectValue.value}
          >
            <SelectTrigger className={styles.select}>
              <SelectValue placeholder={selectValue.label} />
            </SelectTrigger>
            <SelectContent className={styles.selectContent} position="popper">
              {methods.map((m) => (
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
          <label className={styles.label}>{t("deposit.cardType")}</label>
          <div className={styles.selectWrap}>
            <Select
              disabled={isLoading}
              onValueChange={(event) =>
                setSelectCardType(availableCardTypes.find((ctype) => ctype.value === event)!)
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
          <label className={styles.label}>{t("deposit.cryptoType")}</label>
          <div className={styles.selectWrap}>
            <Select
              disabled={isLoading}
              onValueChange={(event) =>
                setSelectCryptoType(CRYPTO_TYPES.find((ctype) => ctype.value === event)!)
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
          {selectValue.value === "card" ? t("deposit.cardNumber") : t("deposit.usdtAddress")}
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
              placeholder={t("deposit.usdtAddressPlaceholder")}
              type="text"
              variant="pill"
            />
          )}
        </div>
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label}>{t("deposit.amountIn", { currency: headingCurrency })}</label>
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
        <label className={styles.label}>{t("deposit.quickAmount")}</label>
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
        <p className={styles.error}>
          {t("deposit.amountRange", { min: minAmount, max: maxAmount })}
        </p>
      )}
      {errors.wallet && (
        <p className={styles.error}>
          {selectValue.value === "crypto"
            ? t("deposit.invalidUsdt")
            : t("deposit.invalidCard")}
        </p>
      )}
      {error && (
        <div className={styles.errorBox}>
          <p className={styles.error}>{error}</p>
          {bonusBlock && (
            <div className={styles.forfeitBox}>
              <p className={styles.forfeitHint}>{t("deposit.forfeitBonusHint")}</p>
              <button
                className={styles.forfeitButton}
                disabled={forfeitBonusMutation.isPending || isLoading}
                onClick={() => forfeitBonusMutation.mutate()}
                type="button"
              >
                {forfeitBonusMutation.isPending
                  ? t("deposit.forfeitBonusPending")
                  : t("deposit.forfeitBonus")}
              </button>
            </div>
          )}
        </div>
      )}

      <Button
        className={styles.submit}
        disabled={isLoading || !isValid || submitCountRef.current > 0}
        type="submit"
      >
        {isLoading ? t("deposit.withdrawing") : t("deposit.withdrawSubmit")}
      </Button>
    </form>
  );
};
