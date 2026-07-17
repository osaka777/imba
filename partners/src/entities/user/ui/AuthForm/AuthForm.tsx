"use client";

import { Button } from "@/shared/UI";
import { useState } from "react";
import styles from "./AuthForm.module.css";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";

type AuthFormProps = {
    authVariant?: "login" | "register";
    className?: string;
    inModal?: boolean;
};

export const AuthForm: React.FC<AuthFormProps> = ({
    authVariant = "register",
    className,
    inModal = false,
}) => {
    const [authType, setAuthType] = useState(authVariant);

    const isRegister = authType === "register";

    const changeAuthMethod = () => setAuthType((prev) => (prev === "register" ? `login` : `register`));

    return (
        <div
            className={`${styles.AuthForm} ${inModal ? styles.AuthForm_modal : ""} ${className ?? ""}`}
            id={inModal ? "auth-modal-title" : undefined}
        >
            <h2 className={styles.heading}>{isRegister ? `Регистрация` : `Вход`}</h2>
            {isRegister ? <RegisterForm /> : <LoginForm />}
            <div className={styles.changeAuthMethod}>
                <span className={styles.changeAuthMethodText}>
                    {isRegister ? `Уже есть аккаунт?` : `Нет аккаунта?`}
                </span>
                <Button onClick={changeAuthMethod} className={styles.changeAuthMethodButton}>
                    {isRegister ? `Вход` : `Зарегистрироваться`}
                </Button>
            </div>
        </div>
    );
};
