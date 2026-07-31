import { getSessionClient } from "../lib/getSessionClient";
import { deviceIdHeaders } from "~/shared/lib/deviceId";

import { createSessionClient } from "../lib/createSessionClient";
import { createSession } from "../lib/createSession";

export type LoginResult =
  | { kind: "success" }
  | { kind: "2fa"; twoFaToken: string };

export const login = async (body: {
  email: string;
  password: string;
}): Promise<LoginResult> => {
  const res = await fetch(`${typeof window !== "undefined" ? window.location.origin : ""}/api/sign-in`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...deviceIdHeaders(),
    },
    credentials: "include",
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data?.message === "string"
        ? data.message
        : "wrong email or password",
    );
  }

  if (data.requires2fa && data.twoFaToken) {
    return { kind: "2fa", twoFaToken: data.twoFaToken };
  }

  if (data.accessToken) {
    await createSessionClient(data.accessToken);
    try {
      await createSession(data.accessToken);
    } catch (error) {
      console.warn("createSession httpOnly cookie failed after login:", error);
    }
    return { kind: "success" };
  }

  throw new Error("Unexpected login response");
};

export const verifyTelegram2fa = async (body: {
  twoFaToken: string;
  code: string;
}): Promise<void> => {
  const res = await fetch(`${typeof window !== "undefined" ? window.location.origin : ""}/api/auth/verify-telegram-2fa`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...deviceIdHeaders(),
    },
    credentials: "include",
    body: JSON.stringify({
      ...body,
      deviceId: deviceIdHeaders()["X-Client-Device-Id"],
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data?.message === "string" ? data.message : "Invalid 2FA code",
    );
  }

  if (data.accessToken) {
    await createSessionClient(data.accessToken);
    try {
      await createSession(data.accessToken);
    } catch (error) {
      console.warn("createSession httpOnly cookie failed after 2FA:", error);
    }
    return;
  }

  throw new Error("Unexpected 2FA response");
};
