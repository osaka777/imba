"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "react-toastify";

import { getSessionClient } from "~/entities/user/lib/getSessionClient";

import styles from "./PhoneVerifyBlock.module.css";

type PhoneVerifyBlockProps = {
  phone?: string | null;
  phoneVerified?: boolean;
  telegramLinked?: boolean;
  onVerified?: () => void;
};

async function apiPost(path: string, body: object) {
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
        : "Не удалось выполнить запрос",
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
  const [phoneInput, setPhoneInput] = useState(phone || "");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);

  const requestMutation = useMutation({
    mutationFn: () => apiPost("phone/request-code", { phone: phoneInput }),
    onSuccess: () => {
      setCodeSent(true);
      toast.success("Код отправлен в Telegram");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const verifyMutation = useMutation({
    mutationFn: () => apiPost("phone/verify", { code }),
    onSuccess: () => {
      toast.success("Телефон подтверждён");
      onVerified?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (phoneVerified) {
    return (
      <div className={styles.card}>
        <div className={styles.badge}>✓ Подтверждён</div>
        <p className={styles.title}>Телефон верифицирован</p>
        <p className={styles.hint}>
          Повышенный дневной лимит на вывод средств активен.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <p className={styles.title}>Верификация телефона</p>
      <p className={styles.hint}>
        Без подтверждения — лимит вывода 50&nbsp;000 ₸/день. Код приходит в
        Telegram-бот после привязки аккаунта.
      </p>

      {!telegramLinked ? (
        <p className={styles.warn}>Сначала привяжите Telegram выше.</p>
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
              {requestMutation.isPending ? "Отправка…" : "Получить код"}
            </button>
          ) : (
            <>
              <input
                className={styles.input}
                inputMode="numeric"
                maxLength={6}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="Код из Telegram"
                value={code}
              />
              <button
                className={styles.btn}
                disabled={verifyMutation.isPending || code.length !== 6}
                onClick={() => verifyMutation.mutate()}
                type="button"
              >
                {verifyMutation.isPending ? "Проверка…" : "Подтвердить"}
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
