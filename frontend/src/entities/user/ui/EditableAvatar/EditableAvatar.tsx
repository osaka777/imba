"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";

import { uploadAvatar } from "~/entities/user/api/avatar";
import { UserAvatar } from "~/entities/user/ui/UserAvatar/UserAvatar";
import { useLocale } from "~/shared/model/useLocale";

import styles from "./EditableAvatar.module.css";

type Props = {
  name?: string | null;
  email?: string | null;
  preset?: string | null;
  src?: string | null;
  userId?: number | null;
  size?: number;
  editable?: boolean;
  onAvatarChange?: (url: string) => void;
  className?: string;
};

function PencilIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M15.2 4.8a2.1 2.1 0 0 1 3 3L8.5 17.5 4 18.5l1-4.5L15.2 4.8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M13.5 6.5 17.5 10.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function EditableAvatar({
  name,
  email,
  preset,
  src,
  userId,
  size = 56,
  editable = false,
  onAvatarChange,
  className,
}: Props) {
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [localSrc, setLocalSrc] = useState(src ?? null);

  useEffect(() => {
    setLocalSrc(src ?? null);
  }, [src]);

  if (!editable) {
    return (
      <UserAvatar
        name={name}
        email={email}
        preset={preset}
        src={localSrc}
        userId={userId}
        size={size}
        className={className}
      />
    );
  }

  const pickFile = () => {
    if (saving) return;
    inputRef.current?.click();
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.match(/^image\/(jpeg|jpg|png|gif|webp)$/i)) {
      toast.error(t("profile.avatarUploadInvalid"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("profile.avatarUploadTooBig"));
      return;
    }

    setSaving(true);
    try {
      const url = await uploadAvatar(file);
      setLocalSrc(url);
      onAvatarChange?.(url);
      queryClient.setQueryData(["user"], (old: unknown) => {
        if (!old || typeof old !== "object") return old;
        return { ...old, avatarUrl: url };
      });
      void queryClient.invalidateQueries({ queryKey: ["user"] });
      void queryClient.invalidateQueries({ queryKey: ["user-me-for-trader"] });
      toast.success(t("profile.avatarSaved"));
    } catch {
      toast.error(t("profile.avatarSaveFailed"));
    } finally {
      setSaving(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div
      className={`${styles.wrap} ${className ?? ""}`}
      style={{ width: size, height: size }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className={styles.fileInput}
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      <button
        type="button"
        className={styles.trigger}
        aria-label={t("profile.avatarEditAria")}
        disabled={saving}
        onClick={pickFile}
      >
        <UserAvatar
          name={name}
          email={email}
          preset={preset}
          src={localSrc}
          userId={userId}
          size={size}
        />
        <span className={styles.overlay} aria-hidden>
          <span className={styles.pencil}>
            <PencilIcon />
          </span>
        </span>
      </button>
    </div>
  );
}
