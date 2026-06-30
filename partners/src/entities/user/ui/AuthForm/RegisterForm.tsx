"use client";

import { Button, Checkbox, Input, LoadingSpiner } from "@/shared/UI";
import { useEffect, useState } from "react";
import { useRegister } from "../../model";
import styles from "./AuthForm.module.css";

import * as Yup from "yup";
import {useFormik} from "formik";
import { QuestionIcon } from "@/shared/assets";
import { AffiliateProgramRegisterRequest } from "../../../../../packages/affiliate-program-api";
import TypeEnum = AffiliateProgramRegisterRequest.TypeEnum;
import { useRouter } from "next/navigation";

type AuthFormState = {
    checked: boolean;
    email: string;
    password: string;
    type: 'REVSHARE' | "CPA"
    trafficSource: string,
    telegram: string,
    phone: string,
    whatsapp: string,
};

const initialValues: AuthFormState = {
    email: '',
    password: '',
    checked: false,
    type: 'REVSHARE',
    trafficSource: '',
    telegram: '',
    phone: '',
    whatsapp: '',
};

export const RegisterForm = () => {
    const { error, pending, register, clearError } = useRegister();
    const [formError, setFormError] = useState<string>("")
    const router = useRouter();
    const [success, setSuccess] = useState(false);

    const validateSchema = Yup.object().shape({
        email: Yup.string().required("Введите почту").email("Неверный формат почты"),
        password: Yup.string()
            .required("Введите пароль")
            .min(8, "Пароль должен быть не короче 8 символов"),
        trafficSource: Yup.string().required("Введите ссылку на источник трафика"),
        checked: Yup.boolean().isTrue("Вы не согласились с условиями"),
    });

    const formik = useFormik({
        initialValues,
        validationSchema: validateSchema,
        validateOnChange: false,
        validateOnMount: false,
        validateOnBlur: false,
        onSubmit: async (values, { resetForm }) => {
            setFormError('')
            const resp = await register({
                email: values.email,
                type: values.type,
                trafficSource: values.trafficSource,
                password: values.password,
                meta: {
                    telegram: values.telegram,
                    whatsapp: values.whatsapp,
                    phone: values.phone,
                }
            })
            if(resp) {
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
            <div className={styles.type}>
                <div
                    onClick={e => formik.setFieldValue("type", 'REVSHARE')}
                    className={`${styles.type_item}  ${formik.values.type === 'REVSHARE' ? styles.type_item_active : ''}`}>
                    <div className={styles.type_check}></div>
                    <p className={styles.type_text}>
                        RevShare
                    </p>
                    <div className={styles.type_question}>
                        <QuestionIcon/>
                    </div>
                </div>
                <div onClick={e => formik.setFieldValue("type", 'CPA')}
                    className={`${styles.type_item} ${formik.values.type === 'CPA' ? styles.type_item_active : ''}`} >
                    <div className={styles.type_check}></div>
                    <p className={styles.type_text}>
                        CPA
                    </p>
                    <div className={styles.type_question}>
                        <QuestionIcon />
                    </div>
                </div>
            </div>
            <Input
                label="Почта"
                onChange={formik.handleChange}
                value={formik.values.email}
                className={styles.input}
                type="text"
                name="email"
                id="email"
                placeholder="Введите Почту"
            />
            <Input
                label="Пароль"
                onChange={formik.handleChange}
                value={formik.values.password}
                className={styles.input}
                type="password"
                name="password"
                id="password"
                placeholder="Введите пароль (минимум 8 символов)"
            />
            <Input
                label="Номер телефона (необязательно)"
                onChange={formik.handleChange}
                value={formik.values.phone}
                className={styles.input}
                type="text"
                name="phone"
                id="phone"
                placeholder="Введите номер телефона"
            />
            <Input
                label="WhatsApp (необязательно)"
                onChange={formik.handleChange}
                value={formik.values.whatsapp}
                className={styles.input}
                type="text"
                name="whatsapp"
                id="whatsapp"
                placeholder="Введите whatsapp"
            />
            <Input
                label="Telegram (необязательно)"
                onChange={formik.handleChange}
                value={formik.values.telegram}
                className={styles.input}
                type="text"
                name="telegram"
                id="telegram"
                placeholder="Введите telegram"
            />
            <Input
                label="Источник трафика"
                onChange={formik.handleChange}
                value={formik.values.trafficSource}
                className={styles.input}
                type="text"
                name="trafficSource"
                id="trafficSource"
                placeholder="Введите ссылку"
            />
            <Checkbox
                onChange={e => formik.setFieldValue("checked", e.target.checked)}
                checked={formik.values.checked}
                classNames={{ Checkbox: styles.agreement, text: styles.agreementText }}
            >{`Я согласен с Условиями и Соглашениями об использовании сайта oneX`}</Checkbox>

            <Button
                disabled={pending}
                type="submit"
                className={`${styles.authButton} ${success ? styles.authButton_succes : null}`}
            >
                {success ? `Вход` : `Зарегистрироваться`}
                {pending || success ? <LoadingSpiner className={styles.loading} /> : null}
            </Button>
            {formError !== '' ? <p className={styles.error}>{formError}</p> : null}
            {error ? <p className={styles.error}>{error}</p> : null}
        </form>
    );
};
