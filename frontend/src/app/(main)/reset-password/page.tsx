"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { resetPassword } from "~/entities/user/api/telegram";
import { safeToast } from "~/shared/lib/safeToast";
import { useLocale } from "~/shared/model/useLocale";
import { Button } from "~/shared/ui";

import styles from "./reset-password.module.css";

function ResetPasswordForm() {
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) {
      safeToast.error(t("auth.resetInvalidLink"));
      return;
    }
    if (!password) {
      safeToast.error(t("auth.warnEnterPassword"));
      return;
    }
    if (password !== confirm) {
      safeToast.error(t("auth.errorPasswordMismatch"));
      return;
    }

    setIsPending(true);
    try {
      await resetPassword(token, password);
      setDone(true);
      safeToast.success(t("auth.successPasswordUpdated"));
    } catch {
      safeToast.error(t("auth.resetLinkExpired"));
    } finally {
      setIsPending(false);
    }
  };

  if (!token) {
    return (
      <div className={styles.card}>
        <h1 className={styles.title}>{t("auth.resetTitle")}</h1>
        <p className={styles.text}>{t("auth.resetInvalidBody")}</p>
        <Button type="button" onClick={() => router.push("/?auth=login")}>
          {t("auth.goToLogin")}
        </Button>
      </div>
    );
  }

  if (done) {
    return (
      <div className={styles.card}>
        <h1 className={styles.title}>{t("auth.resetDoneTitle")}</h1>
        <p className={styles.text}>{t("auth.resetDoneBody")}</p>
        <Button type="button" onClick={() => router.push("/?auth=login")}>
          {t("auth.signIn")}
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <h1 className={styles.title}>{t("auth.newPasswordTitle")}</h1>
      <p className={styles.text}>{t("auth.newPasswordHint")}</p>
      <form className={styles.form} onSubmit={onSubmit}>
        <input
          className={styles.input}
          type="password"
          placeholder={t("auth.newPasswordPlaceholder")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
        <input
          className={styles.input}
          type="password"
          placeholder={t("auth.confirmPasswordPlaceholder")}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
        />
        <Button disabled={isPending} type="submit">
          {isPending ? t("auth.savingPassword") : t("auth.savePassword")}
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  const { t } = useLocale();
  return (
    <div className={styles.page}>
      <Suspense fallback={<div className={styles.card}>{t("auth.loading")}</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
