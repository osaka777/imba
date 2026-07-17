"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "react-toastify";

import { changePassword as changePasswordApi } from "~/entities/user/api/changePassword";
import { updateAvatarPreset } from "~/entities/user/api/avatar";
import { TelegramLinkBlock } from "~/entities/user/ui/TelegramLinkBlock/TelegramLinkBlock";
import { PhoneVerifyBlock } from "~/entities/user/ui/PhoneVerifyBlock/PhoneVerifyBlock";
import { AppPushSettingsBlock } from "~/entities/push/ui/AppPushSettingsBlock";
import {
  AVATAR_PRESET_COLORS,
  AVATAR_PRESET_OPTIONS,
  UserAvatar,
} from "~/entities/user/ui/UserAvatar/UserAvatar";
import { SignOut } from "../Profile/SignOut";
import { cn } from "~/shared/lib";
import type { MessageKey } from "~/shared/i18n/messages";
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
}

const SWATCH_KEYS: Record<string, MessageKey> = {
  "": "profile.swatchAuto",
  violet: "profile.swatchViolet",
  cyan: "profile.swatchCyan",
  amber: "profile.swatchAmber",
  rose: "profile.swatchRose",
  emerald: "profile.swatchEmerald",
  slate: "profile.swatchSlate",
};

type UserSettingsProps = {
  userData: UserData | null;
  connectTelegram?: boolean;
  telegramJustLinked?: boolean;
};

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
  const [avatarPreset, setAvatarPreset] = useState(userData?.avatarPreset || "");
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);

  const swatchLabels = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [id, key] of Object.entries(SWATCH_KEYS)) {
      map[id] = t(key);
    }
    return map;
  }, [t]);

  useEffect(() => {
    setTelegramLinked(Boolean(userData?.telegramLinked));
    setTelegramUsername(userData?.telegramUsername || "");
    setAvatarPreset(userData?.avatarPreset || "");
  }, [userData?.telegramLinked, userData?.telegramUsername, userData?.avatarPreset]);

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

  const handleAvatarSelect = async (presetId: string) => {
    if (avatarSaving || (avatarPreset || "") === presetId) return;
    setAvatarSaving(true);
    try {
      await updateAvatarPreset(presetId || null);
      setAvatarPreset(presetId);
      toast.success(t("profile.avatarUpdated"));
    } catch {
      toast.error(t("profile.avatarSaveFailed"));
    } finally {
      setAvatarSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <Link className={styles.backLink} href="/profile">
          {t("profile.settingsBack")}
        </Link>
        <div className={styles.headerTop}>
          <h1 className={styles.headerTitle}>{t("profile.settingsTitle")}</h1>
          {userData?.id ? (
            <span className={styles.accountId}>{t("profile.accountId", { id: userData.id })}</span>
          ) : null}
        </div>
        <p className={styles.headerSubtitle}>{t("profile.settingsSubtitle")}</p>
      </header>

      <div className={styles.content}>
        <div className={styles.profileSummary}>
          <UserAvatar
            email={userData?.email}
            preset={avatarPreset || null}
            size={48}
          />
          <div className={styles.profileSummaryText}>
            <span className={styles.profileSummaryLabel}>{t("profile.accountLabel")}</span>
            <span className={styles.profileSummaryEmail}>{userData?.email}</span>
          </div>
          <span className={styles.statusVerified} aria-hidden title={t("profile.statusActive")} />
        </div>

        <div className={styles.validationField}>
          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>Email</span>
            <span className={styles.fieldValue}>{userData?.email}</span>
            <span className={styles.statusVerified} aria-hidden />
          </div>
        </div>

        <h2 className={styles.sectionTitle}>{t("profile.avatarSection")}</h2>
        <div className={styles.avatarPanel}>
          <p className={styles.avatarHint}>{t("profile.avatarHint")}</p>
          <div className={styles.avatarGrid}>
            {AVATAR_PRESET_OPTIONS.map((opt) => {
              const active = (avatarPreset || "") === opt.id;
              const color = opt.id ? AVATAR_PRESET_COLORS[opt.id] : null;
              return (
                <button
                  key={opt.id || "auto"}
                  type="button"
                  className={cn(styles.avatarSwatch, active && styles.avatarSwatchActive)}
                  disabled={avatarSaving}
                  aria-pressed={active}
                  aria-label={opt.label}
                  onClick={() => void handleAvatarSelect(opt.id)}
                >
                  <span className={styles.avatarSwatchRing}>
                    {color ? (
                      <span
                        className={styles.avatarSwatchColor}
                        style={{ backgroundColor: color }}
                      />
                    ) : (
                      <span className={styles.avatarSwatchAuto}>A</span>
                    )}
                  </span>
                  <span className={styles.avatarSwatchLabel}>
                    {swatchLabels[opt.id] ?? opt.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.passwordRow}>
          <div className={styles.passwordField}>
            <span className={styles.passwordFieldLabel}>{t("profile.passwordLabel")}</span>
            <span className={styles.passwordFieldValue}>••••••••</span>
          </div>
          <button
            className={styles.changePasswordBtn}
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

        <h2 className={styles.sectionTitle}>{t("profile.otherSettings")}</h2>

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
              unlinkButtonClassName={cn(styles.primaryBtn, styles.ghostBtnDanger)}
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

          <label className={cn(styles.settingBlock, styles.toggleRow)}>
            <div className={styles.toggleCopy}>
              <div className={styles.toggleLabel}>{t("profile.hideBalance")}</div>
              <div className={styles.toggleDesc}>
                {t("profile.hideBalanceDesc")}
              </div>
            </div>
            <span className={styles.settingBlockAside}>
              <span className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={hideBalance}
                  onChange={handleHideBalanceChange}
                />
                <span className={styles.toggleSlider} />
              </span>
            </span>
          </label>
        </div>

        <div className={styles.signOutWrap}>
          <SignOut />
        </div>
      </div>
    </div>
  );
};
