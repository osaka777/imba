const STORAGE_KEY = "imba_client_device_id";

function randomId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getClientDeviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const id = randomId();
    localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    return randomId();
  }
}

export function deviceIdHeaders(): Record<string, string> {
  const id = getClientDeviceId();
  return id ? { "X-Client-Device-Id": id } : {};
}
