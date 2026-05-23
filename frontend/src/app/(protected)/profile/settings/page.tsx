"use client";

import { useEffect, useState } from "react";
import { getSessionClient } from "~/entities/user/lib";
import { api, components } from "~/shared/api";
import { UserSettings } from "~/entities/user";

type UserData = components["schemas"]["UserDto"];

export default function SettingsPage() {
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
          setError(`Ошибка при загрузке данных пользователя: ${(apiError as any)?.message || 'Неизвестная ошибка'}`);
        } else {
          setUserData(data);
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Загрузка настроек...</div>
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