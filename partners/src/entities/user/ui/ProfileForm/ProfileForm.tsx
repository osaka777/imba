"use client";

import { Button, Input,  } from "@/shared/UI";
import { FC, useEffect, useState } from "react";
import { useRegister } from "../../model";
import styles from "../AuthForm/AuthForm.module.css";

import * as Yup from "yup";
import {useFormik} from "formik";
import { QuestionIcon } from "@/shared/assets";
import { AffiliateProgramRegisterRequest } from "../../../../../packages/affiliate-program-api";
import TypeEnum = AffiliateProgramRegisterRequest.TypeEnum;
import { useRouter } from "next/navigation";
import { RegisterForm } from "@/entities/user/ui/AuthForm/RegisterForm";
import { LoginForm } from "@/entities/user/ui/AuthForm/LoginForm";

import { IUser } from "@/entities/user/interface/IUser";
import { updateUserInfo } from "@/entities/user/api/updateUserInfo";

type AuthFormState = {
    telegram?: string | null,
    phone?: string | null,
    whatsapp?: string | null,
    wallet?: string | null,
    password?: string | null,
};

export const ProfileForm: FC<{onClose: () => void}> = ({onClose}) => {
    const { error, pending, register, clearError } = useRegister();
    const [formError, setFormError] = useState<string>("")
    const router = useRouter();
    const [info, setInfo] = useState<IUser>()

    useEffect(() => {
        const fetchInfo = async () => {
            try {
                const response = await fetch('/api/user');
                if (response.ok) {
                    const user = await response.json();
                    setInfo(user);
                }
            } catch (error) {
                console.error('Failed to fetch user info:', error);
            }
        }
        fetchInfo()
    }, []);

    const initialValues: AuthFormState = {
        telegram: info?.affilator.meta.telegram,
        phone: info?.affilator.meta.phone,
        whatsapp: info?.affilator.meta.whatsapp,
        wallet: info?.affilator.meta.wallet,
    };


    const formik = useFormik({
        initialValues,
        validateOnChange: false,
        validateOnMount: false,
        validateOnBlur: false,
        enableReinitialize: true,
        onSubmit: async (values, { resetForm }) => {
            updateUserInfo({
                meta: {
                    telegram: values.telegram,
                    phone: values.phone,
                    whatsapp: values.whatsapp,
                    wallet: values.wallet,
                },
                password: values.password
            })
            onClose();
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
        <div className={`${styles.AuthForm}`}>
            <h2 className={styles.heading}>{`Информация об аккаунте`}</h2>
            <form className={styles.form} onSubmit={formik.handleSubmit}>
                <Input
                    label="Номер телефона (необязательно)"
                    onChange={formik.handleChange}
                    value={formik.values.phone as string}
                    className={styles.input}
                    type="text"
                    name="phone"
                    id="phone"
                    placeholder="Введите номер телефона"
                />
                <Input
                    label="WhatsApp (необязательно)"
                    onChange={formik.handleChange}
                    value={formik.values.whatsapp as string}
                    className={styles.input}
                    type="text"
                    name="whatsapp"
                    id="whatsapp"
                    placeholder="Введите whatsapp"
                />
                <Input
                    label="Telegram (необязательно)"
                    onChange={formik.handleChange}
                    value={formik.values.telegram as string}
                    className={styles.input}
                    type="text"
                    name="telegram"
                    id="telegram"
                    placeholder="Введите telegram"
                />
                <Input
                    label="Кошелек USDT (TRC-20)"
                    onChange={formik.handleChange}
                    value={formik.values.wallet as string}
                    className={styles.input}
                    type="text"
                    name="wallet"
                    id="wallet"
                    placeholder="Введите кошелек"
                />
                <Input
                    label="Ваш новый пароль"
                    onChange={formik.handleChange}
                    value={formik.values.password as string}
                    className={styles.input}
                    type="password"
                    name="password"
                    id="password"
                    placeholder="Введите ваш новый пароль"
                />
                <Input
                    label="Реф ссылка"
                    value={"https://imbabk.xyz/?tag=" + info?.affilator.uid + "&auth=register"}
                    className={styles.input}
                    type="text"
                />
                <Input
                    label="Реф ссылка (для реф-ов)"
                    value={"https://imbabk.xyz/?tag=" + info?.affilator.uid + "&auth=register"}
                    className={styles.input}
                    type="text"
                />
                <Input
                    label="UID"
                    value={info?.affilator.uid}
                    className={styles.input}
                    type="text"
                />
                <Button
                    disabled={pending}
                    type="submit"
                    className={`${styles.authButton} ${styles.authButton_succes}`}
                >
                    Сохранить
                </Button>
                {formError !== '' ? <p className={styles.error}>{formError}</p> : null}
                {error ? <p className={styles.error}>{`Произошла ошибка, попробуйте позже`}</p> : null}
            </form>
        </div>
    );
};
