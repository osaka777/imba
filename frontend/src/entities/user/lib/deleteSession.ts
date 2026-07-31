function sessionApiUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/auth/session`;
  }
  return "/auth/session";
}

/** Clear httpOnly accessToken via stable route (not a Server Action). */
export async function deleteSession(): Promise<void> {
  try {
    await fetch(sessionApiUrl(), {
      method: "DELETE",
      credentials: "include",
    });
  } catch (error) {
    console.error("deleteSession failed:", error);
  }
}
