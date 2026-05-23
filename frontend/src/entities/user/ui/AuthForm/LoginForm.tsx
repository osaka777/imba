"use client";

import { useMutation } from "@tanstack/react-query";
import clsx from "clsx";
import { useRouter } from "next-nprogress-bar";
import { useForm } from "react-hook-form";

import { Button, Input, LoadingSpinner } from "~/shared/ui";
import { safeToast } from "~/shared/lib/safeToast";

import { verifyUser, login } from "../../api";
import styles from "./AuthForm.module.css";
import { EmailIcon, LockIcon } from "~/shared/assets";

type AuthFormState = {
  email: string;
  password: string;
};

export const LoginForm = () => {
  const onError = (error: any) => {
    console.error('Login error:', error);
    switch (error?.message) {
      case "wrong email or password": {
        safeToast.error("Неверная почта или пароль");
        break;
      }
      default: {
        safeToast.error("Ошибка при запросе входа, попробуйте повторить позже");
      }
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
    onSuccess: async () => {
      // Если onSuccess вызван, значит вход успешен
      console.debug('LoginForm: Login successful, checking verification...');
      safeToast.success("Вход выполнен успешно!");
      
      // Проверяем, что пользователь действительно аутентифицирован
      try {
        const isVerified = await verifyUser();
        console.debug('LoginForm: User verification result:', isVerified);
        if (isVerified) {
          console.debug('LoginForm: User verified, reloading page...');
          window.location.reload();
        } else {
          console.error('LoginForm: User verification failed');
          safeToast.warning("Вход выполнен, но проверка не прошла. Попробуйте обновить страницу.");
        }
      } catch (verifyError) {
        console.error('LoginForm: Error during verification:', verifyError);
        safeToast.warning("Вход выполнен, но возникла ошибка проверки. Попробуйте обновить страницу.");
      }
    },
  });

  const router = useRouter();
  const onSubmit = async (data: AuthFormState) => {
    console.debug('LoginForm: Submitting login form...');
    await mutateAsync(data);
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
      <Button
        className={clsx(
          styles.authButton,
          isSuccess && styles.authButton_success,
        )}
        disabled={isPending}
        type="submit"
      >
        {isSuccess ? `Вход выполнен...` : `Войти`}
        {(isPending || isSuccess) && (
          <LoadingSpinner className={styles.loading} />
        )}
      </Button>
    </form>
  );
};
