"use client";

import { useMutation } from "@tanstack/react-query";
import clsx from "clsx";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button, Input } from "~/shared/ui";
import { safeToast } from "~/shared/lib/safeToast";

import { verifyUser, login, verifyTelegram2fa } from "../../api";
import styles from "./AuthForm.module.css";
import { EmailIcon, LockIcon } from "~/shared/assets";

type AuthFormState = {
  email: string;
  password: string;
};

export const LoginForm = ({ onForgotPassword }: { onForgotPassword?: () => void }) => {
  const [twoFaToken, setTwoFaToken] = useState<string | null>(null);
  const [twoFaCode, setTwoFaCode] = useState("");

  const onError = (error: unknown) => {
    console.error("Login error:", error);
    const message = error instanceof Error ? error.message : "";
    if (message.toLowerCase().includes("password") || message.toLowerCase().includes("unauthorized")) {
      safeToast.error("Неверная почта или пароль");
      return;
    }
    if (message.toLowerCase().includes("2fa") || message.toLowerCase().includes("code")) {
      safeToast.error("Неверный код из Telegram");
      return;
    }
    safeToast.error("Ошибка при запросе входа, попробуйте повторить позже");
  };

  const finishLogin = async () => {
    safeToast.success("Вход выполнен успешно!");
    try {
      const isVerified = await verifyUser();
      if (isVerified) {
        window.location.reload();
      } else {
        safeToast.warning("Вход выполнен, но проверка не прошла. Обновите страницу.");
      }
    } catch {
      safeToast.warning("Вход выполнен, но возникла ошибка проверки. Обновите страницу.");
    }
  };

  const { handleSubmit, register } = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const { isPending, isSuccess, mutateAsync } = useMutation({
    mutationFn: login,
    onError,
    onSuccess: async (result) => {
      if (result.kind === "2fa") {
        setTwoFaToken(result.twoFaToken);
        safeToast.info("Введите код из Telegram");
        return;
      }
      await finishLogin();
    },
  });

  const { isPending: verifying2fa, mutateAsync: submit2fa } = useMutation({
    mutationFn: verifyTelegram2fa,
    onError,
    onSuccess: finishLogin,
  });

  const onSubmit = async (data: AuthFormState) => {
    await mutateAsync(data);
  };

  if (twoFaToken) {
    return (
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          void submit2fa({ twoFaToken, code: twoFaCode.trim() });
        }}
      >
        <p style={{ margin: 0, fontSize: 14, opacity: 0.85 }}>
          Код отправлен в Telegram. Действует 5 минут.
        </p>
        <Input
          className={styles.input}
          placeholder="Код из Telegram"
          type="text"
          inputMode="numeric"
          variant="pill"
          value={twoFaCode}
          onChange={(e) => setTwoFaCode(e.target.value)}
        />
        <Button className={styles.authButton} disabled={verifying2fa || twoFaCode.trim().length < 4} type="submit">
          {verifying2fa ? "Проверка..." : "Подтвердить"}
        </Button>
        <button className={styles.forgotBackLink} type="button" onClick={() => { setTwoFaToken(null); setTwoFaCode(""); }}>
          Назад
        </button>
      </form>
    );
  }

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
      {onForgotPassword ? (
        <button className={styles.forgotBackLink} type="button" onClick={onForgotPassword}>
          Забыли пароль?
        </button>
      ) : null}
      <Button
        className={clsx(styles.authButton, isSuccess && styles.authButton_success)}
        disabled={isPending || isSuccess}
        type="submit"
      >
        {isPending || isSuccess ? "Авторизация..." : "Войти"}
      </Button>
    </form>
  );
};
