"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "react-toastify";

import { changePassword as changePasswordApi } from "~/entities/user/api/changePassword";
import { updateNickname } from "~/entities/user/api/nickname";
import {
  NICKNAME_MAX,
  validateNickname,
  traderProfileHref,
  type NicknameErrorCode,
} from "~/entities/user/lib/nickname";
import { TelegramLinkBlock } from "~/entities/user/ui/TelegramLinkBlock/TelegramLinkBlock";
import { PhoneVerifyBlock } from "~/entities/user/ui/PhoneVerifyBlock/PhoneVerifyBlock";
import { AppPushSettingsBlock } from "~/entities/push/ui/AppPushSettingsBlock";
import { EditableAvatar } from "~/entities/user/ui/EditableAvatar/EditableAvatar";
import { SignOut } from "../Profile/SignOut";
import { LockIcon, ShieldIcon, ToggleIcon } from "~/shared/assets/icons";
import { cn } from "~/shared/lib";
import { useLocale } from "~/shared/model/useLocale";

import styles from "./UserSettings.module.css";

interface UserData {
  id: number;
  email: string;
  phone?: string | null;
  phoneVerified?: boolean;
  telegramLinked?: boolean;
  telegramUsername?: string | null;
  avatarPreset?: string | null;
  avatarUrl?: string | null;
  nickname?: string | null;
}

type UserSettingsProps = {
  userData: UserData | null;
  connectTelegram?: boolean;
  telegramJustLinked?: boolean;
};

function nickErrorKey(code: string): string {
  const map: Record<NicknameErrorCode, string> = {
    too_short: "profile.nicknameTooShort",
    too_long: "profile.nicknameTooLong",
    link: "profile.nicknameNoLinks",
    invalid_chars: "profile.nicknameInvalid",
    taken: "profile.nicknameTaken",
  };
  return map[code as NicknameErrorCode] || "profile.nicknameSaveFailed";
}

export const UserSettings = ({
  userData,
  connectTelegram = false,
  telegramJustLinked = false,
}: UserSettingsProps) => {
  const { t } = useLocale();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [hideBalance, setHideBalance] = useState(false);
  const [telegramLinked, setTelegramLinked] = useState(Boolean(userData?.telegramLinked));
  const [telegramUsername, setTelegramUsername] = useState(userData?.telegramUsername || "");
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(userData?.avatarUrl ?? null);
  const [nickname, setNickname] = useState(userData?.nickname ?? "");
  const [nicknameSaving, setNicknameSaving] = useState(false);

  useEffect(() => {
    setAvatarUrl(userData?.avatarUrl ?? null);
  }, [userData?.avatarUrl]);

  useEffect(() => {
    setNickname(userData?.nickname ?? "");
  }, [userData?.nickname]);

  useEffect(() => {
    setTelegramLinked(Boolean(userData?.telegramLinked));
    setTelegramUsername(userData?.telegramUsername || "");
  }, [userData?.telegramLinked, userData?.telegramUsername]);

  useEffect(() => {
    if (telegramJustLinked) {
      toast.success(t("profile.tgLinkedSuccess"));
    }
  }, [telegramJustLinked, t]);

  useEffect(() => {
    if (!connectTelegram || telegramLinked) return;
    const el = document.querySelector("[data-telegram-highlight]");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [connectTelegram, telegramLinked]);

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

  const saveNickname = async () => {
    const parsed = validateNickname(nickname);
    if (!parsed.ok) {
      toast.error(t(nickErrorKey(parsed.code)));
      return;
    }
    setNicknameSaving(true);
    try {
      const saved = await updateNickname(parsed.value);
      setNickname(saved ?? "");
      toast.success(t("profile.nicknameSaved"));
    } catch (e) {
      const code = e instanceof Error ? e.message : "failed";
      toast.error(t(nickErrorKey(code)));
    } finally {
      setNicknameSaving(false);
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

  const publicName =
    nickname.trim() || telegramUsername || userData?.email || "";

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <Link className={styles.backLink} href="/profile">
          {t("profile.settingsBack")}
        </Link>
        <div className={styles.headerTop}>
          <div className={styles.headerCopy}>
            <h1 className={styles.headerTitle}>{t("profile.settingsTitle")}</h1>
            <p className={styles.headerSubtitle}>{t("profile.settingsSubtitle")}</p>
          </div>
          {userData?.id ? (
            <span className={styles.accountId}>{t("profile.accountId", { id: userData.id })}</span>
          ) : null}
        </div>
      </header>

      <div className={styles.desktopGrid}>
        <aside className={styles.identityColumn}>
          <div className={styles.profileSummary}>
            <EditableAvatar
              className={styles.profileSummaryAvatar}
              email={userData?.email}
              name={publicName}
              preset={userData?.avatarPreset}
              src={avatarUrl}
              userId={userData?.id}
              size={64}
              editable
              onAvatarChange={setAvatarUrl}
            />
            <div className={styles.profileSummaryText}>
              <span className={styles.profileSummaryLabel}>{t("profile.accountLabel")}</span>
              <span className={styles.profileSummaryEmail}>{userData?.email}</span>
              <p className={styles.avatarUploadHint}>{t("profile.avatarUploadHint")}</p>
              {userData?.id ? (
                <Link
                  href={traderProfileHref({
                    userId: userData.id,
                    nickname: nickname.trim() || userData.nickname,
                  })}
                  className={styles.publicProfileLink}
                >
                  {t("profile.viewPublicProfile")}
                </Link>
              ) : null}
            </div>
            <span className={styles.statusBadge}>
              <span aria-hidden className={styles.statusDot} />
              {t("profile.statusActive")}
            </span>
          </div>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>{t("profile.nicknameLabel")}</h2>
            <p className={styles.cardHint}>{t("profile.nicknameHint")}</p>
            <div className={styles.nicknameRow}>
              <input
                id="settings-nickname"
                className={styles.nicknameInput}
                value={nickname}
                maxLength={NICKNAME_MAX}
                placeholder={t("profile.nicknamePlaceholder")}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => setNickname(e.target.value.slice(0, NICKNAME_MAX))}
              />
              <button
                type="button"
                className={styles.nicknameSave}
                disabled={nicknameSaving}
                onClick={saveNickname}
              >
                {nicknameSaving ? t("profile.saving") : t("profile.nicknameSave")}
              </button>
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.passwordRow}>
              <span aria-hidden className={styles.passwordIconWrap}>
                <LockIcon />
              </span>
              <div className={styles.passwordField}>
                <span className={styles.passwordFieldLabel}>{t("profile.passwordLabel")}</span>
                <span className={styles.passwordFieldValue}>••••••••</span>
              </div>
              <button
                className={cn(styles.changePasswordBtn, showPasswordChange && styles.changePasswordBtnActive)}
                type="button"
                onClick={() => setShowPasswordChange(!showPasswordChange)}
              >
                {showPasswordChange ? t("profile.cancel") : t("profile.changePassword")}
              </button>
            </div>

            {showPasswordChange ? (
              <div className={styles.passwordPanel}>
                <div className={styles.inputWrap}>
                  <input
                    className={styles.input}
                    type="password"
                    placeholder={t("profile.currentPassword")}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>
                <div className={styles.inputWrap}>
                  <input
                    className={styles.input}
                    type="password"
                    placeholder={t("profile.newPassword")}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div className={styles.inputWrap}>
                  <input
                    className={styles.input}
                    type="password"
                    placeholder={t("profile.confirmPassword")}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                <div className={styles.passwordActions}>
                  <button
                    className={styles.primaryBtn}
                    type="button"
                    onClick={changePasswordFunc}
                    disabled={isSaving}
                  >
                    {isSaving ? t("profile.saving") : t("profile.savePassword")}
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          <div className={styles.signOutWrapDesktop}>
            <SignOut />
          </div>
        </aside>

        <div className={styles.settingsColumn}>
          <h2 className={styles.sectionTitle}>
            <span aria-hidden className={styles.sectionTitleIcon}>
              <ToggleIcon />
            </span>
            {t("profile.otherSettings")}
          </h2>

          <div className={styles.settingsGroup}>
            <div
              className={cn(
                styles.nestedBlock,
                connectTelegram && !telegramLinked && styles.nestedBlockHighlight,
              )}
              data-telegram-highlight={connectTelegram && !telegramLinked ? true : undefined}
            >
              <TelegramLinkBlock
                linked={telegramLinked}
                username={telegramUsername}
                highlight={connectTelegram && !telegramLinked}
                className={styles.telegramBlock}
                headClassName={styles.telegramHead}
                descClassName={styles.telegramDesc}
                prefsClassName={styles.telegramPrefs}
                prefRowClassName={styles.telegramPrefRow}
                toggleClassName={styles.toggle}
                toggleSliderClassName={styles.toggleSlider}
                buttonClassName={styles.primaryBtn}
                unlinkButtonClassName={styles.ghostBtnDanger}
                actionsClassName={styles.telegramActions}
                onLinkedChange={(linked, username) => {
                  setTelegramLinked(linked);
                  setTelegramUsername(username || "");
                }}
              />
            </div>

            <div className={styles.nestedBlock}>
              <PhoneVerifyBlock
                phone={userData?.phone}
                phoneVerified={userData?.phoneVerified}
                telegramLinked={telegramLinked}
                onVerified={() => window.location.reload()}
              />
            </div>

            <div className={styles.pushWrap}>
              <AppPushSettingsBlock />
            </div>

            <label className={styles.toggleRow}>
              <span aria-hidden className={styles.toggleIconWrap}>
                <ShieldIcon />
              </span>
              <div className={styles.toggleCopy}>
                <div className={styles.toggleLabel}>{t("profile.hideBalance")}</div>
                <div className={styles.toggleDesc}>
                  {t("profile.hideBalanceDesc")}
                </div>
              </div>
              <span className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={hideBalance}
                  onChange={handleHideBalanceChange}
                />
                <span className={styles.toggleSlider} />
              </span>
            </label>
          </div>

          <div className={styles.signOutWrapMobile}>
            <SignOut />
          </div>
        </div>
      </div>
    </div>
  );
};
