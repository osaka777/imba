"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSessionClient } from "~/entities/user/lib";
import { UserSettings } from "~/entities/user";
import { useLocale } from "~/shared/model/useLocale";

type SettingsUserData = {
  id: number;
  email: string;
  phone?: string | null;
  phoneVerified?: boolean;
  telegramLinked?: boolean;
  telegramUsername?: string | null;
  avatarPreset?: string | null;
  avatarUrl?: string | null;
  nickname?: string | null;
};

async function fetchSettingsProfile(token: string): Promise<SettingsUserData> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);

  try {
    const res = await fetch(`${window.location.origin}/api/user/settings`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return res.json() as Promise<SettingsUserData>;
  } finally {
    window.clearTimeout(timeout);
  }
}

function SettingsPageInner() {
  const { t } = useLocale();
  const [userData, setUserData] = useState<SettingsUserData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const token = getSessionClient();
        if (!token) {
          if (!cancelled) {
            setError(t("profile.authRequiredSettings"));
            setIsLoading(false);
          }
          return;
        }

        const data = await fetchSettingsProfile(token);
        if (!cancelled) setUserData(data);
      } catch (err) {
        if (!cancelled) {
          const aborted = err instanceof Error && err.name === "AbortError";
          setError(
            aborted ? t("profile.settingsTimeout") : t("profile.settingsLoadError"),
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [t]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-slate-400 text-sm">
        {t("profile.settingsLoading")}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4 text-center">
        <h3 className="text-lg text-red-600">{error}</h3>
      </div>
    );
  }

  return (
    <Suspense
      fallback={(
        <div className="flex items-center justify-center min-h-[40vh] text-slate-400 text-sm">
          {t("common.loading")}
        </div>
      )}
    >
      <SettingsWithParams userData={userData} />
    </Suspense>
  );
}

function SettingsWithParams({ userData }: { userData: SettingsUserData }) {
  const searchParams = useSearchParams();

  return (
    <UserSettings
      connectTelegram={searchParams.get("connectTelegram") === "1"}
      telegramJustLinked={searchParams.get("telegram") === "linked"}
      userData={userData}
    />
  );
}

export default function SettingsPage() {
  const { t } = useLocale();
  return (
    <Suspense
      fallback={(
        <div className="flex items-center justify-center min-h-[40vh] text-slate-400 text-sm">
          {t("common.loading")}
        </div>
      )}
    >
      <SettingsPageInner />
    </Suspense>
  );
}
