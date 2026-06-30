"use client";

import clsx from "clsx";
import { useState } from "react";

import { Button } from "~/shared/ui";

import styles from "./AuthForm.module.css";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";

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

  const isRegister = authType === "register";
  const isForgot = authType === "forgot";

  const changeAuthMethod = () =>
    setAuthType((prev) => (prev === "register" ? "login" : "register"));

  return (
    <div className={clsx(styles.AuthForm, className)}>
      <h2 className={styles.heading}>
        {isForgot ? "Сброс пароля" : isRegister ? "Регистрация" : "Вход"}
      </h2>

      {isForgot ? (
        <ForgotPasswordForm onBack={() => setAuthType("login")} />
      ) : isRegister ? (
        <RegisterForm />
      ) : (
        <LoginForm onForgotPassword={() => setAuthType("forgot")} />
      )}

      {!isForgot ? (
        <div className={styles.changeAuthMethod}>
          <span className={styles.changeAuthMethodText}>
            {isRegister ? "Уже есть аккаунт?" : "Нет аккаунта?"}
          </span>
          <Button
            className={styles.changeAuthMethodButton}
            onClick={changeAuthMethod}
          >
            {isRegister ? "Войти" : "Зарегистрироваться"}
          </Button>
        </div>
      ) : null}
    </div>
  );
};
