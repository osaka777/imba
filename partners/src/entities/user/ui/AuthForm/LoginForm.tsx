"use client";

import { Button, Input, LoadingSpiner } from "@/shared/UI";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
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

export const LoginForm = () => {
    const { clearError, error, login, pending, errorCode } = useLogin();
    const [success, setSuccess] = useState(false);
    const router = useRouter();
    const [formError, setFormError] = useState<string>("")

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
        onSubmit: async (values, { resetForm }) => {
            setFormError('')
            const res = await login({
                email: values.email,
                password: values.password
            });
            if (res) {
                setSuccess(true);
                router.push("/profile/dashboard");
            }
        },
    });

    useEffect(() => {
        if(formik.errors) {
            for(let key in formik.errors) {
                const value = formik.errors[key as keyof typeof formik.errors]
                if(value) {
                    setFormError(value.toString())
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
                type="text"
                name="email"
                id="email"
                placeholder="Введите почту"
            />
            <Input
                label="Пароль"
                onChange={formik.handleChange}
                value={formik.values.password}
                className={styles.input}
                type="password"
                name="password"
                id="password"
                placeholder="Введите пароль"
            />

            <Button
                type="submit"
                disabled={pending}
                className={`${styles.authButton} ${success ? styles.authButton_succes : null}`}
            >
                Вход
                {pending || success ? <LoadingSpiner className={styles.loading} /> : null}
            </Button>
            {formError !== '' ? <p className={styles.error}>{formError}</p> : null}
            {error && errorCode !== 401 ? <p className={styles.error}>{error}</p> : null}
            {errorCode === 401 ? <p className={styles.error}>{`Логин или пароль введены не верно`}</p> : null}
        </form>
    );
};
