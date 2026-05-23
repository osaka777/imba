"use client";

import { useMutation } from "@tanstack/react-query";
import getSymbolFromCurrency from "currency-symbol-map";
import { useForm } from "react-hook-form";
import { useReadLocalStorage } from "usehooks-ts";
import { toast } from "react-toastify";

import { Button, Input, LoadingSpinner } from "~/shared/ui";
import { createNirvanaPayDeposit, NirvanaPayDepositDto } from "../../../api/deposit";
import styles from "./NirvanaPayForm.module.css";

type DepositDto = {
  amount: number;
  currency: string;
};

export const NirvanaPayForm = ({ forceCurrency }: { forceCurrency?: string }) => {
  const defaultCurrency = useReadLocalStorage<string>("currency") || "KZT";
  const currency = forceCurrency || defaultCurrency;
  
  const getMinAmount = (currency: string) => {
    switch (currency) {
      case "KZT": return 3000;
      case "TRY": return 3000;
      case "UZS": return 30000;
      default: return 50;
    }
  };

  const getQuickSetAmounts = (currency: string) => {
    switch (currency) {
      case "KZT": return [3000, 6000, 9000];
      case "TRY": return [3000, 6000, 9000];
      case "UZS": return [30000, 60000, 100000];
      default: return [3000, 6000, 9000];
    }
  };

  const minAmount = getMinAmount(currency);
  const quickSetAmounts = getQuickSetAmounts(currency);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<DepositDto>({
    defaultValues: {
      currency,
    },
  });

  const { mutateAsync, isPending, error } = useMutation({
    mutationFn: createNirvanaPayDeposit,
  });

  const onSubmit = async (dto: DepositDto) => {
    try {
      const nirvanaPayDto: NirvanaPayDepositDto = {
        amount: dto.amount,
        currency: dto.currency,
        redirectURL: typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_HOST || 'http://localhost:3000'),
        siteName: 'Imba.bet',
        callbackURL: `${typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_HOST || 'http://localhost:3000')}/api/nirvanapay-payin/callback`,
        externalID: `deposit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        // userInfo будет автоматически заполнено на backend с реальным IP-адресом
      };
      
      const response = await mutateAsync(nirvanaPayDto);
      
      if (response?.data?.data?.redirectURL) {
        toast.info("🔄 Перенаправление на страницу оплаты...", {
          position: "top-right",
          autoClose: 3000,
        });
        window.location.href = response.data.data.redirectURL;
      } else if (response?.data?.success === false) {
        toast.error(`❌ Ошибка: ${response?.data?.reason || 'Неизвестная ошибка'}`, {
          position: "top-right",
          autoClose: 5000,
        });
      } else {
        toast.error('❌ Ошибка: API не вернул URL для оплаты. Возможно, недостаточно средств или проблемы с конфигурацией.', {
          position: "top-right",
          autoClose: 6000,
        });
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.reason || 
                          err?.response?.data?.message || 
                          err?.message || 
                          'Ошибка при создании депозита';
      toast.error(`❌ ${errorMessage}`, {
        position: "top-right",
        autoClose: 5000,
      });
    }
  };

  const quickSet = (amount: number) => () => setValue("amount", amount);

  return (
    <form className={styles.NirvanaPayForm} onSubmit={handleSubmit(onSubmit)}>
      <h2 className={styles.heading}>Пополнение через NirvanaPay</h2>

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
        {quickSetAmounts.map(amount => (
          <Button
            key={amount}
            className={styles.quickSetAmountButton}
            onClick={quickSet(amount)}
          >
            {amount.toLocaleString()} {getSymbolFromCurrency(currency)}
          </Button>
        ))}
      </div>
      
      {errors.amount && (
        <p className={styles.error}>
          Минимальная сумма пополнения - {minAmount.toLocaleString()} {getSymbolFromCurrency(currency)}
        </p>
      )}
      
      {error && <p className={styles.error}>{error.message}</p>}
      
      <Button className={styles.submit} disabled={isPending} type="submit">
        Пополнить
        {isPending && <LoadingSpinner className={styles.loader} />}
      </Button>
    </form>
  );
};