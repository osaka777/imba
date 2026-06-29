"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Controller, useForm } from "react-hook-form";

import { safeToast } from "~/shared/lib/safeToast";
import { api } from "~/shared/api";

import { Button, Checkbox, Input } from "~/shared/ui";

import { signUp } from "../../api";
import { getPartnerTag } from "../../lib";
import styles from "./AuthForm.module.css";
import fieldStyles from "./RegistrationFields.module.css";
import { RegistrationBirthDateInput } from "./RegistrationBirthDateInput";
import { RegistrationCurrencySelect } from "./RegistrationCurrencySelect";
import { RegistrationPhoneInput } from "./RegistrationPhoneInput";
import { EmailIcon, LockIcon } from "~/shared/assets";

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
        safeToast.error("Данный Email уже используется");
        break;
      }
      case "You must be at least 18 years old": {
        safeToast.error("Регистрация доступна только с 18 лет");
        break;
      }
      case "phone must be a valid international number": {
        safeToast.error("Введите корректный номер телефона");
        break;
      }
      default: {
        safeToast.error("Ошибка при запросе регистрации, попробуйте повторить позже");
      }
    }
  };

  const { isPending, isSuccess, mutateAsync } = useMutation({
    mutationFn: (payload: AuthFormState & { tag?: string }) =>
      signUp(
        {
          email: payload.email,
          password: payload.password,
          currencyCode: payload.currencyCode,
          phone: payload.phone,
          birthDate: payload.birthDate,
          tag: payload.tag,
        },
        payload.promo,
      ),
    onError,
    onSuccess: (_data, variables) => {
      localStorage.setItem("currency", JSON.stringify(variables.currencyCode));
      window.dispatchEvent(new Event("currencyChanged"));
      safeToast.success("Регистрация успешна! Добро пожаловать!");
      window.location.href = "/";
    },
  });

  const { control, handleSubmit, register, getValues } = useForm<AuthFormState>({
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

  const onFormInvalid = () => {
    const vals = getValues();
    if (!vals.email) { safeToast.warning("Введите Email"); return; }
    if (!vals.password || vals.password.length < 8) { safeToast.warning("Введите пароль (минимум 8 символов)"); return; }
    safeToast.warning("Заполните все обязательные поля");
  };

  const onSubmit = async (data: AuthFormState) => {
    if (!data.ageConfirmed) {
      safeToast.warning("Необходимо подтвердить возраст");
      return;
    }

    if (!data.termsAccepted) {
      safeToast.warning("Необходимо подтвердить условия соглашения");
      return;
    }

    if (!data.phone || data.phone.length < 10) {
      safeToast.warning("Введите номер телефона");
      return;
    }

    if (!data.birthDate) {
      safeToast.warning("Укажите дату рождения");
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.birthDate)) {
      safeToast.warning("Введите дату в формате ДД.ММ.ГГГГ");
      return;
    }

    let tag: string | undefined;
    try {
      tag = await getPartnerTag();
    } catch {
      tag = undefined;
    }

    await mutateAsync({
      ...data,
      tag,
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
        placeholder="Пароль"
        type="password"
        variant="pill"
        {...register("password", { required: true, minLength: 8 })}
      />
      <p className={fieldStyles.hint}>Минимум 8 символов</p>

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
        {isPending || isSuccess ? `Авторизация...` : `Зарегистрироваться`}
      </Button>
    </form>
  );
};
