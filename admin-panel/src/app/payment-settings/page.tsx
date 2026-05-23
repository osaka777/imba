"use client";

import { useCallback, useEffect, useState } from "react";
import { AuthGuard } from "@/shared/components/AuthGuard";
import { Button } from "@/widgets/Button";
import { Input } from "@/widgets/Input";
import { apiCall } from "@/shared/utils/api";
import { toast } from "react-toastify";

type Currency = "KZT" | "RUB";

type ManualDepositItem = {
  cardNumber: string;
  holderName: string;
  bankName: string;
  qrImageUrl?: string;
  minAmount: number;
  enabled: boolean;
};

type PaymentSettings = {
  manualDeposit: Record<Currency, ManualDepositItem>;
  paymentMethods: Record<string, { enabled: boolean; label: string }>;
  notifications: {
    telegramDepositNotify: boolean;
    telegramWithdrawNotify: boolean;
  };
  telegram?: {
    notifyUrl: string;
    hasSecret: boolean;
    chatId: string;
  };
};

type Tab = "qr" | "payments" | "notifications";

const baseUrl = () => process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export default function PaymentSettingsPage() {
  const [tab, setTab] = useState<Tab>("qr");
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<Currency | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiCall(`${baseUrl()}/api/admin/payment-settings`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setSettings(data);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Ошибка загрузки настроек");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await apiCall(`${baseUrl()}/api/admin/payment-settings`, {
        method: "PUT",
        body: JSON.stringify({
          manualDeposit: settings.manualDeposit,
          paymentMethods: settings.paymentMethods,
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

  const uploadQr = async (currency: Currency, file: File) => {
    setUploading(currency);
    try {
      const token = localStorage.getItem("authToken");
      const form = new FormData();
      form.append("image", file);
      form.append("currency", currency.toLowerCase());
      const res = await fetch(`${baseUrl()}/api/admin/payment-settings/upload-qr`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const url = data.url || `/${data.path}`;
      setSettings((prev) =>
        prev
          ? {
              ...prev,
              manualDeposit: {
                ...prev.manualDeposit,
                [currency]: {
                  ...prev.manualDeposit[currency],
                  qrImageUrl: url.startsWith("/") ? url : `/${url}`,
                },
              },
            }
          : prev,
      );
      toast.success("QR загружен — нажмите «Сохранить»");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Ошибка загрузки QR");
    } finally {
      setUploading(null);
    }
  };

  const updateManual = (currency: Currency, patch: Partial<ManualDepositItem>) => {
    setSettings((prev) =>
      prev
        ? {
            ...prev,
            manualDeposit: {
              ...prev.manualDeposit,
              [currency]: { ...prev.manualDeposit[currency], ...patch },
            },
          }
        : prev,
    );
  };

  const toggleMethod = (key: string) => {
    setSettings((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        paymentMethods: {
          ...prev.paymentMethods,
          [key]: {
            ...prev.paymentMethods[key],
            enabled: !prev.paymentMethods[key]?.enabled,
          },
        },
      };
    });
  };

  const renderManualBlock = (currency: Currency, title: string) => {
    if (!settings) return null;
    const item = settings.manualDeposit[currency];
    const qrPreview = item.qrImageUrl
      ? `${baseUrl()}${item.qrImageUrl.startsWith("/") ? "" : "/"}${item.qrImageUrl}`
      : "";

    return (
      <div className="min-w-0 rounded-lg border border-gray-200 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              checked={item.enabled}
              onChange={(e) => updateManual(currency, { enabled: e.target.checked })}
              type="checkbox"
            />
            Приём включён
          </label>
        </div>

        <Input
          label="Номер карты"
          value={item.cardNumber}
          onChange={(e) => updateManual(currency, { cardNumber: e.target.value })}
        />
        <Input
          label="Получатель"
          value={item.holderName}
          onChange={(e) => updateManual(currency, { holderName: e.target.value })}
        />
        <Input
          label="Банк"
          value={item.bankName}
          onChange={(e) => updateManual(currency, { bankName: e.target.value })}
        />
        <Input
          label="Минимальная сумма"
          type="number"
          value={String(item.minAmount)}
          onChange={(e) =>
            updateManual(currency, { minAmount: Number(e.target.value) || 0 })
          }
        />

        <div>
          <p className="mb-2 text-sm font-medium text-gray-700">QR-код</p>
          <div className="flex flex-wrap items-start gap-4">
            {qrPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={`QR ${currency}`}
                className="h-28 w-28 rounded border border-gray-200 object-contain bg-white"
                src={qrPreview}
              />
            ) : (
              <div className="flex h-28 w-28 items-center justify-center rounded border border-dashed border-gray-300 text-xs text-gray-400">
                Нет QR
              </div>
            )}
            <div>
              <input
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadQr(currency, file);
                }}
                type="file"
              />
              {uploading === currency && (
                <p className="mt-2 text-sm text-blue-600">Загрузка...</p>
              )}
              <p className="mt-2 break-all text-xs text-gray-500">{item.qrImageUrl || "—"}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <AuthGuard>
      <div className="min-w-0 max-w-5xl py-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Настройки платежей</h1>
            <p className="text-sm text-gray-500">QR, приём платежей и уведомления</p>
          </div>
          <Button disabled={saving || loading} onClick={save}>
            {saving ? "Сохранение..." : "Сохранить"}
          </Button>
        </div>

        <div className="mb-6 inline-flex rounded-lg bg-gray-100 p-1">
          {(
            [
              ["qr", "QR и карты"],
              ["payments", "Приём платежей"],
              ["notifications", "Уведомления"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              className={`rounded-md px-4 py-2 text-sm font-medium ${
                tab === id ? "bg-blue-600 text-white" : "text-gray-700"
              }`}
              onClick={() => setTab(id)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>

        {loading || !settings ? (
          <div className="text-gray-500">Загрузка настроек...</div>
        ) : (
          <>
            {tab === "qr" && (
              <div className="grid min-w-0 gap-6 xl:grid-cols-2">
                {renderManualBlock("KZT", "KZT — Kaspi / карта")}
                {renderManualBlock("RUB", "RUB — карта")}
              </div>
            )}

            {tab === "payments" && (
              <div className="rounded-lg border border-gray-200 bg-white divide-y">
                {Object.entries(settings.paymentMethods).map(([key, method]) => (
                  <label
                    key={key}
                    className="flex items-center justify-between px-5 py-4 cursor-pointer"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{method.label}</p>
                      <p className="text-xs text-gray-500">{key}</p>
                    </div>
                    <input
                      checked={method.enabled}
                      onChange={() => toggleMethod(key)}
                      type="checkbox"
                    />
                  </label>
                ))}
              </div>
            )}

            {tab === "notifications" && (
              <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
                <label className="flex items-center justify-between">
                  <span className="text-gray-900">Telegram: уведомления о депозитах</span>
                  <input
                    checked={settings.notifications.telegramDepositNotify}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        notifications: {
                          ...settings.notifications,
                          telegramDepositNotify: e.target.checked,
                        },
                      })
                    }
                    type="checkbox"
                  />
                </label>
                <label className="flex items-center justify-between">
                  <span className="text-gray-900">Telegram: уведомления о выводах</span>
                  <input
                    checked={settings.notifications.telegramWithdrawNotify}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        notifications: {
                          ...settings.notifications,
                          telegramWithdrawNotify: e.target.checked,
                        },
                      })
                    }
                    type="checkbox"
                  />
                </label>

                <div className="rounded-md bg-gray-50 p-4 text-sm text-gray-600 space-y-1">
                  <p>
                    <strong>Notify URL:</strong>{" "}
                    {settings.telegram?.notifyUrl || "не задан"}
                  </p>
                  <p>
                    <strong>Chat ID:</strong> {settings.telegram?.chatId || "из imba-bot .env"}
                  </p>
                  <p>
                    <strong>Secret:</strong>{" "}
                    {settings.telegram?.hasSecret ? "настроен" : "не задан"}
                  </p>
                  <p className="text-xs text-gray-500 pt-2">
                    URL и secret меняются в `.env` на сервере. Здесь — вкл/выкл отправки.
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AuthGuard>
  );
}
