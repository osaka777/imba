"use client";

import { useState, useEffect } from "react";
import styles from "./UserSettings.module.css";
import { toast } from "react-toastify";
import { changePassword as changePasswordApi } from "~/entities/user/api/changePassword";
import { SignOut } from "../Profile/SignOut";
interface UserData {
    id: number;
    email: string;
}

export const UserSettings = ({ userData }: { userData: UserData }) => {
    const [showPasswordChange, setShowPasswordChange] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [hideBalance, setHideBalance] = useState(false);

    useEffect(() => {
        if (typeof window !== "undefined") {
            setHideBalance(localStorage.getItem("hideBalance") === "true");
        }
        const handler = () => {
            setHideBalance(localStorage.getItem("hideBalance") === "true");
        };
        window.addEventListener("hideBalanceChanged", handler);
        return () => window.removeEventListener("hideBalanceChanged", handler);
    }, []);

    const handleHideBalanceChange = () => {
        const newValue = !hideBalance;
        setHideBalance(newValue);
        if (typeof window !== "undefined") {
            localStorage.setItem("hideBalance", newValue.toString());
            window.dispatchEvent(new Event("hideBalanceChanged"));
        }
    };

    const changePasswordFunc = async () => {
        if (newPassword !== confirmPassword) {
            toast.error("Пароли не совпадают");
            return;
        }

        if (newPassword.length < 6) {
            toast.error("Новый пароль должен содержать не менее 6 символов");
            return;
        }

        setIsSaving(true);
        try {
            await changePasswordApi({
                newPassword,
                oldPassword: currentPassword,
            });

            toast.success("Пароль успешно изменен");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setShowPasswordChange(false);
        } catch (error) {
            console.error("Ошибка при смене пароля:", error);
            toast.error("Не удалось изменить пароль");
        } finally {
            setIsSaving(false);
        }
    };


    return (
        <div className={styles.UserSettingsFormContainer}>
            <div className={styles.UserSettingsHeader}>Редактировать профиль</div>
            <form className={styles.UserSettingsForm}>
                <div className={styles.UserSettingsField}>
                    <div className={styles.UserSettingsValue}>
                        <span className={styles.UserSettingsValueText}>{userData?.email}</span>
                        <span className={styles.UserSettingsVerified}></span>
                    </div>

                </div>

                <div className={styles.UserSettingsPasswordRow}>
                    <button
                        className={styles.UserSettingsPasswordBtn}
                        type="button"
                        onClick={() => setShowPasswordChange(!showPasswordChange)}
                    >
                        {showPasswordChange ? "Отмена" : "Изменить пароль"}
                    </button>
                </div>

                {showPasswordChange && (
                    <div className={styles.UserSettingsPasswordChange}>
                        <input
                            className={styles.UserSettingsInput}
                            type="password"
                            placeholder="Текущий пароль"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                        />
                        <input
                            className={styles.UserSettingsInput}
                            type="password"
                            placeholder="Новый пароль"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                        />
                        <input
                            className={styles.UserSettingsInput}
                            type="password"
                            placeholder="Подтвердите пароль"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                        <div className={styles.UserSettingsPasswordActions}>
                            <button
                                className={styles.UserSettingsPasswordBtn}
                                type="button"
                                onClick={changePasswordFunc}
                                disabled={isSaving}
                            >
                                {isSaving ? "Сохранение..." : "Сохранить пароль"}
                            </button>
                        </div>
                    </div>
                )}

                <span className={styles.UserSettingsSwitchRowTitle}>Остальные настройки</span>
                <div className={styles.UserSettingsSwitchRow}>
                    <div>
                        <div className={styles.UserSettingsSwitchLabel}>Баланс</div>
                        <div className={styles.UserSettingsSwitchDesc}>Отключите отображение баланса в хедере</div>
                    </div>
                    <label className={styles.UserSettingsSwitch}>
                        <input
                            type="checkbox"
                            checked={hideBalance}
                            onChange={handleHideBalanceChange}
                        />
                        <span className={styles.UserSettingsSlider}></span>
                    </label>
                </div>

                <SignOut />
            </form>
        </div>
    );
};
