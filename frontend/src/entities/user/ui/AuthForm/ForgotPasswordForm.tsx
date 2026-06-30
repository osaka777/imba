"use client";

import clsx from "clsx";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { requestPasswordReset } from "~/entities/user/api/telegram";
import { EmailIcon } from "~/shared/assets";
import { safeToast } from "~/shared/lib/safeToast";
import { Button, Input } from "~/shared/ui";

import styles from "./AuthForm.module.css";

type ForgotPasswordFormProps = {
  onBack: () => void;
};

type FormState = {
  email: string;
};

export function ForgotPasswordForm({ onBack }: ForgotPasswordFormProps) {
  const [isPending, setIsPending] = useState(false);
  const [sentChannel, setSentChannel] = useState<"telegram" | "none" | null>(null);
  const { handleSubmit, register } = useForm<FormState>({
    defaultValues: { email: "" },
  });

  const onSubmit = async (data: FormState) => {
    setIsPending(true);
    try {
      const result = await requestPasswordReset(data.email.trim());
      setSentChannel(result.channel);
      if (result.channel === "telegram") {
        safeToast.success("Ссылка для сброса отправлена в Telegram");
      } else {
        safeToast.info("Проверьте email или привяжите Telegram в настройках профиля");
      }
    } catch {
      safeToast.error("Не удалось отправить запрос. Попробуйте позже.");
    } finally {
      setIsPending(false);
    }
  };

  if (sentChannel) {
    return (
      <div className={styles.form}>
        <p className={styles.forgotHint}>
          {sentChannel === "telegram"
            ? "Мы отправили ссылку для сброса пароля в ваш Telegram. Ссылка действует 30 минут."
            : "Если аккаунт существует, но Telegram не привязан — войдите в аккаунт и привяжите бота в настройках профиля, затем повторите запрос."}
        </p>
        <Button className={styles.authButton} type="button" onClick={onBack}>
          Вернуться ко входу
        </Button>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
      <p className={styles.forgotHint}>
        Укажите email аккаунта. Ссылка для сброса придёт в Telegram, если он привязан в настройках профиля.
      </p>
      <Input
        className={styles.input}
        icon={<EmailIcon className={styles.fieldIcon} />}
        placeholder="Email"
        type="email"
        variant="pill"
        {...register("email", { required: true })}
      />
      <Button className={clsx(styles.authButton)} disabled={isPending} type="submit">
        {isPending ? "Отправка..." : "Отправить ссылку"}
      </Button>
      <button className={styles.forgotBackLink} type="button" onClick={onBack}>
        ← Назад ко входу
      </button>
    </form>
  );
}
