"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "react-toastify";

import { changePassword as changePasswordApi } from "~/entities/user/api/changePassword";
import { updateAvatarPreset } from "~/entities/user/api/avatar";
import { TelegramLinkBlock } from "~/entities/user/ui/TelegramLinkBlock/TelegramLinkBlock";
import {
  AVATAR_PRESET_COLORS,
  AVATAR_PRESET_OPTIONS,
  UserAvatar,
} from "~/entities/user/ui/UserAvatar/UserAvatar";
import { SignOut } from "../Profile/SignOut";
import { cn } from "~/shared/lib";

import styles from "./UserSettings.module.css";

interface UserData {
  id: number;
  email: string;
  telegramLinked?: boolean;
  telegramUsername?: string | null;
  avatarPreset?: string | null;
}

const SWATCH_SHORT_LABELS: Record<string, string> = {
  "": "Авто",
  violet: "Фиолет.",
  cyan: "Бирюза",
  amber: "Янтарь",
  rose: "Розовый",
  emerald: "Изумр.",
  slate: "Серый",
};

export const UserSettings = ({ userData }: { userData: UserData | null }) => {
  const searchParams = useSearchParams();
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [hideBalance, setHideBalance] = useState(false);
  const [telegramLinked, setTelegramLinked] = useState(Boolean(userData?.telegramLinked));
  const [telegramUsername, setTelegramUsername] = useState(userData?.telegramUsername || "");
  const [avatarPreset, setAvatarPreset] = useState(userData?.avatarPreset || "");
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [heroAvatarSize, setHeroAvatarSize] = useState(56);

  useEffect(() => {
    setTelegramLinked(Boolean(userData?.telegramLinked));
    setTelegramUsername(userData?.telegramUsername || "");
    setAvatarPreset(userData?.avatarPreset || "");
  }, [userData?.telegramLinked, userData?.telegramUsername, userData?.avatarPreset]);

  useEffect(() => {
    if (searchParams.get("telegram") === "linked") {
      toast.success("Telegram успешно привязан");
    }
  }, [searchParams]);

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

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 769px)");
    const sync = () => setHeroAvatarSize(mq.matches ? 72 : 56);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
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

    if (newPassword.length < 8) {
      toast.error("Новый пароль должен содержать не менее 8 символов");
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

  const handleAvatarSelect = async (presetId: string) => {
    if (avatarSaving || (avatarPreset || "") === presetId) return;
    setAvatarSaving(true);
    try {
      await updateAvatarPreset(presetId || null);
      setAvatarPreset(presetId);
      toast.success("Аватар обновлён");
    } catch {
      toast.error("Не удалось сохранить аватар");
    } finally {
      setAvatarSaving(false);
    }
  };

  const avatarCard = (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <span className={styles.cardHeadTitle}>Аватар</span>
      </div>
      <div className={styles.cardBody}>
        <p className={styles.cardDesc}>Цвет и инициалы вместо загрузки фото</p>
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
                  {SWATCH_SHORT_LABELS[opt.id] ?? opt.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <Link className={styles.backLink} href="/profile">
          ← Назад в профиль
        </Link>
        <h1 className={styles.pageTitle}>Редактировать профиль</h1>
      </header>

      <div className={styles.layout}>
        <aside className={styles.colLeft}>
          <div className={styles.profileHero}>
            <div className={styles.profileHeroBar}>
              <span className={styles.profileHeroBarTitle}>Профиль</span>
            </div>
            <div className={styles.profileHeroBody}>
              <UserAvatar
                email={userData?.email}
                preset={avatarPreset || null}
                size={heroAvatarSize}
              />
              <div className={styles.profileHeroText}>
                <p className={styles.profileEmail}>{userData?.email}</p>
                <span className={styles.profileStatus}>
                  <span className={styles.profileStatusDot} aria-hidden />
                  Аккаунт активен
                </span>
              </div>
            </div>
          </div>
          {avatarCard}
        </aside>

        <div className={styles.colRight}>
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <span className={styles.cardHeadTitle}>Telegram</span>
            </div>
            <div className={styles.cardBody}>
              <TelegramLinkBlock
                linked={telegramLinked}
                username={telegramUsername}
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
          </section>

          <div className={styles.rowPair}>
            <section className={styles.card}>
              <div className={styles.cardHead}>
                <span className={styles.cardHeadTitle}>Безопасность</span>
              </div>
              <div className={styles.cardBody}>
                <p className={styles.cardDesc}>Смена пароля для входа в аккаунт</p>
                <button
                  className={styles.ghostBtn}
                  type="button"
                  onClick={() => setShowPasswordChange(!showPasswordChange)}
                >
                  {showPasswordChange ? "Отмена" : "Изменить пароль"}
                </button>

                {showPasswordChange ? (
                  <div className={styles.passwordPanel}>
                    <input
                      className={styles.input}
                      type="password"
                      placeholder="Текущий пароль"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                    />
                    <input
                      className={styles.input}
                      type="password"
                      placeholder="Новый пароль"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <input
                      className={styles.input}
                      type="password"
                      placeholder="Подтвердите пароль"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    <button
                      className={styles.primaryBtn}
                      type="button"
                      onClick={changePasswordFunc}
                      disabled={isSaving}
                    >
                      {isSaving ? "Сохранение..." : "Сохранить пароль"}
                    </button>
                  </div>
                ) : null}
              </div>
            </section>

            <section className={styles.card}>
              <div className={styles.cardHead}>
                <span className={styles.cardHeadTitle}>Интерфейс</span>
              </div>
              <div className={styles.cardBody}>
                <div className={styles.toggleRow}>
                  <div className={styles.toggleCopy}>
                    <div className={styles.toggleLabel}>Скрыть баланс</div>
                    <div className={styles.toggleDesc}>
                      Не показывать сумму в шапке сайта
                    </div>
                  </div>
                  <label className={styles.toggle}>
                    <input
                      type="checkbox"
                      checked={hideBalance}
                      onChange={handleHideBalanceChange}
                    />
                    <span className={styles.toggleSlider} />
                  </label>
                </div>
              </div>
            </section>
          </div>

          <div className={styles.signOutWrap}>
            <SignOut />
          </div>
        </div>
      </div>
    </div>
  );
};
