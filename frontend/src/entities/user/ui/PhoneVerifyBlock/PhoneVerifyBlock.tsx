"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "react-toastify";

import { getSessionClient } from "~/entities/user/lib/getSessionClient";
import { useLocale } from "~/shared/model/useLocale";

import styles from "./PhoneVerifyBlock.module.css";

type PhoneVerifyBlockProps = {
  phone?: string | null;
  phoneVerified?: boolean;
  telegramLinked?: boolean;
  onVerified?: () => void;
};

async function apiPost(path: string, body: object, fallbackError: string) {
  const token = getSessionClient();
  const res = await fetch(`${window.location.origin}/api/user/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data?.message === "string"
        ? data.message
        : fallbackError,
    );
  }
  return data;
}

export function PhoneVerifyBlock({
  phone,
  phoneVerified,
  telegramLinked,
  onVerified,
}: PhoneVerifyBlockProps) {
  const { t } = useLocale();
  const [phoneInput, setPhoneInput] = useState(phone || "");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const requestFailed = t("profile.phoneRequestFailed");

  const requestMutation = useMutation({
    mutationFn: () => apiPost("phone/request-code", { phone: phoneInput }, requestFailed),
    onSuccess: () => {
      setCodeSent(true);
      toast.success(t("profile.phoneCodeSent"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const verifyMutation = useMutation({
    mutationFn: () => apiPost("phone/verify", { code }, requestFailed),
    onSuccess: () => {
      toast.success(t("profile.phoneVerified"));
      onVerified?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (phoneVerified) {
    return (
      <div className={styles.card}>
        <div className={styles.badge}>{t("profile.phoneVerifiedBadge")}</div>
        <p className={styles.title}>{t("profile.phoneVerifiedTitle")}</p>
        <p className={styles.hint}>
          {t("profile.phoneVerifiedHint")}
        </p>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <p className={styles.title}>{t("profile.phoneVerifyTitle")}</p>
      <p className={styles.hint}>
        {t("profile.phoneVerifyHint")}
      </p>

      {!telegramLinked ? (
        <p className={styles.warn}>{t("profile.phoneLinkTgFirst")}</p>
      ) : (
        <>
          <input
            className={styles.input}
            onChange={(e) => setPhoneInput(e.target.value)}
            placeholder="+7 700 123 45 67"
            type="tel"
            value={phoneInput}
          />
          {!codeSent ? (
            <button
              className={styles.btn}
              disabled={requestMutation.isPending || !phoneInput.trim()}
              onClick={() => requestMutation.mutate()}
              type="button"
            >
              {requestMutation.isPending ? t("profile.phoneSending") : t("profile.phoneGetCode")}
            </button>
          ) : (
            <>
              <input
                className={styles.input}
                inputMode="numeric"
                maxLength={6}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder={t("profile.phoneTgCode")}
                value={code}
              />
              <button
                className={styles.btn}
                disabled={verifyMutation.isPending || code.length !== 6}
                onClick={() => verifyMutation.mutate()}
                type="button"
              >
                {verifyMutation.isPending ? t("profile.phoneChecking") : t("profile.phoneConfirm")}
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
