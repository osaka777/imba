"use client";

import { useCallback, useEffect, useState } from "react";
import { AuthGuard } from "@/shared/components/AuthGuard";
import { Button } from "@/widgets/Button";
import { Input } from "@/widgets/Input";
import { apiCall } from "@/shared/utils/api";
import { toast } from "react-toastify";

type ManualDepositKey = "KZT" | "KZT_KASPI" | "RUB" | "RUB_SBERBANK" | "USDT";

type ManualDepositItem = {
  cardNumber: string;
  holderName: string;
  bankName: string;
  qrImageUrl?: string;
  walletAddress?: string;
  minAmount: number;
  rubPerBrl?: number;
  enabled: boolean;
};

type PaymentSettings = {
  manualDeposit: Record<ManualDepositKey, ManualDepositItem>;
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

const MANUAL_TO_PAYMENT_METHOD: Record<ManualDepositKey, string> = {
  KZT: "KZT_FOREIGN_CARD",
  KZT_KASPI: "KZT_KASPI",
  RUB: "RUB_FOREIGN_CARD",
  RUB_SBERBANK: "RUB_SBERBANK",
  USDT: "USDT_TRC20",
};

const baseUrl = () => process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

const syncManualToPaymentMethods = (
  manualDeposit: PaymentSettings["manualDeposit"],
  paymentMethods: PaymentSettings["paymentMethods"],
) => {
  const next = { ...paymentMethods };
  (Object.keys(MANUAL_TO_PAYMENT_METHOD) as ManualDepositKey[]).forEach((key) => {
    const methodKey = MANUAL_TO_PAYMENT_METHOD[key];
    if (!next[methodKey]) return;
    next[methodKey] = {
      ...next[methodKey],
      enabled: manualDeposit[key]?.enabled !== false,
    };
  });
  return next;
};

export default function PaymentSettingsPage() {
  const [tab, setTab] = useState<Tab>("qr");
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<ManualDepositKey | null>(null);

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
      const paymentMethods = syncManualToPaymentMethods(
        settings.manualDeposit,
        settings.paymentMethods,
      );
      const res = await apiCall(`${baseUrl()}/api/admin/payment-settings`, {
        method: "PUT",
        body: JSON.stringify({
          manualDeposit: settings.manualDeposit,
          paymentMethods,
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

  const uploadQr = async (key: ManualDepositKey, file: File) => {
    setUploading(key);
    try {
      const token = localStorage.getItem("authToken");
      const form = new FormData();
      form.append("image", file);
      form.append("currency", key.toLowerCase().replace(/_/g, "-"));
      const res = await fetch(`${baseUrl()}/api/admin/payment-settings/upload-qr`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const url = data.url || `/${data.path}`;
      const qrUrl = url.startsWith("/") ? url : `/${url}`;
      const nextSettings = settings
        ? {
            ...settings,
            manualDeposit: {
              ...settings.manualDeposit,
              [key]: {
                ...settings.manualDeposit[key],
                qrImageUrl: qrUrl,
              },
            },
          }
        : null;

      if (nextSettings) {
        const syncedSettings = {
          ...nextSettings,
          paymentMethods: syncManualToPaymentMethods(
            nextSettings.manualDeposit,
            nextSettings.paymentMethods,
          ),
        };
        setSettings(syncedSettings);
        const saveRes = await apiCall(`${baseUrl()}/api/admin/payment-settings`, {
          method: "PUT",
          body: JSON.stringify({
            manualDeposit: syncedSettings.manualDeposit,
            paymentMethods: syncedSettings.paymentMethods,
            notifications: syncedSettings.notifications,
          }),
        });
        if (!saveRes.ok) {
          toast.warn("QR загружен, но автосохранение не удалось — нажмите «Сохранить»");
        } else {
          toast.success("QR загружен и сохранён");
          await load();
        }
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Ошибка загрузки QR");
    } finally {
      setUploading(null);
    }
  };

  const updateManual = (key: ManualDepositKey, patch: Partial<ManualDepositItem>) => {
    setSettings((prev) => {
      if (!prev) return prev;
      const manualDeposit = {
        ...prev.manualDeposit,
        [key]: { ...prev.manualDeposit[key], ...patch },
      };
      const paymentMethods =
        Object.prototype.hasOwnProperty.call(patch, "enabled")
          ? syncManualToPaymentMethods(manualDeposit, prev.paymentMethods)
          : prev.paymentMethods;
      return { ...prev, manualDeposit, paymentMethods };
    });
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

  const removeQr = (key: ManualDepositKey) => {
    updateManual(key, { qrImageUrl: "" });
    toast.info("QR удалён — нажмите «Сохранить»");
  };

  const renderManualBlock = (key: ManualDepositKey, title: string) => {
    if (!settings) return null;
    const item = settings.manualDeposit[key];
    if (!item) return null;
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
              onChange={(e) => updateManual(key, { enabled: e.target.checked })}
              type="checkbox"
            />
            Приём включён
          </label>
        </div>

        {key === "USDT" ? (
          <Input
            label="Адрес кошелька TRC-20"
            value={item.walletAddress || item.cardNumber}
            onChange={(e) =>
              updateManual(key, {
                cardNumber: e.target.value,
                walletAddress: e.target.value,
              })
            }
          />
        ) : null}
        {key !== "RUB_SBERBANK" && key !== "USDT" ? (
          <Input
            label="Номер карты"
            value={item.cardNumber}
            onChange={(e) => updateManual(key, { cardNumber: e.target.value })}
          />
        ) : null}
        {key !== "RUB_SBERBANK" && key !== "USDT" ? (
          <Input
            label="Получатель"
            value={item.holderName}
            onChange={(e) => updateManual(key, { holderName: e.target.value })}
          />
        ) : null}
        {key !== "RUB_SBERBANK" && key !== "USDT" ? (
          <Input
            label="Банк"
            value={item.bankName}
            onChange={(e) => updateManual(key, { bankName: e.target.value })}
          />
        ) : null}
        {key === "RUB_SBERBANK" ? (
          <Input
            label="Курс: ₽ за 1 R$ (например 183)"
            type="number"
            value={String(item.rubPerBrl ?? 183)}
            onChange={(e) =>
              updateManual(key, { rubPerBrl: Number(e.target.value) || 183 })
            }
          />
        ) : null}
        <Input
          label="Минимальная сумма"
          type="number"
          value={String(item.minAmount)}
          onChange={(e) =>
            updateManual(key, { minAmount: Number(e.target.value) || 0 })
          }
        />

        <div>
          <p className="mb-2 text-sm font-medium text-gray-700">QR-код</p>
          <p className="mb-3 text-xs text-gray-500">
            Необязательно. Если QR не загружен, в модалке оплаты показываются только реквизиты карты.
          </p>
          <div className="flex flex-wrap items-start gap-4">
            {qrPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={`QR ${key}`}
                className="h-28 w-28 rounded border border-gray-200 object-contain bg-white"
                src={qrPreview}
              />
            ) : (
              <div className="flex h-28 w-28 items-center justify-center rounded border border-dashed border-gray-300 text-xs text-gray-400">
                Нет QR
              </div>
            )}
            <div className="space-y-2">
              <input
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadQr(key, file);
                }}
                type="file"
              />
              {item.qrImageUrl ? (
                <Button onClick={() => removeQr(key)} type="button" variant="danger" size="sm">
                  Удалить QR
                </Button>
              ) : null}
              {uploading === key && (
                <p className="text-sm text-blue-600">Загрузка...</p>
              )}
              <p className="break-all text-xs text-gray-500">{item.qrImageUrl || "—"}</p>
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
                {renderManualBlock("USDT", "USDT — TRC-20")}
                {renderManualBlock("KZT_KASPI", "KZT — Kaspi")}
                {renderManualBlock("KZT", "KZT — Visa/Mastercard")}
                {renderManualBlock("RUB_SBERBANK", "RUB — Перевод из РФ")}
                {renderManualBlock("RUB", "RUB — Visa/Mastercard (скрыт)")}
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
