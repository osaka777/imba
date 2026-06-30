"use client";

import { Suspense, useEffect, useState } from "react";
import { getSessionClient } from "~/entities/user/lib";
import { api, components } from "~/shared/api";
import { UserSettings } from "~/entities/user";

type UserData = components["schemas"]["UserDto"] & {
  telegramLinked?: boolean;
  telegramUsername?: string | null;
};

function SettingsPageContent() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = getSessionClient();
        if (!token) {
          setError("Необходима авторизация для просмотра настроек");
          setIsLoading(false);
          return;
        }

        const { data, error: apiError } = await api.GET("/api/user", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (apiError) {
          console.error("Error fetching user data:", apiError);
          setError(
            `Ошибка при загрузке данных пользователя: ${(apiError as { message?: string })?.message || "Неизвестная ошибка"}`,
          );
        } else {
          setUserData(data as UserData);
        }
      } catch (err) {
        console.error("Unexpected error in SettingsPage:", err);
        setError("Неожиданная ошибка при загрузке данных пользователя");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-slate-400 text-sm">
        Загрузка настроек...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <h3 className="text-lg text-red-600">{error}</h3>
      </div>
    );
  }

  return <UserSettings userData={userData} />;
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Загрузка...</div>}>
      <SettingsPageContent />
    </Suspense>
  );
}