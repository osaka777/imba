function sessionApiUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/auth/session`;
  }
  return "/auth/session";
}

/** Persist httpOnly accessToken via stable route (not a Server Action). */
export async function createSession(accessToken: string): Promise<void> {
  const res = await fetch(sessionApiUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ accessToken }),
  });

  if (!res.ok) {
    throw new Error(`Failed to persist session (${res.status})`);
  }
}
