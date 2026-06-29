"use client";

import { useCallback, useEffect, useState } from "react";
import { AuthGuard } from "@/shared/components/AuthGuard";
import { Button } from "@/widgets/Button";
import { Input } from "@/widgets/Input";
import { apiCall } from "@/shared/utils/api";
import { toast } from "react-toastify";

type PromoModalSettings = {
  enabled: boolean;
  showInHeader: boolean;
  showOnHome: boolean;
  showOnLive: boolean;
  showOnLine: boolean;
  bannerTitle: string;
  bannerSubtitle: string;
  modalTitle: string;
  modalSubtitle: string;
  stepRegisterText: string;
  stepDepositText: string;
  bonusHighlight: string;
  ctaDeposit: string;
  ctaClaim: string;
  ctaGoToWc: string;
  successTitle: string;
  successSubtitle: string;
  heroImageUrl: string;
  bannerImageUrl: string;
  gradientFrom: string;
  gradientTo: string;
  accentColor: string;
  promoCode: string;
  promoType: "DEPOSIT_BONUS" | "DIRECT_BONUS";
  minDepositAmount: number;
  minDepositCurrency: string;
  bonusPercentage: number;
  bonusAmount: number;
  bonusCurrency: string;
  promoAvailable: number;
  validUntilDays: number;
  presetAmounts: number[];
  wcRedirectPath: string;
  autoSyncPromo: boolean;
};

type Tab = "general" | "texts" | "promo" | "display";

const baseUrl = () => process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export default function PromoModalSettingsPage() {
  const [tab, setTab] = useState<Tab>("general");
  const [settings, setSettings] = useState<PromoModalSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiCall(`${baseUrl()}/api/admin/promo-modal`);
      if (!res.ok) throw new Error(await res.text());
      setSettings(await res.json());
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const patch = (partial: Partial<PromoModalSettings>) => {
    setSettings((prev) => (prev ? { ...prev, ...partial } : prev));
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await apiCall(`${baseUrl()}/api/admin/promo-modal`, {
        method: "PUT",
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Настройки promo-модалки сохранены");
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const syncPromo = async () => {
    setSyncing(true);
    try {
      const res = await apiCall(`${baseUrl()}/api/admin/promo-modal/sync-promo`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Промокод синхронизирован в БД");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Ошибка синхронизации");
    } finally {
      setSyncing(false);
    }
  };

  if (loading || !settings) {
    return (
      <AuthGuard>
        <div className="p-6">Загрузка...</div>
      </AuthGuard>
    );
  }

  const presetText = settings.presetAmounts.join(", ");

  return (
    <AuthGuard>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">WC Promo Modal</h1>
            <p className="text-gray-400 text-sm mt-1">
              Lucky Drive / World Cup модалка: тексты, бонус, отображение
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={syncPromo} disabled={syncing}>
              {syncing ? "..." : "Синхр. промокод"}
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            [
              ["general", "Общее"],
              ["texts", "Тексты"],
              ["promo", "Бонус"],
              ["display", "Показ"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`px-4 py-2 rounded-lg text-sm ${
                tab === key ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "general" && (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex items-center gap-2 text-white">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => patch({ enabled: e.target.checked })}
              />
              Акция включена
            </label>
            <label className="flex items-center gap-2 text-white">
              <input
                type="checkbox"
                checked={settings.autoSyncPromo}
                onChange={(e) => patch({ autoSyncPromo: e.target.checked })}
              />
              Авто-создание промокода при сохранении
            </label>
            <Input
              label="Hero-картинка (модалка)"
              value={settings.heroImageUrl}
              onChange={(e) => patch({ heroImageUrl: e.target.value })}
            />
            <Input
              label="Картинка баннера"
              value={settings.bannerImageUrl}
              onChange={(e) => patch({ bannerImageUrl: e.target.value })}
            />
            <Input
              label="Градиент от"
              value={settings.gradientFrom}
              onChange={(e) => patch({ gradientFrom: e.target.value })}
            />
            <Input
              label="Градиент до"
              value={settings.gradientTo}
              onChange={(e) => patch({ gradientTo: e.target.value })}
            />
            <Input
              label="Акcent (бейдж бонуса)"
              value={settings.accentColor}
              onChange={(e) => patch({ accentColor: e.target.value })}
            />
            <Input
              label="Ссылка после успеха"
              value={settings.wcRedirectPath}
              onChange={(e) => patch({ wcRedirectPath: e.target.value })}
            />
          </div>
        )}

        {tab === "texts" && (
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Заголовок баннера" value={settings.bannerTitle} onChange={(e) => patch({ bannerTitle: e.target.value })} />
            <Input label="Подзаголовок баннера" value={settings.bannerSubtitle} onChange={(e) => patch({ bannerSubtitle: e.target.value })} />
            <Input label="Заголовок модалки" value={settings.modalTitle} onChange={(e) => patch({ modalTitle: e.target.value })} />
            <Input label="Подзаголовок модалки" value={settings.modalSubtitle} onChange={(e) => patch({ modalSubtitle: e.target.value })} />
            <Input label="Шаг: регистрация" value={settings.stepRegisterText} onChange={(e) => patch({ stepRegisterText: e.target.value })} />
            <Input label="Шаг: депозит" value={settings.stepDepositText} onChange={(e) => patch({ stepDepositText: e.target.value })} />
            <Input label="Бейдж бонуса" value={settings.bonusHighlight} onChange={(e) => patch({ bonusHighlight: e.target.value })} />
            <Input label="CTA депозит" value={settings.ctaDeposit} onChange={(e) => patch({ ctaDeposit: e.target.value })} />
            <Input label="CTA получить бонус" value={settings.ctaClaim} onChange={(e) => patch({ ctaClaim: e.target.value })} />
            <Input label="CTA перейти к ЧМ" value={settings.ctaGoToWc} onChange={(e) => patch({ ctaGoToWc: e.target.value })} />
            <Input label="Успех: заголовок" value={settings.successTitle} onChange={(e) => patch({ successTitle: e.target.value })} />
            <Input label="Успех: текст" value={settings.successSubtitle} onChange={(e) => patch({ successSubtitle: e.target.value })} />
          </div>
        )}

        {tab === "promo" && (
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Промокод" value={settings.promoCode} onChange={(e) => patch({ promoCode: e.target.value.toUpperCase() })} />
            <div>
              <label className="block text-sm text-gray-300 mb-1">Тип бонуса</label>
              <select
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white"
                value={settings.promoType}
                onChange={(e) => patch({ promoType: e.target.value as PromoModalSettings["promoType"] })}
              >
                <option value="DEPOSIT_BONUS">% от депозита (после approve)</option>
                <option value="DIRECT_BONUS">Фикс. сумма (кнопка «Получить»)</option>
              </select>
            </div>
            <Input
              label="Мин. депозит"
              type="number"
              value={String(settings.minDepositAmount)}
              onChange={(e) => patch({ minDepositAmount: Number(e.target.value) || 0 })}
            />
            <Input
              label="Валюта депозита"
              value={settings.minDepositCurrency}
              onChange={(e) => patch({ minDepositCurrency: e.target.value.toUpperCase() })}
            />
            {settings.promoType === "DEPOSIT_BONUS" ? (
              <Input
                label="Процент бонуса"
                type="number"
                value={String(settings.bonusPercentage)}
                onChange={(e) => patch({ bonusPercentage: Number(e.target.value) || 0 })}
              />
            ) : (
              <>
                <Input
                  label="Сумма бонуса"
                  type="number"
                  value={String(settings.bonusAmount)}
                  onChange={(e) => patch({ bonusAmount: Number(e.target.value) || 0 })}
                />
                <Input
                  label="Валюта бонуса"
                  value={settings.bonusCurrency}
                  onChange={(e) => patch({ bonusCurrency: e.target.value.toUpperCase() })}
                />
              </>
            )}
            <Input
              label="Лимит активаций"
              type="number"
              value={String(settings.promoAvailable)}
              onChange={(e) => patch({ promoAvailable: Number(e.target.value) || 0 })}
            />
            <Input
              label="Срок промо (дней)"
              type="number"
              value={String(settings.validUntilDays)}
              onChange={(e) => patch({ validUntilDays: Number(e.target.value) || 30 })}
            />
            <Input
              label="Быстрые суммы (через запятую)"
              value={presetText}
              onChange={(e) =>
                patch({
                  presetAmounts: e.target.value
                    .split(",")
                    .map((v) => Number(v.trim()))
                    .filter((n) => n > 0),
                })
              }
            />
            <p className="md:col-span-2 text-sm text-gray-400">
              DEPOSIT_BONUS: промокод прикрепляется к заявке, бонус начисляется при approve в админке.
              DIRECT_BONUS: после пополнения от мин. суммы пользователь жмёт «Получить бонус».
            </p>
          </div>
        )}

        {tab === "display" && (
          <div className="grid gap-3 md:grid-cols-2">
            {(
              [
                ["showInHeader", "Шапка (Live/Line top)"],
                ["showOnHome", "Главная"],
                ["showOnLive", "Live"],
                ["showOnLine", "Линия"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-white">
                <input
                  type="checkbox"
                  checked={settings[key]}
                  onChange={(e) => patch({ [key]: e.target.checked })}
                />
                {label}
              </label>
            ))}
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
