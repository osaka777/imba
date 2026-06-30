"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { resetPassword } from "~/entities/user/api/telegram";
import { safeToast } from "~/shared/lib/safeToast";
import { Button } from "~/shared/ui";

import styles from "./reset-password.module.css";

function ResetPasswordForm() {
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
      safeToast.error("Ссылка недействительна");
      return;
    }
    if (password.length < 8) {
      safeToast.error("Пароль должен быть не короче 8 символов");
      return;
    }
    if (password !== confirm) {
      safeToast.error("Пароли не совпадают");
      return;
    }

    setIsPending(true);
    try {
      await resetPassword(token, password);
      setDone(true);
      safeToast.success("Пароль обновлён");
    } catch {
      safeToast.error("Ссылка устарела или недействительна");
    } finally {
      setIsPending(false);
    }
  };

  if (!token) {
    return (
      <div className={styles.card}>
        <h1 className={styles.title}>Сброс пароля</h1>
        <p className={styles.text}>Ссылка недействительна. Запросите новую на странице входа.</p>
        <Button type="button" onClick={() => router.push("/?auth=login")}>
          Перейти ко входу
        </Button>
      </div>
    );
  }

  if (done) {
    return (
      <div className={styles.card}>
        <h1 className={styles.title}>Готово</h1>
        <p className={styles.text}>Пароль изменён. Теперь можно войти с новым паролем.</p>
        <Button type="button" onClick={() => router.push("/?auth=login")}>
          Войти
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <h1 className={styles.title}>Новый пароль</h1>
      <p className={styles.text}>Придумайте новый пароль для аккаунта imba.bet.</p>
      <form className={styles.form} onSubmit={onSubmit}>
        <input
          className={styles.input}
          type="password"
          placeholder="Новый пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
        <input
          className={styles.input}
          type="password"
          placeholder="Повторите пароль"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
        />
        <Button disabled={isPending} type="submit">
          {isPending ? "Сохранение..." : "Сохранить пароль"}
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className={styles.page}>
      <Suspense fallback={<div className={styles.card}>Загрузка...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
