"use client";

export function getSessionClient(): string | false {
  try {
    // Получаем токен из localStorage или sessionStorage
    const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
    return token || false;
  } catch (error) {
    console.error('getSessionClient: Error getting token:', error);
    return false;
  }
} 