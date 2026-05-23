"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./referral.module.css";

interface ReferralData {
  referralLink: string;
  uid: string;
  percent: string;
}

export default function ReferralPage() {
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchReferralLink = async () => {
      try {
        const token = localStorage.getItem("accessToken");
        if (!token) {
          router.push("/");
          return;
        }

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/affiliate-program/user/referral-link`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error("Не удалось получить реферальную ссылку");
        }

        const data = await response.json();
        setReferralData(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchReferralLink();
  }, [router]);

  const copyToClipboard = async () => {
    if (referralData?.referralLink) {
      try {
        await navigator.clipboard.writeText(referralData.referralLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("Ошибка копирования:", err);
      }
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Загрузка...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>Ошибка</h2>
          <p>{error}</p>
          <p className={styles.hint}>
            Эта страница доступна только для партнеров. Если вы хотите стать
            партнером, свяжитесь с администрацией.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Партнерская программа</h1>
        <p className={styles.subtitle}>
          Приглашайте друзей и получайте {referralData?.percent}% от их проигрышей
        </p>
      </div>

      <div className={styles.card}>
        <h2>Ваша реферальная ссылка</h2>
        <div className={styles.linkContainer}>
          <input
            type="text"
            value={referralData?.referralLink || ""}
            readOnly
            className={styles.linkInput}
          />
          <button
            onClick={copyToClipboard}
            className={styles.copyButton}
          >
            {copied ? "✓ Скопировано" : "Копировать"}
          </button>
        </div>
        <p className={styles.uid}>Ваш уникальный ID: {referralData?.uid}</p>
      </div>

      <div className={styles.infoCards}>
        <div className={styles.infoCard}>
          <h3>Как это работает?</h3>
          <ol>
            <li>Поделитесь своей реферальной ссылкой с друзьями</li>
            <li>Когда они регистрируются по вашей ссылке, они становятся вашими рефералами</li>
            <li>Вы получаете {referralData?.percent}% от каждой проигрышной ставки ваших рефералов</li>
            <li>Выводите заработанные средства в любое время</li>
          </ol>
        </div>

        <div className={styles.infoCard}>
          <h3>Преимущества</h3>
          <ul>
            <li>✓ Высокий процент комиссии - {referralData?.percent}%</li>
            <li>✓ Пожизненные начисления</li>
            <li>✓ Мгновенное начисление бонусов</li>
            <li>✓ Без ограничений по количеству рефералов</li>
            <li>✓ Детальная статистика</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
