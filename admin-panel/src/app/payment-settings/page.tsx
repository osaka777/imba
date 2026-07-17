"use client";

import { useCallback, useEffect, useState } from "react";
import { AuthGuard } from "@/shared/components/AuthGuard";
import { Button } from "@/widgets/Button";
import { Input } from "@/widgets/Input";
import { apiCall } from "@/shared/utils/api";
import { toast } from "react-toastify";

type ManualDepositItem = {
  cardNumber: string;
  holderName: string;
  bankName: string;
  qrImageUrl?: string;
  minAmount: number;
  rubPerBrl?: number;
  walletAddress?: string;
  enabled: boolean;
};

type PaymentSettings = {
  manualDeposit: Record<string, ManualDepositItem>;
  paymentMethods: Record<string, { enabled: boolean; label: string }>;
  notifications: {
    telegramDepositNotify: boolean;
    telegramWithdrawNotify: boolean;
  };
};

const MANUAL_SECTIONS: Array<{
  key: string;
  title: string;
  showRubPerBrl?: boolean;
  showWallet?: boolean;
}> = [
  { key: "KZT", title: "KZT — Visa/Mastercard" },
  { key: "KZT_KASPI", title: "KZT — Kaspi" },
  { key: "RUB", title: "RUB — иностранная карта" },
  { key: "RUB_SBERBANK", title: "RUB — Сбербанк", showRubPerBrl: true },
  { key: "RUB_YANDEX_BANK", title: "RUB — Яндекс Банк" },
  { key: "USDT", title: "USDT TRC-20", showWallet: true },
];

const baseUrl = () => process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export default function PaymentSettingsPage() {
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiCall(`${baseUrl()}/api/admin/payment-settings`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setSettings(data);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const patchManual = (key: string, patch: Partial<ManualDepositItem>) => {
    setSettings((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        manualDeposit: {
          ...prev.manualDeposit,
          [key]: { ...prev.manualDeposit[key], ...patch },
        },
      };
    });
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await apiCall(`${baseUrl()}/api/admin/payment-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manualDeposit: settings.manualDeposit,
          notifications: settings.notifications,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Настройки сохранены");
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const uploadQr = async (key: string, file: File) => {
    setUploadingKey(key);
    try {
      const form = new FormData();
      form.append("image", file);
      form.append("currency", key.toLowerCase());
      const res = await apiCall(`${baseUrl()}/api/admin/payment-settings/upload-qr`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      patchManual(key, { qrImageUrl: data.url || data.path });
      toast.success("QR загружен");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Ошибка загрузки QR");
    } finally {
      setUploadingKey(null);
    }
  };

  if (loading || !settings) {
    return (
      <AuthGuard>
        <div className="p-6">Загрузка...</div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="p-6 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Настройки платежей</h1>
          <Button disabled={saving} onClick={() => void save()}>
            {saving ? "Сохранение..." : "Сохранить"}
          </Button>
        </div>

        <div className="space-y-6">
          {MANUAL_SECTIONS.map(({ key, title, showRubPerBrl, showWallet }) => {
            const item = settings.manualDeposit[key];
            if (!item) return null;
            return (
              <section key={key} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <h2 className="text-lg font-medium">{title}</h2>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      checked={item.enabled !== false}
                      onChange={(e) => patchManual(key, { enabled: e.target.checked })}
                      type="checkbox"
                    />
                    Включено
                  </label>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {showWallet ? (
                    <Input
                      label="Адрес кошелька"
                      onChange={(e) =>
                        patchManual(key, {
                          walletAddress: e.target.value,
                          cardNumber: e.target.value,
                        })
                      }
                      value={item.walletAddress || item.cardNumber || ""}
                    />
                  ) : (
                    <Input
                      label="Номер карты / счёта"
                      onChange={(e) => patchManual(key, { cardNumber: e.target.value })}
                      value={item.cardNumber || ""}
                    />
                  )}
                  <Input
                    label="Получатель"
                    onChange={(e) => patchManual(key, { holderName: e.target.value })}
                    value={item.holderName || ""}
                  />
                  <Input
                    label="Банк"
                    onChange={(e) => patchManual(key, { bankName: e.target.value })}
                    value={item.bankName || ""}
                  />
                  <Input
                    label="Минимальная сумма"
                    onChange={(e) =>
                      patchManual(key, { minAmount: Number(e.target.value) || 0 })
                    }
                    type="number"
                    value={String(item.minAmount ?? 0)}
                  />
                  {showRubPerBrl ? (
                    <Input
                      label="Курс RUB за 1 BRL"
                      onChange={(e) =>
                        patchManual(key, { rubPerBrl: Number(e.target.value) || 0 })
                      }
                      type="number"
                      value={String(item.rubPerBrl ?? 183)}
                    />
                  ) : null}
                  <div className="md:col-span-2">
                    <Input
                      label="URL QR-кода"
                      onChange={(e) => patchManual(key, { qrImageUrl: e.target.value })}
                      value={item.qrImageUrl || ""}
                    />
                    <div className="mt-2 flex items-center gap-3">
                      <input
                        accept="image/*"
                        disabled={uploadingKey === key}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void uploadQr(key, file);
                          e.target.value = "";
                        }}
                        type="file"
                      />
                      {item.qrImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt="QR"
                          className="h-16 w-16 rounded border object-cover"
                          src={
                            item.qrImageUrl.startsWith("http")
                              ? item.qrImageUrl
                              : `${baseUrl()}${item.qrImageUrl}`
                          }
                        />
                      ) : null}
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        <div className="mt-8 flex justify-end">
          <Button disabled={saving} onClick={() => void save()}>
            {saving ? "Сохранение..." : "Сохранить"}
          </Button>
        </div>
      </div>
    </AuthGuard>
  );
}
