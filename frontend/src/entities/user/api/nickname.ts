import { getSessionClient } from "../lib/getSessionClient";

const apiBase = () => {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_HOST || "http://localhost:3000";
};

export async function updateNickname(
  nickname: string | null,
): Promise<string | null> {
  const token = getSessionClient();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${apiBase()}/api/user/nickname`, {
    method: "PATCH",
    headers,
    credentials: "include",
    body: JSON.stringify({ nickname: nickname ?? "" }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const nested =
      data?.message && typeof data.message === "object"
        ? data.message
        : null;
    const code =
      typeof data?.code === "string"
        ? data.code
        : typeof nested?.code === "string"
          ? nested.code
          : typeof data?.message === "string"
            ? data.message
            : "failed";
    throw new Error(code);
  }
  return (data?.nickname as string | null) ?? null;
}
