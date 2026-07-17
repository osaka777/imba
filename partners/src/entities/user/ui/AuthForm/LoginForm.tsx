"use client";

import { Button, Input, LoadingSpiner } from "@/shared/UI";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLogin } from "../../model/useLogin";
import styles from "./AuthForm.module.css";
import * as Yup from "yup";
import { useFormik } from "formik";

type AuthFormState = {
    email: string;
    password: string;
};

const initialValues: AuthFormState = {
    email: "",
    password: "",
};

export const LoginForm = ({ redirectTo = "/profile/dashboard" }: { redirectTo?: string }) => {
    const { error, login, pending, errorCode } = useLogin();
    const [success, setSuccess] = useState(false);
    const router = useRouter();
    const [formError, setFormError] = useState<string>("");

    const validateSchema = Yup.object().shape({
        email: Yup.string().required("Введите почту").email("Неверный формат почты"),
        password: Yup.string().required("Введите пароль"),
    });

    const formik = useFormik({
        initialValues,
        validationSchema: validateSchema,
        validateOnChange: false,
        validateOnMount: false,
        validateOnBlur: false,
        onSubmit: async (values) => {
            setFormError("");
            const res = await login({
                email: values.email,
                password: values.password,
            });
            if (res) {
                setSuccess(true);
                router.push(redirectTo);
            }
        },
    });

    useEffect(() => {
        if (formik.errors) {
            for (const key in formik.errors) {
                const value = formik.errors[key as keyof typeof formik.errors];
                if (value) {
                    setFormError(value.toString());
                    break;
                }
            }
        }
    }, [formik]);

    return (
        <form className={styles.form} onSubmit={formik.handleSubmit}>
            <Input
                label="Почта"
                onChange={formik.handleChange}
                value={formik.values.email}
                className={styles.input}
                type="email"
                name="email"
                id="login-email"
                placeholder="Введите почту"
                autoComplete="email"
            />
            <Input
                label="Пароль"
                onChange={formik.handleChange}
                value={formik.values.password}
                className={styles.input}
                type="password"
                name="password"
                id="login-password"
                placeholder="Введите пароль"
                autoComplete="current-password"
            />

            <Button
                type="submit"
                disabled={pending}
                className={`${styles.authButton} ${success ? styles.authButton_succes : ""}`}
            >
                Вход
                {pending || success ? <LoadingSpiner className={styles.loading} /> : null}
            </Button>
            {formError !== "" ? <p className={styles.error}>{formError}</p> : null}
            {error && errorCode !== 401 ? <p className={styles.error}>{error}</p> : null}
            {errorCode === 401 ? <p className={styles.error}>Логин или пароль введены неверно</p> : null}
        </form>
    );
};
