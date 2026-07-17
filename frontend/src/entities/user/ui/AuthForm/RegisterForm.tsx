"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";

import { safeToast } from "~/shared/lib/safeToast";
import { api } from "~/shared/api";

import { Button, Checkbox, Input } from "~/shared/ui";

import { signUp, type SignUpBody } from "../../api";
import { getPartnerTag } from "../../lib";
import { getAffiliateSubs } from "../../lib/getAffiliateSubs";
import { hasAffiliateSubs } from "../../lib/affiliateSubs";
import styles from "./AuthForm.module.css";
import fieldStyles from "./RegistrationFields.module.css";
import { RegistrationBirthDateInput } from "./RegistrationBirthDateInput";
import { RegistrationCurrencySelect } from "./RegistrationCurrencySelect";
import { RegistrationPhoneInput } from "./RegistrationPhoneInput";
import { EmailIcon, LockIcon } from "~/shared/assets";
import { useLocale } from "~/shared/model/useLocale";

type CurrencyOption = {
  isoCode: string;
  name: string;
};

type AuthFormState = {
  ageConfirmed: boolean;
  birthDate: string;
  currencyCode: string;
  email: string;
  password: string;
  phone: string;
  promo?: string;
  termsAccepted: boolean;
};

export const RegisterForm = () => {
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

  const onError = (error: any) => {
    const message = Array.isArray(error?.message)
      ? error.message[0]
      : typeof error?.message === "string"
        ? error.message
        : "";

    switch (message) {
      case "email is already taken": {
        safeToast.error(t("auth.errorEmailTaken"));
        break;
      }
      case "You must be at least 18 years old": {
        safeToast.error(t("auth.errorUnderage"));
        break;
      }
      case "phone must be a valid international number": {
        safeToast.error(t("auth.errorInvalidPhone"));
        break;
      }
      default: {
        safeToast.error(t("auth.errorRegisterRequest"));
      }
    }
  };

  const searchParams = useSearchParams();

  const { isPending, isSuccess, mutateAsync } = useMutation({
    mutationFn: (payload: AuthFormState & { tag?: string; promoCode?: string; subs?: SignUpBody["subs"] }) =>
      signUp({
        email: payload.email,
        password: payload.password,
        currencyCode: payload.currencyCode,
        phone: payload.phone,
        birthDate: payload.birthDate,
        tag: payload.tag,
        promoCode: payload.promo?.trim() || undefined,
        subs: payload.subs,
      }),
    onError,
    onSuccess: (_data, variables) => {
      localStorage.setItem("currency", JSON.stringify(variables.currencyCode));
      window.dispatchEvent(new Event("currencyChanged"));
      safeToast.success(t("auth.successRegister"));
      window.location.href = "/profile/settings?connectTelegram=1";
    },
  });

  const { control, handleSubmit, register, getValues, setValue } = useForm<AuthFormState>({
    defaultValues: {
      ageConfirmed: true,
      birthDate: "",
      currencyCode: "KZT",
      email: "",
      password: "",
      phone: "",
      promo: "",
      termsAccepted: true,
    },
  });

  useEffect(() => {
    const fromUrl = searchParams.get("promo");
    if (fromUrl) {
      setValue("promo", fromUrl.toUpperCase());
      return;
    }
    const match = document.cookie.match(/(?:^|;\s*)promoCode=([^;]+)/);
    if (match?.[1]) {
      setValue("promo", decodeURIComponent(match[1]));
    }
  }, [searchParams, setValue]);

  const onFormInvalid = () => {
    const vals = getValues();
    if (!vals.email) { safeToast.warning(t("auth.warnEnterEmail")); return; }
    if (!vals.password) { safeToast.warning(t("auth.warnEnterPassword")); return; }
    safeToast.warning(t("auth.warnFillRequired"));
  };

  const onSubmit = async (data: AuthFormState) => {
    if (!data.ageConfirmed) {
      safeToast.warning(t("auth.warnConfirmAge"));
      return;
    }

    if (!data.termsAccepted) {
      safeToast.warning(t("auth.warnConfirmTerms"));
      return;
    }

    if (!data.phone || data.phone.length < 10) {
      safeToast.warning(t("auth.warnEnterPhone"));
      return;
    }

    if (!data.birthDate) {
      safeToast.warning(t("auth.warnEnterBirthDate"));
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.birthDate)) {
      safeToast.warning(t("auth.warnBirthDateFormat"));
      return;
    }

    let tag: string | undefined;
    let subs: SignUpBody["subs"];
    try {
      tag = await getPartnerTag();
      const rawSubs = await getAffiliateSubs();
      subs = hasAffiliateSubs(rawSubs) ? rawSubs : undefined;
    } catch {
      tag = undefined;
      subs = undefined;
    }

    await mutateAsync({
      ...data,
      tag,
      subs,
    });
  };

  return (
    <form className={clsx(styles.form, fieldStyles.scope)} onSubmit={handleSubmit(onSubmit, onFormInvalid)}>
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

      <Controller
        control={control}
        name="phone"
        render={({ field }) => (
          <RegistrationPhoneInput
            onBlur={field.onBlur}
            onChange={field.onChange}
            value={field.value}
          />
        )}
      />

      <Input
        className={styles.input}
        icon={<EmailIcon className={styles.fieldIcon} />}
        placeholder="Email"
        type="email"
        variant="pill"
        {...register("email", { required: true })}
      />
      <Input
        className={styles.input}
        icon={<LockIcon className={styles.fieldIcon} />}
        placeholder={t("auth.password")}
        type="password"
        variant="pill"
        {...register("password", { required: true })}
      />

      <Input
        className={styles.input}
        placeholder={t("auth.promoOptional")}
        type="text"
        variant="pill"
        {...register("promo")}
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
              Я подтверждаю, что мой возраст соответствует закону об участии в
              азартных играх или превышает 18 лет
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
              Подтверждаю, что мною прочитаны и приняты{" "}
              <a
                className={styles.checkboxLink}
                href="/info"
                onClick={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
                rel="noopener noreferrer"
                target="_blank"
              >
                Общие положения и условия
              </a>
              ,{" "}
              <a
                className={styles.checkboxLink}
                href="/info"
                onClick={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
                rel="noopener noreferrer"
                target="_blank"
              >
                Политика конфиденциальности
              </a>{" "}
              и другие применимые правила
            </Checkbox>
          )}
        />
      </div>

      <Button
        className={clsx(
          styles.authButton,
          isSuccess && styles.authButton_success,
        )}
        disabled={isPending || isSuccess}
        type="submit"
      >
        {isPending || isSuccess ? t("auth.signingIn") : t("auth.signUp")}
      </Button>
    </form>
  );
};
