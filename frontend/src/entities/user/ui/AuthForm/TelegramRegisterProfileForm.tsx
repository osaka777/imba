"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";

import { safeToast } from "~/shared/lib/safeToast";
import { api } from "~/shared/api";
import { Button, Checkbox } from "~/shared/ui";

import {
  completeTelegramProfile,
  type TelegramWidgetUser,
} from "../../api/telegramAuth";
import { getPartnerTag } from "../../lib";
import { getAffiliateSubs } from "../../lib/getAffiliateSubs";
import { hasAffiliateSubs } from "../../lib/affiliateSubs";
import styles from "./AuthForm.module.css";
import fieldStyles from "./RegistrationFields.module.css";
import { RegistrationBirthDateInput } from "./RegistrationBirthDateInput";
import { RegistrationCurrencySelect } from "./RegistrationCurrencySelect";

type CurrencyOption = {
  isoCode: string;
  name: string;
};

type ProfileFormState = {
  ageConfirmed: boolean;
  birthDate: string;
  currencyCode: string;
  termsAccepted: boolean;
};

type TelegramRegisterProfileFormProps = {
  profileToken: string;
  telegramUser: TelegramWidgetUser;
  onBack: () => void;
};

export function TelegramRegisterProfileForm({
  profileToken,
  telegramUser,
  onBack,
}: TelegramRegisterProfileFormProps) {
  const { data: currencies = [] } = useQuery<CurrencyOption[]>({
    queryKey: ["currencies"],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/currencies");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { control, handleSubmit } = useForm<ProfileFormState>({
    defaultValues: {
      ageConfirmed: true,
      birthDate: "",
      currencyCode: "KZT",
      termsAccepted: true,
    },
  });

  const { isPending, mutateAsync } = useMutation({
    mutationFn: async (data: ProfileFormState) => {
      let tag: string | undefined;
      try {
        tag = await getPartnerTag();
      } catch {
        tag = undefined;
      }

      const rawSubs = await getAffiliateSubs();
      const subs = hasAffiliateSubs(rawSubs) ? rawSubs : undefined;

      await completeTelegramProfile({
        profileToken,
        currencyCode: data.currencyCode,
        birthDate: data.birthDate,
        tag,
        subs,
      });
    },
    onSuccess: (_data, variables) => {
      localStorage.setItem("currency", JSON.stringify(variables.currencyCode));
      window.dispatchEvent(new Event("currencyChanged"));
      safeToast.success("Регистрация через Telegram успешна!");
      window.location.reload();
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("18")) {
        safeToast.error("Регистрация доступна только с 18 лет");
        return;
      }
      safeToast.error(message || "Не удалось завершить регистрацию");
    },
  });

  const onSubmit = async (data: ProfileFormState) => {
    if (!data.ageConfirmed) {
      safeToast.warning("Необходимо подтвердить возраст");
      return;
    }
    if (!data.termsAccepted) {
      safeToast.warning("Необходимо подтвердить условия соглашения");
      return;
    }
    if (!data.birthDate) {
      safeToast.warning("Укажите дату рождения");
      return;
    }
    await mutateAsync(data);
  };

  const displayName = telegramUser.username
    ? `@${telegramUser.username}`
    : telegramUser.first_name;

  return (
    <form
      className={fieldStyles.scope}
      onSubmit={handleSubmit(onSubmit)}
    >
      <p className={styles.forgotHint}>
        Telegram: {displayName}. Укажите валюту и дату рождения для завершения регистрации.
      </p>

      <Controller
        control={control}
        name="currencyCode"
        render={({ field }) => (
          <RegistrationCurrencySelect
            currencies={currencies}
            onBlur={field.onBlur}
            onChange={field.onChange}
            value={field.value}
          />
        )}
      />

      <Controller
        control={control}
        name="birthDate"
        render={({ field }) => (
          <RegistrationBirthDateInput
            onBlur={field.onBlur}
            onChange={field.onChange}
            value={field.value}
          />
        )}
      />

      <div className={styles.checkboxes}>
        <Controller
          control={control}
          name="ageConfirmed"
          render={({ field: { value: checked, ...field } }) => (
            <Checkbox
              checked={checked}
              classNames={{
                Checkbox: styles.authCheckbox,
                icon: styles.authCheckboxIcon,
                iconBox: styles.authCheckboxBox,
                iconBox_checked: styles.authCheckboxBox_checked,
                text: styles.checkboxText,
              }}
              {...field}
            >
              Мне исполнилось 18 лет
            </Checkbox>
          )}
        />
        <Controller
          control={control}
          name="termsAccepted"
          render={({ field: { value: checked, ...field } }) => (
            <Checkbox
              checked={checked}
              classNames={{
                Checkbox: styles.authCheckbox,
                icon: styles.authCheckboxIcon,
                iconBox: styles.authCheckboxBox,
                iconBox_checked: styles.authCheckboxBox_checked,
                text: styles.checkboxText,
              }}
              {...field}
            >
              Принимаю правила imba.bet
            </Checkbox>
          )}
        />
      </div>

      <Button className={styles.authButton} disabled={isPending} type="submit">
        {isPending ? "Создание аккаунта..." : "Завершить регистрацию"}
      </Button>
      <button className={styles.forgotBackLink} onClick={onBack} type="button">
        Назад
      </button>
    </form>
  );
}
