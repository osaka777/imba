"use server";

import { cookies } from "next/headers";
import { api } from "@/shared/api/api";

export type PostbackLogItem = {
  id: number;
  event: string;
  url: string;
  httpStatus: number | null;
  status: string;
  attempt: number;
  playerId: number | null;
  createdAt: string;
};

export async function getPostbacks(limit = 20): Promise<PostbackLogItem[]> {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  if (!token) return [];

  try {
    const { data } = await api.get<PostbackLogItem[]>(
      `/affiliate-program/user/postbacks?limit=${limit}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return data ?? [];
  } catch {
    return [];
  }
}
