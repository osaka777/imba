import { getSessionClient } from "../lib/getSessionClient";

const apiBase = () => {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_HOST || "http://localhost:3000";
};

export async function uploadAvatar(file: File): Promise<string> {
  const token = getSessionClient();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const body = new FormData();
  body.append("image", file);

  const res = await fetch(`${apiBase()}/api/user/avatar`, {
    method: "POST",
    headers,
    credentials: "include",
    body,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data?.message === "string" ? data.message : "Failed to upload avatar",
    );
  }
  const url = data?.avatarUrl;
  if (typeof url !== "string" || !url) {
    throw new Error("Failed to upload avatar");
  }
  return url;
}
