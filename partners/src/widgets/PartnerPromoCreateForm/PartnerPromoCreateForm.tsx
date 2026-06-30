"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./PartnerPromoCreateForm.module.css";

type Props = {
  onCreated?: () => void;
};

export function PartnerPromoCreateForm({ onCreated }: Props) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [bonusType, setBonusType] = useState<"DIRECT_BONUS" | "DEPOSIT_BONUS">("DIRECT_BONUS");
  const [amount, setAmount] = useState("500");
  const [percentage, setPercentage] = useState("50");
  const [minDeposit, setMinDeposit] = useState("1000");
  const [available, setAvailable] = useState("100");
  const [currencyCode, setCurrencyCode] = useState("KZT");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/partner-promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.toUpperCase(),
          bonusType,
          amount: bonusType === "DIRECT_BONUS" ? Number(amount) : undefined,
          percentage: bonusType === "DEPOSIT_BONUS" ? Number(percentage) : undefined,
          minDeposit: bonusType === "DEPOSIT_BONUS" ? Number(minDeposit) : undefined,
          available: Number(available),
          currencyCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || data?.message || "Ошибка создания");
      alert(data?.message || "Промокод создан");
      setCode("");
      onCreated?.();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className={styles.card}>
      <h2 className={styles.title}>Создать промокод</h2>
      <p className={styles.desc}>
        До 10 активных кодов. Код активен сразу после одобрения аккаунта менеджером.
      </p>
      <form className={styles.form} onSubmit={submit}>
        <label className={styles.field}>
          <span>Код</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            pattern="[A-Z0-9]{4,20}"
            required
            placeholder="WELCOME50"
          />
        </label>
        <label className={styles.field}>
          <span>Тип</span>
          <select value={bonusType} onChange={(e) => setBonusType(e.target.value as typeof bonusType)}>
            <option value="DIRECT_BONUS">Прямой бонус</option>
            <option value="DEPOSIT_BONUS">Бонус на депозит</option>
          </select>
        </label>
        {bonusType === "DIRECT_BONUS" ? (
          <label className={styles.field}>
            <span>Сумма бонуса</span>
            <input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </label>
        ) : (
          <>
            <label className={styles.field}>
              <span>% от депозита</span>
              <input type="number" min={1} max={500} value={percentage} onChange={(e) => setPercentage(e.target.value)} required />
            </label>
            <label className={styles.field}>
              <span>Мин. депозит</span>
              <input type="number" min={0} value={minDeposit} onChange={(e) => setMinDeposit(e.target.value)} required />
            </label>
          </>
        )}
        <label className={styles.field}>
          <span>Валюта</span>
          <select value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)}>
            <option value="KZT">KZT</option>
            <option value="RUB">RUB</option>
            <option value="USD">USD</option>
          </select>
        </label>
        <label className={styles.field}>
          <span>Лимит активаций</span>
          <input type="number" min={1} max={500} value={available} onChange={(e) => setAvailable(e.target.value)} required />
        </label>
        {error && <p className={styles.error}>{error}</p>}
        <button type="submit" className={styles.submit} disabled={loading}>
          {loading ? "Создание…" : "Создать промокод"}
        </button>
      </form>
    </section>
  );
}
