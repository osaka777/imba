"use client";

import { useMutation } from "@tanstack/react-query";
import clsx from "clsx";
import { Controller, useForm } from "react-hook-form";

import { safeToast } from "~/shared/lib/safeToast";

import { Button, Checkbox, Input } from "~/shared/ui";

import { signUp } from "../../api";
import { getPartnerTag } from "../../lib";
import styles from "./AuthForm.module.css";
import { EmailIcon, LockIcon } from "~/shared/assets";

type AuthFormState = {
  ageConfirmed: boolean;
  email: string;
  password: string;
  promo?: string;
  termsAccepted: boolean;
};

export const RegisterForm = () => {
  const onError = (error: any) => {
    switch (error.message[0]) {
      case "email is already taken": {
        safeToast.error("Данный Email уже используется");
        break;
      }
      default: {
        safeToast.error("Ошибка при запросе регистрации, попробуйте повторить позже");
      }
    }
  };
  const { isPending, isSuccess, mutateAsync } = useMutation({
    mutationFn: ({
      email,
      password,
      promo,
      tag,
    }: {
      email: string;
      password?: string;
      promo?: string;
      tag?: string;
    }) => signUp({ email, password, tag }, promo),
    onError,
    onSuccess: () => {
      safeToast.success("Регистрация успешна! Добро пожаловать!");
      // Перенаправляем на главную страницу или обновляем состояние
      window.location.href = "/";
    },
  });

  const { control, handleSubmit, register } = useForm({
    defaultValues: {
      ageConfirmed: true,
      email: "",
      password: "",
      promo: "",
      termsAccepted: true,
    },
  });

  const onSubmit = async (data: AuthFormState) => {
    if (!data.ageConfirmed) {
      safeToast.warning("Необходимо подтвердить возраст");
      return;
    }

    if (!data.termsAccepted) {
      safeToast.warning("Необходимо подтвердить условия соглашения");
      return;
    }

    const tag = await getPartnerTag();

    await mutateAsync({
      email: data.email,
      password: data.password,
      promo: data.promo,
      tag,
    });
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
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
        {...register("password", { required: true })}
      />
      {/* <Input
        className={styles.input}
        label="Промокод"
        placeholder="Введите промокод"
        type="text"
        {...register("promo", { required: false })}
      /> */}
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
          rules={{ required: true }}
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
          rules={{ required: true }}
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
