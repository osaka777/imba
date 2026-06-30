"use server";

import { cookies } from "next/headers";
import "server-only";

export async function createSession(access_token: string) {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const isProd = process.env.NODE_ENV === "production";

    cookies().set("access_token", access_token, {
        httpOnly: true,
        secure: isProd,
        expires: expiresAt,
        sameSite: "lax",
        path: "/",
    });
}
