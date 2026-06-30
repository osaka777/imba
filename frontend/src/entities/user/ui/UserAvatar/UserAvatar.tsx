"use client";

import styles from "./UserAvatar.module.css";

const PRESET_COLORS: Record<string, string> = {
  violet: "#7c3aed",
  cyan: "#0891b2",
  amber: "#d97706",
  rose: "#e11d48",
  emerald: "#059669",
  slate: "#475569",
};

export { PRESET_COLORS as AVATAR_PRESET_COLORS };

function initialsFromEmail(email?: string | null): string {
  if (!email) return "?";
  const local = email.split("@")[0] || "";
  const parts = local.replace(/[^a-zA-Z0-9]/g, " ").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return local.slice(0, 2).toUpperCase() || "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function colorFromEmail(email?: string | null): string {
  if (!email) return PRESET_COLORS.slate;
  let hash = 0;
  for (let i = 0; i < email.length; i += 1) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  const keys = Object.keys(PRESET_COLORS);
  return PRESET_COLORS[keys[Math.abs(hash) % keys.length]] ?? PRESET_COLORS.slate;
}

type UserAvatarProps = {
  email?: string | null;
  preset?: string | null;
  size?: number;
  className?: string;
};

export function UserAvatar({
  email,
  preset,
  size = 36,
  className,
}: UserAvatarProps) {
  const initials = initialsFromEmail(email);
  const bg = preset && PRESET_COLORS[preset] ? PRESET_COLORS[preset] : colorFromEmail(email);

  return (
    <span
      className={`${styles.avatar} ${className ?? ""}`}
      style={{ width: size, height: size, backgroundColor: bg, fontSize: Math.max(11, Math.round(size * 0.38)) }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

export const AVATAR_PRESET_OPTIONS = [
  { id: "", label: "Авто (инициалы)" },
  { id: "violet", label: "Фиолетовый" },
  { id: "cyan", label: "Бирюзовый" },
  { id: "amber", label: "Янтарный" },
  { id: "rose", label: "Розовый" },
  { id: "emerald", label: "Изумрудный" },
  { id: "slate", label: "Серый" },
] as const;
