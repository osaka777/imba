"use client";

import { useState, useEffect } from "react";
import { useLocalStorage } from "usehooks-ts";
import styles from "./SettingsStyles.module.css";
import { api } from "~/shared/api";
import { getSessionClient } from "~/entities/user/lib";
import { toast } from "react-toastify";
import { changePassword as changePasswordApi } from "~/entities/user/api/changePassword";
import { TelegramModal } from "./TelegramModal";
import { useAccountType } from "~/shared/model/useAccountType";
import { useLocale } from "~/shared/model/useLocale";

interface ApiResponse<T> {
  data: T;
  error?: {
    message: string;
    status: number;
  };
}

interface UserData {
  affiliatedById: number;
  balances?: {
    amount: string;
    createdAt: string;
    currencyCode: string;
    id: number;
    updatedAt: string;
    userId: number;
  }[];
  createdAt: string;
  email: string;
  id: number;
  password?: string;
  updatedAt: string;
  name?: string;
  birthDate?: string;
  country?: string;
  countryCode?: string;
  phone?: string;
  accountNumber?: string;
  hideBalance?: boolean;
  telegramLinked?: boolean;
  telegramUsername?: string | null;
}

export const SettingsModal = ({ onClose }: { onClose: () => void }) => {
  const { t } = useLocale();
  const [userData, setUserData] = useState<UserData | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [hideBalance, setHideBalance] = useLocalStorage<boolean>("hideBalance", false);
  const { selectedAccountType, setSelectedAccountType, isClient } = useAccountType();
  const [showTelegram, setShowTelegram] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = getSessionClient();
        const response = await api.GET("/api/user", {
          headers: { Authorization: `Bearer ${token}` },
        }) as unknown as ApiResponse<any>;

        if (response.error) throw response.error;

        if (response.data) {
          const apiData = response.data;
          setUserData({
            ...apiData
          });
        }

        setIsLoading(false);
      } catch (error) {
        console.error("Ошибка при загрузке данных пользователя:", error);
        toast.error(t("profile.settingsLoadFailed"));
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const handleHideBalanceChange = () => {
    const newValue = !hideBalance;
    setHideBalance(newValue);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("hideBalanceChanged"));
    }
  };

  const changePasswordFunc = async () => {
    if (newPassword !== confirmPassword) {
      toast.error(t("profile.passwordMismatch"));
      return;
    }

    setIsSaving(true);
    try {
      await changePasswordApi({
        newPassword,
        oldPassword: currentPassword,
      });

      toast.success(t("profile.passwordChanged"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordChange(false);
    } catch (error) {
      console.error("Ошибка при смене пароля:", error);
      toast.error(t("profile.passwordChangeFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const saveSettings = () => {
    toast.success(t("profile.settingsSaved"));
  };

  if (isLoading) {
    return (
      <div className={styles.settingsModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.headerTitle}>{t("profile.settingsTitle")}</div>
          <div className={styles.accountInfo}>
            <div className={styles.accountNumber}>{t("profile.accountId", { id: String(userData?.id ?? "") })}</div>
            <button className={styles.closeButton} onClick={onClose}>
              &#x2715;
            </button>
          </div>
        </div>
        <div className={styles.headerSubtitle}>{t("profile.settingsSubtitle")}</div>
        <div className={styles.modalContent}>
          <div className={styles.modalBody}>
            <p>{t("profile.settingsLoading")}</p>
          </div>
        </div>
      </div>
    );
  }

  if (showTelegram) {
    return (
      <TelegramModal
        onClose={() => setShowTelegram(false)}
        linked={Boolean(userData?.telegramLinked)}
        username={userData?.telegramUsername}
        onLinkedChange={(linked, username) =>
          setUserData((prev) =>
            prev ? { ...prev, telegramLinked: linked, telegramUsername: username } : prev,
          )
        }
      />
    );
  }

  return (
    <div className={styles.settingsModal} onClick={(e) => e.stopPropagation()}>
      <div className={styles.modalHeader}>
        <div className={styles.headerTitle}>Настройки</div>
        <div className={styles.accountInfo}>
          <div className={styles.accountNumber}>Счет #{userData?.id}</div>
          <button className={styles.closeButton} onClick={onClose}>
            &#x2715;
          </button>
        </div>
      </div>
      <div className={styles.headerSubtitle}>{t("profile.settingsSubtitle")}</div>
      <div className={styles.modalContent}>
        <form className={styles.form}>
          <div className={styles.formRow}>
            <div className={styles.profileValidationField}>
              <div className={styles.mainBlock}>
                <div className={styles.labelText}>Email</div>
                <div className={styles.valueText}>{userData?.email}</div>
                <div className={styles.statusContainer}>
                  <span className={styles.statusVerifiedCircle}></span>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.passwordRow}>
            <div className={styles.passwordRowLeft}>
              {!showPasswordChange ? (
                <div className={styles.controlInputWrapperPassword}>
                  <div className={styles.insideInputPlaceholder}>{t("profile.passwordLabel")}</div>
                  <input
                    className={`${styles.inputPassword} ${styles.readonly}`}
                    type="password"
                    autoComplete="off"
                    readOnly
                    value="••••••••"
                  />
                </div>
              ) : (
                <div className={styles.controlInputWrapper}>
                  <div className={styles.insideInputPlaceholder}>{t("profile.passwordChangeTitle")}</div>
                </div>
              )}
            </div>
            <div className={styles.passwordRowRight}>
              <button
                className={styles.changePasswordButton}
                type="button"
                onClick={() => setShowPasswordChange(!showPasswordChange)}
              >
                <span>{t("profile.changePassword")}</span>
              </button>
            </div>
          </div>

          {showPasswordChange && (
            <div className={styles.passwordChangeForm}>
              <div className={styles.formRow}>
                <div className={styles.controlInputWrapper}>
                  <input
                    className={styles.input}
                    type="password"
                    placeholder={t("profile.currentPassword")}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.controlInputWrapper}>
                  <input
                    className={styles.input}
                    type="password"
                    placeholder={t("profile.newPassword")}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.controlInputWrapper}>
                  <input
                    className={styles.input}
                    type="password"
                    placeholder={t("profile.confirmPassword")}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
              <div className={styles.passwordFormActions}>
                <button
                  className={styles.submitButton}
                  type="button"
                  onClick={changePasswordFunc}
                  disabled={isSaving}
                >
                  {isSaving ? t("profile.saving") : t("profile.savePassword")}
                </button>
                <button
                  className={styles.cancelButton}
                  type="button"
                  onClick={() => setShowPasswordChange(false)}
                >
                  {t("profile.cancel")}
                </button>
              </div>
            </div>
          )}

          <div className={styles.otherSettingsTitle}>{t("profile.otherSettings")}</div>

          <div className={styles.otherSettings}>
            <div className={styles.otherSettingsRow}>
              <button
                type="button"
                className={styles.settingBlock}
                onClick={() => setShowTelegram(true)}
              >
                <div className={styles.leftContent}>
                  <div className={styles.settingHeader}>
                    <div className={styles.settingTitle}>Telegram</div>
                  </div>
                  <div className={styles.settingDescription}>
                    {userData?.telegramLinked
                      ? userData.telegramUsername
                        ? t("profile.tgSettingLinkedUser", { username: userData.telegramUsername })
                        : t("profile.tgSettingLinked")
                      : t("profile.tgSettingUnlinked")}
                  </div>
                </div>
                <div className={styles.rightContent}>
                  <span className={styles.tgNavArrow}>›</span>
                </div>
              </button>
            </div>

            <div className={styles.otherSettingsRow}>
              <label className={styles.settingBlock}>
                <div className={styles.leftContent}>
                  <div className={styles.settingHeader}>
                    <div className={styles.settingTitle}>{t("profile.balanceSettingTitle")}</div>
                  </div>
                  <div className={styles.settingDescription}>
                    {t("profile.balanceSettingDesc")}
                  </div>
                </div>
                <div className={styles.rightContent}>
                  <label className={styles.checkboxContainer}>
                    <input
                      type="checkbox"
                      className={styles.checkboxInput}
                      checked={hideBalance}
                      onChange={handleHideBalanceChange}
                    />
                    <span className={styles.checkmark}></span>
                  </label>
                </div>
              </label>
            </div>

            <div className={styles.otherSettingsRow}>
              <div className={styles.settingBlock}>
                <div className={styles.leftContent}>
                  <div className={styles.settingHeader}>
                    <div className={styles.settingTitle}>{t("profile.accountTypeTitle")}</div>
                  </div>
                  <div className={styles.settingDescription} suppressHydrationWarning>
                    {selectedAccountType === 'main' ? t("profile.mainAccountFull") : t("profile.bonusAccountFull")}
                  </div>
                </div>
                <div className={styles.rightContent}>
                  <label className={styles.toggleSwitch}>
                    <input
                      type="checkbox"
                      className={styles.toggleInput}
                      checked={selectedAccountType === 'bonus'}
                      onChange={() => setSelectedAccountType(selectedAccountType === 'main' ? 'bonus' : 'main')}
                      suppressHydrationWarning
                    />
                    <span className={styles.toggleSlider}></span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.submitButtonRow}>
            <button
              className={`${styles.saveButton} ${isSaving ? styles.disabled : ''}`}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                saveSettings();
              }}
              disabled={isSaving}
            >
              {isSaving ? t("profile.saving") : t("profile.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};