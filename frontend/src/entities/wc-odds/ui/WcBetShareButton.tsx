"use client";

import { useState } from "react";
import { toast } from "react-toastify";

import { fetchWcBetShare } from "~/entities/wc-odds/api/client";
import { getSessionClient } from "~/entities/user/lib/getSessionClient";

import styles from "./WcBetShareButton.module.css";

type WcBetShareButtonProps = {
  betId: number;
  className?: string;
};

export function WcBetShareButton({ betId, className }: WcBetShareButtonProps) {
  const [loading, setLoading] = useState(false);

  const onShare = async () => {
    const token = getSessionClient();
    if (!token) {
      toast.error("Войдите в аккаунт");
      return;
    }
    setLoading(true);
    try {
      const share = await fetchWcBetShare(token, betId);
      if (navigator.share) {
        await navigator.share({ title: "Imba.bet", text: share.text, url: share.url });
        return;
      }
      await navigator.clipboard.writeText(`${share.text}\n${share.url}`);
      toast.success("Скопировано в буфер");
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") {
        toast.error("Не удалось поделиться");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      className={`${styles.btn} ${className ?? ""}`}
      disabled={loading}
      onClick={onShare}
      type="button"
    >
      {loading ? "…" : "Поделиться"}
    </button>
  );
}
