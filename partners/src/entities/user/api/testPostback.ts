"use server";

import { cookies } from "next/headers";
import { api } from "@/shared/api/api";

export async function testPostback(): Promise<{
  success: boolean;
  httpStatus?: number;
  error?: string;
} | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  if (!token) return null;

  try {
    const { data } = await api.post<{ success: boolean; httpStatus?: number; error?: string }>(
      "/affiliate-program/user/postbacks/test",
      {},
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return data;
  } catch {
    return { success: false, error: "Не удалось отправить тестовый postback" };
  }
}
