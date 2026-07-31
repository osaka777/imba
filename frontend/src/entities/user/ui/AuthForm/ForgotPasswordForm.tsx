"use client";

import clsx from "clsx";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { requestPasswordReset } from "~/entities/user/api/telegram";
import { EmailIcon } from "~/shared/assets";
import { safeToast } from "~/shared/lib/safeToast";
import { useLocale } from "~/shared/model/useLocale";
import { Button, Input } from "~/shared/ui";

import styles from "./AuthForm.module.css";

type ForgotPasswordFormProps = {
  onBack: () => void;
};

type FormState = {
  email: string;
};

export function ForgotPasswordForm({ onBack }: ForgotPasswordFormProps) {
  const { t } = useLocale();
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
        safeToast.success(t("auth.forgotSentTg"));
      } else {
        safeToast.info(t("auth.forgotCheckEmailOrTg"));
      }
    } catch {
      safeToast.error(t("auth.forgotSendFailed"));
    } finally {
      setIsPending(false);
    }
  };

  if (sentChannel) {
    return (
      <div className={styles.form}>
        <p className={styles.forgotHint}>
          {sentChannel === "telegram"
            ? t("auth.forgotSentTgBody")
            : t("auth.forgotNoTgBody")}
        </p>
        <Button className={styles.authButton} type="button" onClick={onBack}>
          {t("auth.forgotBackLogin")}
        </Button>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
      <p className={styles.forgotHint}>{t("auth.forgotHint")}</p>
      <Input
        className={styles.input}
        icon={<EmailIcon className={styles.fieldIcon} />}
        placeholder="Email"
        type="email"
        variant="pill"
        {...register("email", { required: true })}
      />
      <Button className={clsx(styles.authButton)} disabled={isPending} type="submit">
        {isPending ? t("auth.forgotSending") : t("auth.forgotSendLink")}
      </Button>
      <button className={styles.forgotBackLink} type="button" onClick={onBack}>
        {t("auth.forgotBackArrow")}
      </button>
    </form>
  );
}
