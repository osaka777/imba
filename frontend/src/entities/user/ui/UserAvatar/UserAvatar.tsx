"use client";

import {
  avatarColor,
  initialsFromLabel,
} from "~/entities/user/lib/avatarPresets";

import styles from "./UserAvatar.module.css";

type UserAvatarProps = {
  className?: string;
  /** @deprecated Prefer `name` for public profiles */
  email?: string | null;
  name?: string | null;
  preset?: string | null;
  src?: string | null;
  userId?: number | null;
  size?: number;
};

export function UserAvatar({
  className,
  email,
  name,
  preset,
  src,
  userId,
  size = 36,
}: UserAvatarProps) {
  const label = name || email || (userId != null ? `P${userId}` : "?");
  const initials = initialsFromLabel(label);
  const bg = avatarColor(preset, userId ?? label);
  const imageSrc = src?.trim() || null;

  if (imageSrc) {
    return (
      <span
        aria-hidden
        className={`${styles.avatar} ${styles.avatarImage} ${className ?? ""}`}
        style={{
          width: size,
          height: size,
          backgroundColor: "transparent",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageSrc} alt="" draggable={false} />
      </span>
    );
  }

  return (
    <span
      aria-hidden
      className={`${styles.avatar} ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        backgroundColor: bg,
        fontSize: Math.max(11, Math.round(size * 0.38)),
      }}
    >
      {initials}
    </span>
  );
}
