"use client";

import clsx from "clsx";
import { useState } from "react";

import { Button } from "~/shared/ui";

import styles from "./AuthForm.module.css";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";

type AuthFormProps = {
  authVariant?: "login" | "register";
  className?: string;
};

export const AuthForm = ({
  authVariant = "register",
  className,
}: AuthFormProps) => {
  const [authType, setAuthType] = useState(authVariant);

  const isRegister = authType === "register";

  const changeAuthMethod = () =>
    setAuthType((prev) => (prev === "register" ? `login` : `register`));

  return (
    <div className={clsx(styles.AuthForm, className)}>
      <h2 className={styles.heading}>{isRegister ? `Регистрация` : `Вход`}</h2>

      {isRegister ? <RegisterForm /> : <LoginForm />}

      <div className={styles.changeAuthMethod}>
        <span className={styles.changeAuthMethodText}>
          {isRegister ? `Уже есть аккаунт?` : `Нет аккаунта?`}
        </span>
        <Button
          className={styles.changeAuthMethodButton}
          onClick={changeAuthMethod}
        >
          {isRegister ? `Войти` : `Зарегистрироваться`}
        </Button>
      </div>
    </div>
  );
};
