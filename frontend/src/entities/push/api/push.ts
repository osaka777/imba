const apiBase = () => {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_HOST || "http://localhost:3000";
};

export type PushNotifications = {
  registered: boolean;
  bets: boolean;
  deposit: boolean;
  withdraw: boolean;
  promo: boolean;
  liveMatch: boolean;
};

export async function registerPushDevice(
  token: string,
  body: {
    fcmToken: string;
    platform?: string;
    appVersion?: string;
    notifyBets?: boolean;
    notifyDeposit?: boolean;
    notifyWithdraw?: boolean;
    notifyPromo?: boolean;
    notifyLiveMatch?: boolean;
  },
): Promise<PushNotifications> {
  const res = await fetch(`${apiBase()}/api/user/push/register`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("push_register_failed");
  return res.json();
}

export async function getPushNotifications(
  token: string,
  fcmToken: string,
): Promise<PushNotifications> {
  const res = await fetch(`${apiBase()}/api/user/push/notifications`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "x-fcm-token": fcmToken,
    },
  });
  if (!res.ok) throw new Error("push_prefs_failed");
  return res.json();
}

export async function updatePushNotifications(
  token: string,
  fcmToken: string,
  prefs: Partial<Pick<PushNotifications, "bets" | "deposit" | "withdraw" | "promo" | "liveMatch">>,
): Promise<PushNotifications> {
  const res = await fetch(`${apiBase()}/api/user/push/notifications`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "x-fcm-token": fcmToken,
    },
    body: JSON.stringify(prefs),
  });
  if (!res.ok) throw new Error("push_prefs_update_failed");
  return res.json();
}
