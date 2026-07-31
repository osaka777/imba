"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";

import { safeToast } from "~/shared/lib/safeToast";
import { api } from "~/shared/api";
import { Button, Checkbox } from "~/shared/ui";
import { useLocale } from "~/shared/model/useLocale";

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
  const { t } = useLocale();
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
      currencyCode: "USDT",
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
      safeToast.success(t("auth.tgRegisterSuccess"));
      window.location.reload();
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("21") || message.includes("18")) {
        safeToast.error(t("auth.errorUnderage"));
        return;
      }
      safeToast.error(message || t("auth.tgRegisterFailed"));
    },
  });

  const onSubmit = async (data: ProfileFormState) => {
    if (!data.ageConfirmed) {
      safeToast.warning(t("auth.warnConfirmAge"));
      return;
    }
    if (!data.termsAccepted) {
      safeToast.warning(t("auth.warnConfirmTerms"));
      return;
    }
    if (!data.birthDate) {
      safeToast.warning(t("auth.warnEnterBirthDate"));
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
        {t("auth.tgProfileHint", { name: displayName })}
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
              {t("auth.ageConfirm21")}
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
              {t("auth.acceptRules")}
            </Checkbox>
          )}
        />
      </div>

      <Button className={styles.authButton} disabled={isPending} type="submit">
        {isPending ? t("auth.creatingAccount") : t("auth.completeRegistration")}
      </Button>
      <button className={styles.forgotBackLink} onClick={onBack} type="button">
        {t("auth.back")}
      </button>
    </form>
  );
}
