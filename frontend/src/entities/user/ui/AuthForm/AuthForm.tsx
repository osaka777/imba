"use client";

import clsx from "clsx";
import { useState } from "react";

import { safeToast } from "~/shared/lib/safeToast";
import { Button } from "~/shared/ui";

import {
  authenticateWithTelegram,
  type TelegramWidgetUser,
} from "../../api/telegramAuth";
import { verifyUser } from "../../api";
import styles from "./AuthForm.module.css";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";
import { TelegramAuthButton } from "./TelegramAuthButton";
import tgStyles from "./TelegramAuthButton.module.css";
import { TelegramRegisterProfileForm } from "./TelegramRegisterProfileForm";
import { useLocale } from "~/shared/model/useLocale";

type AuthFormProps = {
  authVariant?: "login" | "register";
  className?: string;
};

type AuthMode = "login" | "register" | "forgot";

export const AuthForm = ({
  authVariant = "register",
  className,
}: AuthFormProps) => {
  const [authType, setAuthType] = useState<AuthMode>(authVariant);
  const [tgLoading, setTgLoading] = useState(false);
  const [tgProfileToken, setTgProfileToken] = useState<string | null>(null);
  const [tgUser, setTgUser] = useState<TelegramWidgetUser | null>(null);
  const { t } = useLocale();

  const isRegister = authType === "register";
  const isForgot = authType === "forgot";
  const isTgProfile = Boolean(tgProfileToken && tgUser);

  const changeAuthMethod = () => {
    setTgProfileToken(null);
    setTgUser(null);
    setAuthType((prev) => (prev === "register" ? "login" : "register"));
  };

  const finishTelegramLogin = async () => {
    safeToast.success("Вход выполнен успешно!");
    try {
      const isVerified = await verifyUser();
      if (isVerified) {
        window.location.reload();
      } else {
        safeToast.warning("Вход выполнен. Обновите страницу.");
      }
    } catch {
      safeToast.warning("Вход выполнен. Обновите страницу.");
    }
  };

  const handleTelegramAuth = async (raw: Record<string, unknown>) => {
    const user = raw as TelegramWidgetUser;
    if (!user?.id || !user?.hash) {
      safeToast.error("Некорректный ответ Telegram");
      return;
    }

    setTgLoading(true);
    try {
      const mode = authType === "register" ? "register" : "login";
      const result = await authenticateWithTelegram(user, mode);
      if (result.kind === "profile") {
        setTgProfileToken(result.profileToken);
        setTgUser(user);
        return;
      }
      await finishTelegramLogin();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      safeToast.error(message || "Не удалось войти через Telegram");
    } finally {
      setTgLoading(false);
    }
  };

  return (
    <div className={clsx(styles.AuthForm, className)}>
      <h2 className={styles.heading}>
        {isForgot
          ? t("auth.resetTitle")
          : isTgProfile
            ? t("auth.tgRegisterTitle")
            : isRegister
              ? t("auth.register")
              : t("auth.login")}
      </h2>

      {isForgot ? (
        <ForgotPasswordForm onBack={() => setAuthType("login")} />
      ) : isTgProfile && tgProfileToken && tgUser ? (
        <TelegramRegisterProfileForm
          profileToken={tgProfileToken}
          telegramUser={tgUser}
          onBack={() => {
            setTgProfileToken(null);
            setTgUser(null);
          }}
        />
      ) : (
        <>
          {isRegister ? (
            <RegisterForm />
          ) : (
            <LoginForm onForgotPassword={() => setAuthType("forgot")} />
          )}

          <div className={tgStyles.divider}>{t("auth.orTelegram")}</div>
          <TelegramAuthButton disabled={tgLoading} onAuth={handleTelegramAuth} />
        </>
      )}

      {!isForgot && !isTgProfile ? (
        <div className={styles.changeAuthMethod}>
          <span className={styles.changeAuthMethodText}>
            {isRegister ? t("auth.haveAccount") : t("auth.noAccount")}
          </span>
          <Button
            className={styles.changeAuthMethodButton}
            onClick={changeAuthMethod}
          >
            {isRegister ? t("auth.signIn") : t("auth.signUp")}
          </Button>
        </div>
      ) : null}
    </div>
  );
};
