"use client";

import { AuthForm } from "@/entities/user";
import { Button, Modal } from "@/shared/UI";
import { PlusIcon } from "@/shared/assets";
import { useState } from "react";
import styles from "./Auth.module.css";

export const Auth = () => {
    const [authModalType, setAuthModalType] = useState<"register" | "login" | "closed">("closed");

    const openAuthModal = (authType: "register" | "login") => (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        setAuthModalType(authType);
    };
    const closeModal = () => setAuthModalType("closed");

    return (
        <div className={styles.Auth}>
            <Button
                onClick={openAuthModal("login")}
                className={`${styles.authButton} ${styles.authLogin}`}
            >{`Вход`}</Button>
            <Button onClick={openAuthModal("register")} className={`${styles.authButton} ${styles.authSignIn}`}>
                <span className={styles.icon_wrapper}>
                    <PlusIcon className={styles.authSignInIcon} />
                </span>
                {`Регистрация`}
            </Button>
            <Modal
                isOpen={authModalType !== "closed"}
                onClose={closeModal}
                size={authModalType === "register" ? "lg" : "sm"}
                labelledBy="auth-modal-title"
            >
                <AuthForm authVariant={authModalType as "login" | "register"} inModal />
            </Modal>
        </div>
    );
};
