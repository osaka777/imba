import { getSessionClient } from "../lib/getSessionClient";

const apiBase = () => {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_HOST || "http://localhost:3000";
};

export async function updateAvatarPreset(preset: string | null): Promise<void> {
  const token = getSessionClient();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${apiBase()}/api/user/avatar-preset`, {
    method: "PATCH",
    headers,
    credentials: "include",
    body: JSON.stringify({ preset: preset ?? "" }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(typeof data?.message === "string" ? data.message : "Failed to save avatar");
  }
}
