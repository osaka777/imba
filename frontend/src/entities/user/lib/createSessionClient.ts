"use client";

export async function createSessionClient(accessToken: string) {
  try {
    // Сохраняем токен в localStorage
    localStorage.setItem('accessToken', accessToken);
  } catch (error) {
    console.error('createSessionClient: Error saving token:', error);
  }
}